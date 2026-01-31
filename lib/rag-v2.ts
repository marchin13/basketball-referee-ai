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
  rankScore?: number; // 🆕 順位スコア
  combinedScore?: number; // 🆕 合計スコア
}

export interface ConfidenceInfo {
  grade: 'A+' | 'A' | 'B' | 'C';
  description: string;
  shouldShowAlternative: boolean;
  colorClass: string;
}

export interface SearchResultWithConfidence {
  results: RagResult[];
  confidence: ConfidenceInfo;
  alternativeResult?: RagResult;
}

// 🆕 フレーズマッチング: 文脈レベルでの一致度を評価
function calculatePhraseMatch(question: string, content: string): number {
  // 重要なフレーズパターン（正規表現）
  const phrasePatterns = [
    // ヘルドボール関連
    { pattern: /ヘルドボール.{0,5}(間|中|の間|のとき)/, bonus: 0.15, name: 'ヘルドボールの間' },
    { pattern: /両チーム.{0,5}ボール.{0,5}(保持|握|掴)/, bonus: 0.12, name: '両チームがボール保持' },
    
    // アウトオブバウンズ関連
    { pattern: /アウトオブバウンズ.{0,10}(触れ|踏|に触|を踏)/, bonus: 0.15, name: 'アウトオブバウンズに触れる' },
    { pattern: /(ライン|境界線).{0,5}(踏|触れ)/, bonus: 0.12, name: 'ラインを踏む' },
    
    // ジャンプボール関連
    { pattern: /ジャンプボール.{0,5}(シチュエーション|状況)/, bonus: 0.15, name: 'ジャンプボールシチュエーション' },
    { pattern: /オルタネイティング.{0,5}ポゼッション/, bonus: 0.12, name: 'オルタネイティングポゼッション' },
    
    // 複合パターン（超重要）
    { pattern: /ヘルドボール.{0,20}アウトオブバウンズ/, bonus: 0.20, name: 'ヘルドボール+アウトオブバウンズ' },
    { pattern: /アウトオブバウンズ.{0,20}ヘルドボール/, bonus: 0.20, name: 'アウトオブバウンズ+ヘルドボール' },
    
    // ショットクロック関連
    { pattern: /ショットクロック.{0,10}(リセット|14秒|24秒)/, bonus: 0.15, name: 'ショットクロックリセット' },
    { pattern: /フロントコート.{0,20}ショットクロック/, bonus: 0.12, name: 'フロントコート+ショットクロック' },
    
    // ファウル関連
    { pattern: /アンスポーツマンライク.{0,10}ファウル/, bonus: 0.15, name: 'アンスポーツマンライクファウル' },
    { pattern: /速攻.{0,20}ファウル/, bonus: 0.12, name: '速攻中のファウル' },
  ];
  
  let totalBonus = 0;
  const matchedPhrases: string[] = [];
  
  phrasePatterns.forEach(({ pattern, bonus, name }) => {
    const questionMatch = pattern.test(question);
    const contentMatch = pattern.test(content);
    
    if (questionMatch && contentMatch) {
      totalBonus += bonus;
      matchedPhrases.push(name);
    }
  });
  
  if (matchedPhrases.length > 0) {
    console.log(`    🎯 フレーズマッチ: ${matchedPhrases.join(', ')} (+${(totalBonus * 100).toFixed(0)}%)`);
  }
  
  return totalBonus;
}

