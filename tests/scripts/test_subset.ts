import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 改善版プロンプト（偽陽性を減らす）
const getAIJudgment = async (question: string, searchResults: any[]): Promise<string> => {
  if (searchResults.length === 0) return '×';

  const context = searchResults.map((r, i) =>
    `【検索結果${i + 1}】${r.sectionId}\n${r.content}\n(スコア: ${(r.combinedScore * 100).toFixed(1)}%)`
  ).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `バスケットボール競技規則の専門家として、厳格に判定してください。

【判定基準（厳格版）】
○: 検索結果と問題文が完全一致する場合のみ
×: 以下の場合は全て×
  - 数値が1つでも違う
  - 否定形の有無が違う（できる/できない、ある/ない）
  - 「全て」vs「一部」など範囲が違う
  - 検索結果に該当記述がない
  - 検索結果が曖昧・部分的

**疑わしきは×。偽陽性（誤りを○と判定）を絶対に避けること。**
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

const testSubset = async () => {
  console.log('='.repeat(60));
  console.log('小サンプルテスト（不正解69問のみ）');
  console.log('改善: 偽陽性削減プロンプト');
  console.log('='.repeat(60));
  console.log();

  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );

  let improved = 0;
  let stillWrong = 0;
  let nowWorse = 0;

  for (let i = 0; i < failedQuestions.length; i++) {
    const q = failedQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/${failedQuestions.length})...`);

    const results = await searchRules(q.question_text, 3);
    const newAnswer = await getAIJudgment(q.question_text, results);

    const wasWrong = q.ai_answer !== q.correct_answer;
    const isNowCorrect = newAnswer === q.correct_answer;

    if (wasWrong && isNowCorrect) {
      improved++;
      console.log(` ✓ 改善 (${q.ai_answer}→${newAnswer}, 正解:${q.correct_answer})`);
    } else if (wasWrong && !isNowCorrect) {
      stillWrong++;
      console.log(` - 変化なし (${q.ai_answer}→${newAnswer}, 正解:${q.correct_answer})`);
    } else {
      nowWorse++;
      console.log(` ✗ 悪化 (${q.ai_answer}→${newAnswer}, 正解:${q.correct_answer})`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`改善: ${improved}問`);
  console.log(`変化なし: ${stillWrong}問`);
  console.log(`悪化: ${nowWorse}問`);
  console.log(`\n改善率: ${(improved / failedQuestions.length * 100).toFixed(1)}%`);
};

testSubset().catch(console.error);
