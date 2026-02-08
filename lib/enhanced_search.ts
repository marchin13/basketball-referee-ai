import OpenAI from 'openai';
import { searchRules } from './rag-v2';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 重要キーワードを抽出
const extractKeyTerms = (question: string) => {
  // 時間: "20分前", "24秒", "30秒"
  const times = question.match(/\d+(?:分|秒|時間)(?:前|後|以内|間)/g) || [];

  // 数値: "5個", "3回", "2人"
  const numbers = question.match(/\d+(?:個|回|人|点|本)/g) || [];

  // 限定条件: "のみ", "必ず", "いかなる"
  const restrictions = question.match(/のみ|限り|必ず|いかなる(?:場合も)?|すべて|全て|常に|決して/g) || [];

  // 人物・組織: "審判", "テーブルオフィシャルズ"
  const entities = question.match(/審判|テーブルオフィシャルズ|コミッショナー|スコアラー|タイマー|オフィシャルズ|プレーヤー|コーチ|チーム|観客/g) || [];

  // 否定形: "ない", "できない"
  const negations = question.match(/(?:で)?きない|(?:で)?はない|(?:し)?ない|禁止|認められない/g) || [];

  return {
    times,
    numbers,
    restrictions,
    entities,
    negations,
    all: [...times, ...numbers, ...restrictions, ...entities].filter((v, i, a) => a.indexOf(v) === i),
  };
};

// 細部条件の一致チェック
const checkDetailedConditions = (question: string, ruleContent: string) => {
  const issues: string[] = [];

  // 時間条件のチェック
  const questionTimes: string[] = question.match(/\d+(?:分|秒)/g) || [];
  const ruleTimes: string[] = ruleContent.match(/\d+(?:分|秒)/g) || [];

  for (const qTime of questionTimes) {
    if (!ruleTimes.includes(qTime)) {
      issues.push(`時間条件不一致: 問題「${qTime}」がルールに見つからない`);
    }
  }

  // 限定条件のチェック
  const questionHasOnly = /のみ|限り/.test(question);
  const ruleHasOnly = /のみ|限り/.test(ruleContent);

  if (questionHasOnly && !ruleHasOnly) {
    issues.push('問題文に「のみ/限り」があるがルールにない（限定条件の追加）');
  } else if (!questionHasOnly && ruleHasOnly) {
    issues.push('ルールに「のみ/限り」があるが問題文にない（限定条件の欠如）');
  }

  // 否定形のチェック
  const questionNegations = question.match(/ない|できない|禁止/g) || [];
  const ruleNegations = ruleContent.match(/ない|できない|禁止/g) || [];

  if (questionNegations.length !== ruleNegations.length) {
    issues.push(`否定形の数が異なる: 問題${questionNegations.length}個 vs ルール${ruleNegations.length}個`);
  }

  return {
    hasIssues: issues.length > 0,
    issues,
  };
};

// 拡張検索: 多段階検索
export const enhancedSearch = async (question: string) => {
  console.log('    [検索] Stage 1: 通常検索');

  // Stage 1: 通常検索
  let results = await searchRules(question, 3);

  const topScore = results[0]?.combinedScore || 0;
  console.log(`    [検索] トップスコア: ${(topScore * 100).toFixed(1)}%`);

  // Stage 2: スコアが低い場合、キーワード強化して再検索
  if (topScore < 0.75) {
    console.log('    [検索] Stage 2: キーワード強化再検索');

    const keyTerms = extractKeyTerms(question);
    console.log(`    [検索] 重要キーワード: ${keyTerms.all.slice(0, 5).join(', ')}`);

    // キーワードを追加して検索
    const enhancedQuery = `${question} ${keyTerms.all.join(' ')}`;
    const retryResults = await searchRules(enhancedQuery, 5);

    // 結果をマージ（重複除去）
    const merged = [...results];
    for (const newResult of retryResults) {
      const exists = merged.some(r => r.sectionId === newResult.sectionId);
      if (!exists) {
        merged.push(newResult);
      }
    }

    // スコアでソート
    results = merged.sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0)).slice(0, 5);

    const newTopScore = results[0]?.combinedScore || 0;
    console.log(`    [検索] 再検索後トップスコア: ${(newTopScore * 100).toFixed(1)}%`);
  }

  // Stage 3: 細部条件チェック
  if (results.length > 0) {
    const detailCheck = checkDetailedConditions(question, results[0].content);
    if (detailCheck.hasIssues) {
      console.log('    [警告] 細部条件に問題:');
      detailCheck.issues.forEach(issue => console.log(`      - ${issue}`));
    }

    return {
      results,
      detailCheck,
    };
  }

  return {
    results,
    detailCheck: { hasIssues: false, issues: [] },
  };
};

export { extractKeyTerms, checkDetailedConditions };
