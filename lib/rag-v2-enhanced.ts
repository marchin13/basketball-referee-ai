import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { calculatePhraseScore, findMatchingPhrases } from './phrase-matching';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RagResult {
  sectionId: string;
  sectionName: string;
  content: string;
  similarity?: number;
  source: 'vector' | 'keyword' | 'hybrid';
  rankScore?: number;
  combinedScore?: number;
  phraseScore?: number;        // 🆕
  matchingPhrases?: string[];  // 🆕
}

export async function searchRules(
  query: string,
  limit: number = 3
): Promise<RagResult[]> {

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

  // 3. 結果を統合してスコアリング
  const resultsMap = new Map<string, RagResult>();

  // ベクトル検索結果
  vectorResults?.forEach((r: any) => {
    resultsMap.set(r.section_id, {
      sectionId: r.section_id,
      sectionName: r.section_name || '',
      content: r.content || '',
      similarity: r.similarity,
      source: 'vector',
      rankScore: 0,
      combinedScore: 0,
    });
  });

  // キーワード検索結果
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
        rankScore: 0,
        combinedScore: 0,
      });
    }
  });

  // 4. フレーズマッチングスコアを計算 🆕
  const results = Array.from(resultsMap.values()).map(result => {
    const phraseScore = calculatePhraseScore(query, result.content);
    const matchingPhrases = findMatchingPhrases(query, result.content);

    // スコア統合（フレーズマッチングを重視）
    const vectorScore = result.similarity || 0;
    const keywordScore = result.source === 'keyword' || result.source === 'hybrid' ? 0.7 : 0;

    // 🆕 フレーズスコアの重み: 30%
    const combinedScore = vectorScore * 0.4 + keywordScore * 0.3 + phraseScore * 0.3;

    return {
      ...result,
      phraseScore,
      matchingPhrases,
      combinedScore,
    };
  });

  // 5. スコアでソート
  return results
    .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0))
    .slice(0, limit);
}
