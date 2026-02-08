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

const testAllFailed = async () => {
  console.log('='.repeat(60));
  console.log('拡張検索テスト（不正解69問すべて）');
  console.log('='.repeat(60));
  console.log();

  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );

  let improved = 0;
  let stillWrong = 0;

  for (let i = 0; i < failedQuestions.length; i++) {
    const q = failedQuestions[i];
    process.stdout.write(`問題${q.question_number} (${i+1}/${failedQuestions.length})...`);

    const searchData = await enhancedSearch(q.question_text);
    const aiResult = await getAIJudgmentEnhanced(q.question_text, searchData);

    const isNowCorrect = aiResult.answer === q.correct_answer;

    if (isNowCorrect) {
      improved++;
      console.log(` ✓ 改善 (${q.ai_answer}→${aiResult.answer})`);
    } else {
      stillWrong++;
      console.log(` - 変化なし (${aiResult.answer})`);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`   進捗: ${i + 1}/${failedQuestions.length} (改善率: ${(improved/(i+1)*100).toFixed(1)}%)\n`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('最終結果');
  console.log('='.repeat(60));
  console.log(`改善: ${improved}/${failedQuestions.length}問`);
  console.log(`変化なし: ${stillWrong}/${failedQuestions.length}問`);
  console.log(`改善率: ${(improved / failedQuestions.length * 100).toFixed(1)}%`);
  console.log();
  console.log(`【推定全体正解率】`);
  console.log(`  現在の正解: 109問`);
  console.log(`  不正解から改善: +${improved}問`);
  console.log(`  新正解数: ${109 + improved}/178問`);
  console.log(`  推定正解率: ${((109 + improved) / 178 * 100).toFixed(1)}%`);
};

testAllFailed().catch(console.error);
