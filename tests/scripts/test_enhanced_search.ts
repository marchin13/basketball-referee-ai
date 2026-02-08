import fs from 'fs';
import OpenAI from 'openai';
import { enhancedSearch, extractKeyTerms, checkDetailedConditions } from './enhanced_search';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 拡張判定（細部チェック込み）
const getAIJudgmentEnhanced = async (question: string, searchData: any): Promise<{ answer: string; reasoning: string }> => {
  const { results, detailCheck } = searchData;

  if (results.length === 0) {
    return {
      answer: '×',
      reasoning: '関連する条文が見つかりませんでした',
    };
  }

  const context = results.map((r: any, i: number) =>
    `【検索結果${i + 1}】${r.sectionId}\n${r.content}\n(関連度: ${(r.combinedScore * 100).toFixed(1)}%)`
  ).join('\n\n---\n\n');

  // 細部チェックの結果を含める
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
    return {
      answer: '×',
      reasoning: 'AI応答の解析に失敗',
    };
  }
};

const testEnhancedSearch = async () => {
  console.log('='.repeat(60));
  console.log('拡張検索テスト（不正解10問）');
  console.log('機能: キーワード強化 + 細部条件チェック');
  console.log('='.repeat(60));
  console.log();

  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );

  let improved = 0;
  let stillWrong = 0;

  for (let i = 0; i < Math.min(10, failedQuestions.length); i++) {
    const q = failedQuestions[i];
    console.log(`\n問題${q.question_number} (${i+1}/10):`);
    console.log(`  ${q.question_text.substring(0, 80)}...`);
    console.log(`  正解: ${q.correct_answer} / 旧AI: ${q.ai_answer}`);

    // 拡張検索
    const searchData = await enhancedSearch(q.question_text);

    // 拡張判定
    const aiResult = await getAIJudgmentEnhanced(q.question_text, searchData);

    console.log(`  新AI: ${aiResult.answer}`);
    console.log(`  理由: ${aiResult.reasoning.substring(0, 100)}...`);

    const isNowCorrect = aiResult.answer === q.correct_answer;

    if (isNowCorrect) {
      improved++;
      console.log('  ✓ 改善！');
    } else {
      stillWrong++;
      console.log('  - 変化なし');
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`改善: ${improved}/10問`);
  console.log(`変化なし: ${stillWrong}/10問`);
  console.log(`\n改善率: ${(improved / 10 * 100).toFixed(1)}%`);

  if (improved >= 3) {
    console.log('\n✅ 効果あり！全問題に適用する価値があります');
  } else {
    console.log('\n⚠️  効果が限定的。他のアプローチも検討が必要');
  }
};

testEnhancedSearch().catch(console.error);