// 🆕🆕 信頼度判定関数
function calculateConfidence(results: RagResult[]): ConfidenceInfo {
  if (results.length === 0) {
    return {
      grade: 'C',
      description: '該当する競技規則が見つかりませんでした',
      shouldShowAlternative: false,
      colorClass: 'bg-red-100 text-red-800 border-red-300'
    };
  }
  
  const top = results[0];
  const second = results[1];
  
  // 結果が1件のみ
  if (!second) {
    if (top.similarity >= 0.7) {
      return {
        grade: 'A',
        description: '該当する競技規則を特定しました',
        shouldShowAlternative: false,
        colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
      };
    } else {
      return {
        grade: 'B',
        description: '類似する規則はありますが、完全一致ではありません',
        shouldShowAlternative: false,
        colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300'
      };
    }
  }
  
  const scoreDiff = (top.combinedScore || 0) - (second.combinedScore || 0);
  
  // A+: 1位が圧倒的（差が0.15以上）
  if (scoreDiff >= 0.15) {
    return {
      grade: 'A+',
      description: '検索結果が完全一致しています',
      shouldShowAlternative: false,
      colorClass: 'bg-green-100 text-green-800 border-green-300'
    };
  }
  
  // A: 1位が明確（差が0.08以上）
  if (scoreDiff >= 0.08) {
    return {
      grade: 'A',
      description: '該当する競技規則をほぼ特定しました',
      shouldShowAlternative: false,
      colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
    };
  }
  
  // B: 僅差（差が0.08未満）
  if (scoreDiff < 0.08) {
    return {
      grade: 'B',
      description: '複数の解釈がある可能性があります',
      shouldShowAlternative: true,
      colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
  }
  
  return {
    grade: 'A',
    description: '該当する競技規則を特定しました',
    shouldShowAlternative: false,
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
  };
}

// 🆕 拡張：より多くのキーワードを抽出
function extractKeywords(question: string): string[] {
  const keywords: string[] = [];
  
  // 🆕 大幅に拡張したキーワードリスト
  const importantTerms = [
    // 既存
    '怪我', '負傷', 'インジャリー',
    '交代', '選手交代',
    'ファウル', 'バイオレーション',
    'タイムアウト', '中断',
    'ショットクロック', 'ゲームクロック',
    'フリースロー', 'スローイン',
    'ヘッドコーチ', '審判',
    'スコアシート', 'テーブルオフィシャルズ',
    
    // 🆕 追加：ボール関連
    'ヘルドボール', 'ジャンプボール', 'オルタネイティングポゼッション',
    'アウトオブバウンズ', '境界線', 'ライン', 'サイドライン', 'エンドライン',
    'ドリブル', 'トラベリング', 'パス', 'シュート',
    
    // 🆕 追加：コート関連
    'フロントコート', 'バックコート', 'センターライン',
    'リング', 'バスケット', 'バックボード',
    
    // 🆕 追加：ファウル種類
    'パーソナルファウル', 'テクニカルファウル', 
    'アンスポーツマンライクファウル', 'アンスポ',
    'ディスクォリファイングファウル', 'チームファウル',
    
    // 🆕 追加：プレー状況
    'オフェンス', 'ディフェンス', '攻撃', '守備',
    'コンタクト', '接触', '触れ合い',
    'ブロッキング', 'チャージング',
    '3秒', '8秒', '24秒', '14秒',
  ];
  
  importantTerms.forEach(term => {
    if (question.includes(term)) {
      keywords.push(term);
    }
  });
  
  // 🆕 推論ロジック：文脈からキーワードを推測
  if (question.match(/掴み合|つかみ合|掴んだ|つかんだ|両手でボールを持/)) {
    keywords.push('ヘルドボール');
    console.log('🧠 推論: 「掴み合い」→「ヘルドボール」を追加');
  }
  
  // 🆕🆕 強化: 「握る」「保持」のパターンを追加
  if (question.match(/握|保持.*まま|両チーム.*ボール|両者.*ボール|オフェンス.*ディフェンス.*ボール/)) {
    if (!keywords.includes('ヘルドボール')) {
      keywords.push('ヘルドボール');
    }
    if (!keywords.includes('ジャンプボール')) {
      keywords.push('ジャンプボール');
    }
    console.log('🧠 推論: 「握った/保持」→「ヘルドボール」「ジャンプボール」を追加');
  }
  
  if (question.match(/(サイドライン|エンドライン|ライン|境界線).{0,5}(踏|触れ)/)) {
    keywords.push('アウトオブバウンズ');
    console.log('🧠 推論: 「ラインを踏んだ」→「アウトオブバウンズ」を追加');
  }
  
  if (question.match(/ボール.{0,5}(持った|保持|掴んだ|掴み).{0,10}(ライン|境界)/)) {
    keywords.push('アウトオブバウンズ');
    console.log('🧠 推論: 「ボール保持中にライン」→「アウトオブバウンズ」を追加');
  }
  
  console.log('🔑 抽出されたキーワード:', keywords);
  
  return keywords;
}

// 🆕 キーワード検索（AND条件対応 + 重み付けスコアリング + フレーズマッチング）
async function searchByKeywords(keywords: string[], question: string): Promise<RagResult[]> {
  if (keywords.length === 0) return [];
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 🆕 同義語マッピング
  const synonyms: { [key: string]: string[] } = {
    'ライン': ['境界線', 'ライン', 'サイドライン', 'エンドライン'],
    'サイドライン': ['サイドライン', '側線'],
    'エンドライン': ['エンドライン', '端線'],
    'アウトオブバウンズ': ['アウトオブバウンズ', 'コートの外', 'アウト・オブ・バウンズ'],
    'ヘルドボール': ['ヘルドボール', 'タイ', 'ボールを掴み', 'ヘルドボールの間'],
    'ジャンプボール': ['ジャンプボール', 'ジャンプ・ボール', 'ジャンプボールシチュエーション'],
    'ファウル': ['ファウル', '反則'],
    'バイオレーション': ['バイオレーション', 'バイオレィション'],
  };
  
  // 🆕🆕 重要キーワードを特定
  const criticalKeywords = ['ヘルドボール', 'ジャンプボール', 'アウトオブバウンズ'];
  const hasCritical = keywords.filter(k => criticalKeywords.includes(k));
  
  let allResults: any[] = [];
  
  // 🆕🆕🆕 戦略1: 重要キーワード2つでAND検索（3つは厳しすぎる）
  if (hasCritical.length >= 2) {
    console.log(`🔍 重要キーワードAND検索: ${hasCritical[0]} AND ${hasCritical[1]}`);
    
    // 同義語も考慮したAND検索
    const keyword1Synonyms = synonyms[hasCritical[0]] || [hasCritical[0]];
    const keyword2Synonyms = synonyms[hasCritical[1]] || [hasCritical[1]];
    
    // パターン1: 最初の2つの重要キーワード
    for (const syn1 of keyword1Synonyms) {
      for (const syn2 of keyword2Synonyms) {
        const { data: andData, error: andError } = await supabase
          .from('jba_rules')
          .select('section_id, section_name, content')
          .ilike('content', `%${syn1}%`)
          .ilike('content', `%${syn2}%`)
          .limit(15);
        
        if (!andError && andData && andData.length > 0) {
          console.log(`  ✅ AND検索結果 (${syn1} + ${syn2}): ${andData.length}件`);
          allResults = [...allResults, ...andData];
          break; // 結果が見つかったら次の同義語は試さない
        }
      }
      if (allResults.length > 0) break;
    }
  }
  
  // 🆕🆕 戦略2: OR検索（従来通り）
  const conditions = keywords.map(k => `content.ilike.%${k}%`);
  
  const { data: orData, error: orError } = await supabase
    .from('jba_rules')
    .select('section_id, section_name, content')
    .or(conditions.join(','))
    .limit(20);
  
  if (orError) {
    console.error('キーワード検索エラー:', orError);
  } else if (orData) {
    allResults = [...allResults, ...orData];
  }
  
  // 重複削除
  const uniqueResults = Array.from(
    new Map(allResults.map(item => [item.section_id, item])).values()
  );
  
  console.log(`✅ キーワード検索: ${uniqueResults.length}件`);
  console.log('🔑 キーワード検索結果:');
  
  // 🆕🆕 各結果のキーワードマッチ数をカウント（同義語も考慮）
  const resultsWithScore = uniqueResults.map(item => {
    let matchCount = 0;
    let criticalMatchCount = 0;
    const matchedKeywords: string[] = [];
    
    keywords.forEach(keyword => {
      // 同義語リストを取得（なければキーワード自身）
      const syns = synonyms[keyword] || [keyword];
      
      // いずれかの同義語がマッチするかチェック
      const matched = syns.some(syn => item.content.includes(syn));
      
      if (matched) {
        matchCount++;
        matchedKeywords.push(keyword);
        
        // 重要キーワードの場合は追加カウント
        if (criticalKeywords.includes(keyword)) {
          criticalMatchCount++;
        }
      }
    });
    
    // 🆕🆕🆕 フレーズマッチングボーナスを追加
    const phraseBonus = calculatePhraseMatch(question, item.content);
    
    // 🆕🆕 スコアリング改善
    // ベーススコア0.60 + 通常マッチ × 0.03 + 重要マッチ × 0.10 + フレーズボーナス（最大0.99）
    const baseScore = 0.60;
    const normalBonus = (matchCount - criticalMatchCount) * 0.03;
    const criticalBonus = criticalMatchCount * 0.10;
    const similarity = Math.min(baseScore + normalBonus + criticalBonus + phraseBonus, 0.99);
    
    console.log(`  [K] ${item.section_id} (通常:${matchCount}個, 重要:${criticalMatchCount}個 [${matchedKeywords.join(', ')}], スコア: ${(similarity * 100).toFixed(1)}%)`);
    
    return {
      sectionId: item.section_id,
      sectionName: item.section_name,
      content: item.content,
      similarity: similarity,
      source: 'keyword' as const
    };
  });
  
  // マッチ数でソート
  return resultsWithScore.sort((a, b) => b.similarity - a.similarity);
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
    
    // 🔄 変更: RPC関数名を match_jba_rules に、件数もmatchCountを使用
    const { data: vectorData, error: vectorError } = await supabase.rpc('match_jba_rules', {
      query_embedding: vectorString,
      match_count: matchCount
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
      console.log(`  [V${index + 1}] ${result.sectionId} (${(result.similarity * 100).toFixed(1)}%)`);
    });
    
    // 2. キーワード検索（フレーズマッチング対応）
    const keywords = extractKeywords(cleanQuestion);
    const keywordResults = await searchByKeywords(keywords, cleanQuestion);
    
    // 🆕🆕 3. 順位スコアを計算
    const vectorRankScores = new Map<string, number>();
    vectorResults.forEach((result, index) => {
      vectorRankScores.set(result.sectionId, Math.max(10 - index, 1));
    });
    
    const keywordRankScores = new Map<string, number>();
    keywordResults.forEach((result, index) => {
      keywordRankScores.set(result.sectionId, Math.max(10 - index, 1));
    });
    
    // 🆕🆕 4. 結果をマージして順位スコアを付与
    const allResults = [...vectorResults, ...keywordResults];
    const merged = new Map<string, RagResult>();
    
    allResults.forEach(result => {
      const existing = merged.get(result.sectionId);
      if (!existing || result.similarity > existing.similarity) {
        // 順位スコアを計算
        const vScore = vectorRankScores.get(result.sectionId) || 0;
        const kScore = keywordRankScores.get(result.sectionId) || 0;
        const rankScore = vScore + kScore;
        
        merged.set(result.sectionId, {
          ...result,
          rankScore,
          combinedScore: result.similarity * 0.5 + (rankScore / 20) * 0.5 // 類似度50% + 順位50%
        });
      }
    });
    
    // 🆕🆕 5. 合計スコアでソート
    const sortedResults = Array.from(merged.values())
      .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
    
    const finalResults = sortedResults.slice(0, matchCount);
    
    console.log(`🔀 マージ後: ${merged.size}件`);
    console.log(`📊 最終結果（上位${matchCount}件）:`);
    finalResults.forEach((result, index) => {
      console.log(`  [${index + 1}] ${result.sectionId} (類似度:${(result.similarity * 100).toFixed(1)}%, 順位:${result.rankScore}, 総合:${((result.combinedScore || 0) * 100).toFixed(1)}%, ${result.source === 'vector' ? 'V' : 'K'})`);
    });
    
    // 🆕🆕 6. 信頼度を判定
    const confidence = calculateConfidence(finalResults);
    console.log(`📊 信頼度: ${confidence.grade} - ${confidence.description}`);
    
    return finalResults;
    
  } catch (error) {
    console.error('❌ 検索エラー:', error);
    throw error;
  }
}