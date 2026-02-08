/**
 * フレーズマッチングスコアを計算
 * 長いフレーズの一致を高く評価
 */

// n-gramを生成（2-5文字の連続フレーズ）
const generateNgrams = (text: string, minN: number = 2, maxN: number = 5): string[] => {
  const ngrams: string[] = [];
  const cleaned = text.replace(/\s+/g, '');  // 空白除去

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= cleaned.length - n; i++) {
      ngrams.push(cleaned.substring(i, i + n));
    }
  }

  return ngrams;
};

// フレーズマッチングスコアを計算
export const calculatePhraseScore = (query: string, content: string): number => {
  const queryNgrams = generateNgrams(query, 3, 8);  // 3-8文字のフレーズ
  const contentCleaned = content.replace(/\s+/g, '');

  let totalScore = 0;
  let maxMatchLength = 0;

  for (const ngram of queryNgrams) {
    if (contentCleaned.includes(ngram)) {
      // フレーズの長さに応じて重み付け
      const weight = Math.pow(ngram.length, 2);  // 長いほど高スコア
      totalScore += weight;
      maxMatchLength = Math.max(maxMatchLength, ngram.length);
    }
  }

  // 正規化（0-1の範囲に）
  const normalizedScore = Math.min(totalScore / 100, 1.0);

  // 最長一致ボーナス
  const longestMatchBonus = maxMatchLength >= 6 ? 0.2 :
                           maxMatchLength >= 4 ? 0.1 : 0;

  return Math.min(normalizedScore + longestMatchBonus, 1.0);
};

// デバッグ用：一致したフレーズを返す
export const findMatchingPhrases = (query: string, content: string): string[] => {
  const queryNgrams = generateNgrams(query, 4, 10);  // 4-10文字
  const contentCleaned = content.replace(/\s+/g, '');
  const matches: string[] = [];

  for (const ngram of queryNgrams) {
    if (contentCleaned.includes(ngram) && ngram.length >= 4) {
      matches.push(ngram);
    }
  }

  // 長い順にソート、重複除去
  return [...new Set(matches)].sort((a, b) => b.length - a.length);
};
