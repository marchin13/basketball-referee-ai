/**
 * フレーズマッチングスコアv2（厳格版）
 * 長く意味のあるフレーズの一致のみを評価
 */

// 重要キーワードを抽出（複合語優先）
const extractKeyPhrases = (text: string): string[] => {
  const keyPhrases: string[] = [];

  // 数値+単位（「5個のファウル」「24秒」）
  const numberPhrases = text.match(/\d+(?:個|回|人|点|本|秒|分|時間)(?:の|で|以内)?[^\s、。]{0,5}/g) || [];
  keyPhrases.push(...numberPhrases);

  // 複合名詞（「テーブルオフィシャルズ」「シューティングファウル」）
  const compounds = text.match(/[ァ-ヴー]{5,}/g) || [];
  keyPhrases.push(...compounds);

  // 限定表現（「のみ」「必ず」付きフレーズ）
  const restrictions = text.match(/[^\s、。]{2,}(?:のみ|限り|必ず|すべて)/g) || [];
  keyPhrases.push(...restrictions);

  // 時間表現（「20分前」「試合開始前」）
  const timePhrases = text.match(/\d+[^\s、。]{0,3}(?:前|後|以内|間)/g) || [];
  keyPhrases.push(...timePhrases);

  return keyPhrases.filter(p => p.length >= 4);
};

// フレーズマッチングスコアv2
export const calculatePhraseScoreV2 = (query: string, content: string): number => {
  const queryPhrases = extractKeyPhrases(query);
  const contentCleaned = content.replace(/\s+/g, '');

  if (queryPhrases.length === 0) {
    return 0;  // 重要フレーズがない場合は0
  }

  let matchCount = 0;
  let totalWeight = 0;

  for (const phrase of queryPhrases) {
    const phraseCleaned = phrase.replace(/\s+/g, '');

    if (contentCleaned.includes(phraseCleaned)) {
      matchCount++;
      // フレーズの長さで重み付け（長いほど重要）
      const weight = Math.pow(phraseCleaned.length, 1.5);
      totalWeight += weight;
    }
  }

  // スコア = (一致率 × 0.5) + (重み付きスコア × 0.5)
  const matchRatio = matchCount / queryPhrases.length;
  const weightedScore = Math.min(totalWeight / 50, 1.0);

  const finalScore = matchRatio * 0.5 + weightedScore * 0.5;

  return finalScore;
};

// デバッグ用：一致したフレーズを返す
export const findMatchingPhrasesV2 = (query: string, content: string): { matched: string[]; missed: string[] } => {
  const queryPhrases = extractKeyPhrases(query);
  const contentCleaned = content.replace(/\s+/g, '');

  const matched: string[] = [];
  const missed: string[] = [];

  for (const phrase of queryPhrases) {
    const phraseCleaned = phrase.replace(/\s+/g, '');

    if (contentCleaned.includes(phraseCleaned)) {
      matched.push(phrase);
    } else {
      missed.push(phrase);
    }
  }

  return { matched, missed };
};
