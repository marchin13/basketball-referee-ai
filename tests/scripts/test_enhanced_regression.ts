import fs from 'fs';
import OpenAI from 'openai';
import { enhancedSearch } from './enhanced_search';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getAIJudgmentEnhanced = async (question: string, searchData: any): Promise<{ answer: string; reasoning: string }> => {
  const { results, detailCheck } = searchData;

  if (results.length === 0) {
    return { answer: '×', reasoning: '関連する条文が見つかりませんでした' };
  }

  const context = results.map((r: any, i: number) =>
    `【検索結果${i + 1}】${r.sectionId}\n${r.content}\n(関連度: ${(r.combinedScore * 100).toFixed(1)}%)`
  ).join('\n\n---\n\n');

  let detailWarning = '';
  if (detailCheck.hasIssues) {
    detailWarning = '\n\n【注意事項】\n' + detailCheck.issues.map((issue: string) => `- ${issue}`).join('\n');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `バスケットボール競技規則の専門家として判定してください。

【判定フロー】
Step 1: 明確な誤りチェック
  - 数値が違う → ×
  - 否定形が逆 → ×
  - 限定条件が違う（「のみ」の有無など） → ×
  - 時間条件が違う → ×

Step 2: 趣旨の一致チェック
  - 表現は違っても意味が同じ → ○
  - 部分的に一致し矛盾なし → ○

【出力形式】
{
  "answer": "○" または "×",
  "reasoning": "判断理由を詳しく"
}

**細部の条件（数値、時間、限定詞）に特に注意してください。**`
    }, {
      role: 'user',
      content: `【問題】${question}\n\n【検索結果】${context}${detailWarning}\n\n判定:`
    }],
    temperature: 0,
    max_tokens: 300,
  });

  try {
    const content = response.choices[0]?.message?.content?.trim() || '';
    const cleaned = content.replace(/```json\n?|```\n?/g, '');
    const parsed = JSON.parse(cleaned);
    return {
      answer: parsed.answer === '○' ? '○' : '×',
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    return { answer: '×', reasoning: 'AI応答の解析に失敗' };
  }
};

const testRegression = async () => {
  console.log('='.repeat(60));
  console.log('リグレッションテスト（正解109問）');
  console.log('目的: 拡張検索が既存正解を壊さないか確認');
  console.log('='.repeat(60));
  console.log();

  const correctQuestions = JSON.parse(
    fs.readFileSync('tests/data/correct_questions_subset.json', 'utf-8')
  );

  let maintained = 0;
  let broken = 0;
  const brokenQuestions: any[] = [];

  for (let i = 0; i < correctQuestions.length; i++) {
    const q = correctQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/${correctQuestions.length})...`);

    const searchData = await enhancedSearch(q.question_text);
    const aiResult = await getAIJudgmentEnhanced(q.question_text, searchData);

    const isStillCorrect = aiResult.answer === q.correct_answer;

    if (isStillCorrect) {
      maintained++;
      console.log(` ✓ 維持`);
    } else {
      broken++;
      console.log(` ✗ 悪化 (${q.ai_answer}→${aiResult.answer}, 正解:${q.correct_answer})`);
      brokenQuestions.push({
        question_number: q.question_number,
        question_text: q.question_text.substring(0, 60),
        correct_answer: q.correct_answer,
        old_answer: q.ai_answer,
        new_answer: aiResult.answer,
      });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`   進捗: ${i + 1}/${correctQuestions.length} (維持率: ${(maintained/(i+1)*100).toFixed(1)}%)\n`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('リグレッション結果');
  console.log('='.repeat(60));
  console.log(`正解維持: ${maintained}/${correctQuestions.length}問 (${(maintained/correctQuestions.length*100).toFixed(1)}%)`);
  console.log(`悪化: ${broken}/${correctQuestions.length}問 (${(broken/correctQuestions.length*100).toFixed(1)}%)`);

  if (brokenQuestions.length > 0 && brokenQuestions.length <= 10) {
    console.log('\n【悪化した問題】');
    brokenQuestions.forEach(q => {
      console.log(`  問題${q.question_number}: ${q.question_text}...`);
      console.log(`    正解:${q.correct_answer} / 旧AI:${q.old_answer} → 新AI:${q.new_answer}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('総合評価');
  console.log('='.repeat(60));
  console.log(`不正解の改善: +37問`);
  console.log(`正解の悪化: -${broken}問`);
  console.log(`ネット改善: ${37 - broken}問`);
  console.log();
  console.log(`【最終推定正解率】`);
  const finalCorrect = maintained + 37;
  console.log(`  ${finalCorrect}/178問 = ${(finalCorrect/178*100).toFixed(1)}%`);
  console.log();

  if (37 - broken >= 20) {
    console.log('✅ 大成功！ネット+20問以上の改善です');
    console.log('   全178問の本番テストに進むことを推奨します');
  } else if (37 - broken >= 10) {
    console.log('✅ 良好な改善です');
    console.log('   全178問の本番テストに進めます');
  } else {
    console.log('⚠️  リグレッションが大きいです');
    console.log('   プロンプトの再調整を検討してください');
  }
};

testRegression().catch(console.error);
