import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 厳格版プロンプト
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

const testCorrectSubset = async () => {
  console.log('='.repeat(60));
  console.log('正解維持テスト（正解していた109問）');
  console.log('目的: 厳格プロンプトが既存正解を壊さないか確認');
  console.log('='.repeat(60));
  console.log();

  const correctQuestions = JSON.parse(
    fs.readFileSync('tests/data/correct_questions_subset.json', 'utf-8')
  );

  let stillCorrect = 0;
  let nowWrong = 0;
  const brokenQuestions: any[] = [];

  for (let i = 0; i < correctQuestions.length; i++) {
    const q = correctQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/${correctQuestions.length})...`);

    const results = await searchRules(q.question_text, 3);
    const newAnswer = await getAIJudgment(q.question_text, results);

    const isStillCorrect = newAnswer === q.correct_answer;

    if (isStillCorrect) {
      stillCorrect++;
      console.log(` ✓ 維持 (${newAnswer})`);
    } else {
      nowWrong++;
      console.log(` ✗ 悪化 (${q.ai_answer}→${newAnswer}, 正解:${q.correct_answer})`);
      brokenQuestions.push({
        question_number: q.question_number,
        question_text: q.question_text.substring(0, 60),
        correct_answer: q.correct_answer,
        old_answer: q.ai_answer,
        new_answer: newAnswer,
      });
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`正解維持: ${stillCorrect}問 (${(stillCorrect/correctQuestions.length*100).toFixed(1)}%)`);
  console.log(`悪化: ${nowWrong}問 (${(nowWrong/correctQuestions.length*100).toFixed(1)}%)`);

  if (nowWrong > 0) {
    console.log('\n【悪化した問題】');
    brokenQuestions.forEach(q => {
      console.log(`問題${q.question_number}: ${q.question_text}...`);
      console.log(`  正解:${q.correct_answer} / 旧AI:${q.old_answer} → 新AI:${q.new_answer}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('判定');
  console.log('='.repeat(60));

  const acceptable = nowWrong <= 5; // 5問以内の悪化なら許容

  if (acceptable) {
    console.log('✅ 許容範囲内の悪化です');
    console.log(`   改善: 43問 vs 悪化: ${nowWrong}問`);
    console.log(`   ネット改善: ${43 - nowWrong}問`);
    console.log('\n→ 全178問テストに進むことを推奨します');
  } else {
    console.log('⚠️  悪化が大きすぎます');
    console.log(`   改善: 43問 vs 悪化: ${nowWrong}問`);
    console.log('\n→ プロンプトの再調整が必要です');
  }
};

testCorrectSubset().catch(console.error);
