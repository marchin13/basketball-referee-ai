import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// バランス版プロンプト
const getAIJudgment = async (question: string, searchResults: any[]): Promise<string> => {
  if (searchResults.length === 0) return '×';

  const context = searchResults.map((r, i) =>
    `【検索結果${i + 1}】${r.sectionId}\n${r.content}\n(スコア: ${(r.combinedScore * 100).toFixed(1)}%)`
  ).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `バスケットボール競技規則の専門家として判定してください。

【判定フロー】
Step 1: 明確な誤りチェック（厳格）
  以下に該当 → 即座に×
  - 数値が違う（5個 vs 6個、24秒 vs 30秒など）
  - 否定形が逆（できる vs できない、ある vs ない）
  - 範囲が違う（全て vs 一部、必ず vs 場合による、いかなる vs 通常）

Step 2: 趣旨の一致チェック（柔軟）
  Step 1で×でなければ:
  - 検索結果と問題文の趣旨が一致 → ○
  - 表現は違っても意味が同じ → ○
  - 部分的に一致し矛盾なし → ○

【判定例】
問題: "バスケは5人でプレーする"
検索: "各チーム5人のプレーヤー"
→ ○（趣旨一致）

問題: "ファウル6回で失格"
検索: "5個のファウルで失格"
→ ×（数値違い）

問題: "審判は試合を管理する"
検索: "審判は競技の進行を監督する"
→ ○（表現違いだが趣旨一致）

問題: "コートは必ず長方形である"
検索: "コートは長方形である"
→ ○（趣旨一致）

問題: "コートはいかなる場合も長方形でなければならない"
検索: "コートは長方形である（例外規定あり）"
→ ×（範囲違い：「いかなる場合も」vs「例外あり」）

**回答は○または×の1文字のみ。**`
    }, {
      role: 'user',
      content: `【問題】${question}\n\n【検索結果】${context}\n\n判定:`
    }],
    temperature: 0,
    max_tokens: 5,
  });

  return response.choices[0]?.message?.content?.trim() === '○' ? '○' : '×';
};

const testBoth = async () => {
  console.log('='.repeat(60));
  console.log('バランス版プロンプトテスト');
  console.log('不正解69問 + 正解109問 = 全178問');
  console.log('='.repeat(60));
  console.log();

  // 不正解問題
  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );

  // 正解問題
  const correctQuestions = JSON.parse(
    fs.readFileSync('tests/data/correct_questions_subset.json', 'utf-8')
  );

  let failedImproved = 0;
  let correctMaintained = 0;
  let failedStillWrong = 0;
  let correctNowWrong = 0;

  console.log('【不正解69問のテスト】');
  for (let i = 0; i < failedQuestions.length; i++) {
    const q = failedQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/69)...`);

    const results = await searchRules(q.question_text, 3);
    const newAnswer = await getAIJudgment(q.question_text, results);

    if (newAnswer === q.correct_answer) {
      failedImproved++;
      console.log(` ✓ 改善`);
    } else {
      failedStillWrong++;
      console.log(` - 変化なし`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n【正解109問のテスト】');
  for (let i = 0; i < correctQuestions.length; i++) {
    const q = correctQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/109)...`);

    const results = await searchRules(q.question_text, 3);
    const newAnswer = await getAIJudgment(q.question_text, results);

    if (newAnswer === q.correct_answer) {
      correctMaintained++;
      console.log(` ✓ 維持`);
    } else {
      correctNowWrong++;
      console.log(` ✗ 悪化`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('最終結果');
  console.log('='.repeat(60));
  console.log(`不正解の改善: ${failedImproved}/69問`);
  console.log(`正解の維持: ${correctMaintained}/109問`);
  console.log(`正解の悪化: ${correctNowWrong}/109問`);
  console.log();
  console.log(`ネット改善: ${failedImproved - correctNowWrong}問`);
  console.log(`新しい正解率: ${((correctMaintained + failedImproved) / 178 * 100).toFixed(1)}%`);
};

testBoth().catch(console.error);
