import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RagResult {
  sectionId: string;
  sectionName: string;
  content: string;
  similarity: number;
  source: 'vector' | 'keyword';
}

// キーワード抽出
function extractKeywords(question: string): string[] {
  const keywords: string[] = [];
  
  const importantTerms = [
    '怪我', '負傷', 'インジャリー',
    '交代', '選手交代',
    'ファウル', 'バイオレーション',
    'タイムアウト', '中断',
    'ショットクロック', 'ゲームクロック',
    'フリースロー', 'スローイン',
    'ヘッドコーチ', '審判',
    'スコアシート', 'テーブルオフィシャルズ'
  ];
  
  importantTerms.forEach(term => {
    if (question.includes(term)) {
      keywords.push(term);
    }
  });
  
  return keywords;
}

// キーワード検索
async function searchByKeywords(keywords: string[]): Promise<RagResult[]> {
  if (keywords.length === 0) return [];
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const conditions = keywords.map(k => `content.ilike.%${k}%`);
  
  const { data, error } = await supabase
    .from('rule_sections')
    .select('section_id, section_name, content')
    .or(conditions.join(','))
    .limit(10); // 5 → 10 に増やす
  
  if (error) {
    console.error('キーワード検索エラー:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    sectionId: item.section_id,
    sectionName: item.section_name,
    content: item.content,
    similarity: 0.7, // 0.5 → 0.7 に上げる（優先度を高める）
    source: 'keyword' as const
  }));
}

// ハイブリッド検索
export async function searchRules(question: string, matchCount: number = 5): Promise<RagResult[]> {
  const cleanQuestion = question
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/　/g, ' ');
  
  console.log('🔍 ハイブリッド検索を開始:', cleanQuestion);
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  
  try {
    // 1. ベクトル検索
    console.log('📊 ベクトル検索中...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanQuestion,
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    const vectorString = '[' + questionEmbedding.join(',') + ']';
    
    const { data: vectorData, error: vectorError } = await supabase.rpc('match_rule_sections', {
      query_embedding: vectorString,
      match_count: 7 // 10 → 7 に減らす（キーワード検索の余地を作る）
    });
    
    if (vectorError) {
      console.error('❌ ベクトル検索エラー:', vectorError);
      throw new Error(`ベクトル検索エラー: ${vectorError.message}`);
    }
    
    const vectorResults: RagResult[] = (vectorData || []).map((item: any) => ({
      sectionId: item.section_id,
      sectionName: item.section_name,
      content: item.content,
      similarity: item.similarity,
      source: 'vector' as const
    }));
    
    console.log(`✅ ベクトル検索: ${vectorResults.length}件`);
    console.log('📊 ベクトル検索結果:');
    vectorResults.forEach((result, index) => {
      console.log(`  [V${index + 1}] ${result.sectionId} ${result.sectionName} (${(result.similarity * 100).toFixed(1)}%)`);
    });
    
    // 2. キーワード検索
    const keywords = extractKeywords(cleanQuestion);
    const keywordResults = await searchByKeywords(keywords);
    
    console.log(`✅ キーワード検索: ${keywordResults.length}件`);
    console.log('🔑 キーワード検索結果:');
    keywordResults.forEach((result, index) => {
      console.log(`  [K${index + 1}] ${result.sectionId} ${result.sectionName}`);
    });
    
    // 3. 結果をマージ（section_id + section_name の組み合わせで重複排除）
    const mergedResults = [...vectorResults];
    const existingKeys = new Set(
      vectorResults.map(r => `${r.sectionId}::${r.sectionName}`)
    );
    
    let addedCount = 0;
    keywordResults.forEach(result => {
      const key = `${result.sectionId}::${result.sectionName}`;
      if (!existingKeys.has(key)) {
        mergedResults.push(result);
        existingKeys.add(key);
        addedCount++;
        console.log(`  ➕ 追加: ${result.sectionId} ${result.sectionName}`);
      } else {
        console.log(`  ⚠️ 重複スキップ: ${result.sectionId} ${result.sectionName}`);
      }
    });
    
    console.log(`📦 マージ完了: ${addedCount}件追加（重複: ${keywordResults.length - addedCount}件）`);
    
    // 類似度でソート
    mergedResults.sort((a, b) => b.similarity - a.similarity);
    
    // 上位のみ返す
    const finalResults = mergedResults.slice(0, matchCount);
    
    console.log(`✅ 最終結果: ${finalResults.length}件`);
    finalResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.sectionId} ${result.sectionName} (${result.source}, 類似度: ${(result.similarity * 100).toFixed(1)}%)`);
    });
    
    return finalResults;
    
  } catch (error) {
    console.error('❌ ハイブリッド検索エラー:', error);
    throw error;
  }
}