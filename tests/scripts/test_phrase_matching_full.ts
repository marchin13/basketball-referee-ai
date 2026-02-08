import fs from 'fs';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 現行と同じ判定プロンプト（推論記録版と同一）
const getAIJudgment = async (question: string, searchResults: any[]): Promise<{ answer: string; reasoning: string }> => {
  if (searchResults.length === 0) {
    return { answer: '×', reasoning: '関連する条文が見つかりませんでした' };
  }

  const context = searchResults.map((r: any, i: number) =>
    `【検索結果${i + 1}】${r.sectionId} - ${r.sectionName}\n${r.content}\n(関連度: ${((r.combinedScore || 0) * 100).toFixed(1)}%)`
  ).join('\n\n---\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `バスケットボール競技規則の専門家として判定してください。

【重要】
必ず以下のJSON形式で回答してください：
{
  "answer": "○" または "×",
  "reasoning": "判断理由を日本語で詳しく説明"
}

【判定基準】
1. 明確な誤り → ×
   - 数値が違う
   - 否定形が逆
   - 範囲が違う
2. 趣旨が一致 → ○
3. 判断理由には以下を含める：
   - どの条文を参照したか
   - 問題文のどの部分に注目したか
   - なぜ○または×と判断したか`
    }, {
      role: 'user',
      content: `【問題】${question}\n\n【検索結果】${context}\n\n判定:`
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
  } catch {
    return { answer: '×', reasoning: 'AI応答の解析に失敗' };
  }
};

const main = async () => {
  console.log('='.repeat(60));
  console.log('フレーズマッチング統合テスト（全178問）');
  console.log('変更: rag-v2.ts にn-gramフレーズスコア統合');
  console.log('スコア配分: ベクトル70% + 順位15% + フレーズ15%');
  console.log('='.repeat(60));
  console.log();

  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );
  const correctQuestions = JSON.parse(
    fs.readFileSync('tests/data/correct_questions_subset.json', 'utf-8')
  );

  // --- Phase 1: 不正解69問 ---
  console.log('【Phase 1】不正解69問のテスト');
  console.log('-'.repeat(40));
  let failedImproved = 0;
  let failedStillWrong = 0;

  for (let i = 0; i < failedQuestions.length; i++) {
    const q = failedQuestions[i];
    process.stdout.write(`[不正解] 問題${q.question_number} (${i + 1}/69)...`);

    const results = await searchRules(q.question_text, 3);
    const aiResult = await getAIJudgment(q.question_text, results);

    if (aiResult.answer === q.correct_answer) {
      failedImproved++;
      console.log(` ✓ 改善 (${q.ai_answer}→${aiResult.answer})`);
    } else {
      failedStillWrong++;
      console.log(` - 変化なし`);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`   進捗: ${i + 1}/69 (改善率: ${(failedImproved / (i + 1) * 100).toFixed(1)}%)\n`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log();

  // --- Phase 2: 正解109問 ---
  console.log('【Phase 2】正解109問のリグレッションテスト');
  console.log('-'.repeat(40));
  let correctMaintained = 0;
  let correctBroken = 0;
  const brokenList: any[] = [];

  for (let i = 0; i < correctQuestions.length; i++) {
    const q = correctQuestions[i];
    process.stdout.write(`[正解] 問題${q.question_number} (${i + 1}/109)...`);

    const results = await searchRules(q.question_text, 3);
    const aiResult = await getAIJudgment(q.question_text, results);

    if (aiResult.answer === q.correct_answer) {
      correctMaintained++;
      console.log(` ✓ 維持`);
    } else {
      correctBroken++;
      console.log(` ✗ 悪化 (${q.ai_answer}→${aiResult.answer})`);
      brokenList.push({ num: q.question_number, correct: q.correct_answer, newAI: aiResult.answer });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`   進捗: ${i + 1}/109 (維持率: ${(correctMaintained / (i + 1) * 100).toFixed(1)}%)\n`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  // --- 最終結果 ---
  console.log('\n' + '='.repeat(60));
  console.log('最終結果');
  console.log('='.repeat(60));
  console.log();
  console.log('【不正解69問】');
  console.log(`  改善: ${failedImproved}問`);
  console.log(`  変化なし: ${failedStillWrong}問`);
  console.log();
  console.log('【正解109問】');
  console.log(`  維持: ${correctMaintained}問`);
  console.log(`  悪化: ${correctBroken}問`);
  console.log();

  const netImprovement = failedImproved - correctBroken;
  const newCorrect = correctMaintained + failedImproved;
  const newAccuracy = (newCorrect / 178 * 100);

  console.log('【総合】');
  console.log(`  ネット改善: ${netImprovement > 0 ? '+' : ''}${netImprovement}問`);
  console.log(`  新正解数: ${newCorrect}/178問`);
  console.log(`  新正解率: ${newAccuracy.toFixed(1)}% (元: 61.2%)`);
  console.log();

  if (brokenList.length > 0 && brokenList.length <= 10) {
    console.log('【悪化した問題】');
    brokenList.forEach(q => {
      console.log(`  問題${q.num}: 正解${q.correct} → 新AI${q.newAI}`);
    });
    console.log();
  }

  if (netImprovement >= 20) {
    console.log('✅ 大成功！本番適用を推奨します');
  } else if (netImprovement >= 10) {
    console.log('✅ 良好な改善です。本番適用を検討してください');
  } else if (netImprovement > 0) {
    console.log('⚠️  小幅な改善です。追加のチューニングを検討してください');
  } else {
    console.log('❌ 改善なし、またはリグレッションが大きすぎます');
  }
};

main().catch(console.error);
