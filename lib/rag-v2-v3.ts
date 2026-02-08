import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { calculatePhraseScoreV2, findMatchingPhrasesV2 } from './phrase-matching-v2';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RagResult {
  sectionId: string;
  sectionName: string;
  content: string;
  similarity?: number;
  source: 'vector' | 'keyword' | 'hybrid';
  combinedScore?: number;
  phraseScore?: number;
  matchedPhrases?: string[];
  missedPhrases?: string[];
}

export async function searchRules(
  query: string,
  limit: number = 3
): Promise<RagResult[]> {

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // 1. ベクトル検索
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const vectorString = '[' + embedding.data[0].embedding.join(',') + ']';
  const { data: vectorResults } = await supabase.rpc('match_jba_rules', {
    query_embedding: vectorString,
    match_count: 50,
  });

  // 2. キーワード検索
  const keywords = query
    .replace(/[、。！？]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)
    .slice(0, 5);

  const { data: keywordResults } = await supabase
    .from('jba_rules')
    .select('*')
    .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
    .limit(50);

  // 3. 結果を統合
  const resultsMap = new Map<string, RagResult>();

  vectorResults?.forEach((r: any) => {
    resultsMap.set(r.section_id, {
      sectionId: r.section_id,
      sectionName: r.section_name || '',
      content: r.content || '',
      similarity: r.similarity,
      source: 'vector',
      combinedScore: 0,
    });
  });

  keywordResults?.forEach((r: any) => {
    const existing = resultsMap.get(r.section_id);
    if (existing) {
      existing.source = 'hybrid';
    } else {
      resultsMap.set(r.section_id, {
        sectionId: r.section_id,
        sectionName: r.section_name || '',
        content: r.content || '',
        source: 'keyword',
        combinedScore: 0,
      });
    }
  });

  // 4. フレーズマッチングスコアv2を計算
  const results = Array.from(resultsMap.values()).map(result => {
    const phraseScore = calculatePhraseScoreV2(query, result.content);
    const { matched, missed } = findMatchingPhrasesV2(query, result.content);

    const vectorScore = result.similarity || 0;
    const keywordScore = result.source === 'keyword' || result.source === 'hybrid' ? 0.7 : 0;

    // スコア統合（フレーズスコアが0なら影響しない）
    const phraseWeight = phraseScore > 0 ? 0.3 : 0;
    const vectorWeight = 0.5 - phraseWeight * 0.3;
    const keywordWeight = 0.5 - phraseWeight * 0.2;

    const combinedScore = vectorScore * vectorWeight + keywordScore * keywordWeight + phraseScore * phraseWeight;

    return {
      ...result,
      phraseScore,
      matchedPhrases: matched,
      missedPhrases: missed,
      combinedScore,
    };
  });

  // 5. スコアでソート
  return results
    .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0))
    .slice(0, limit);
}
