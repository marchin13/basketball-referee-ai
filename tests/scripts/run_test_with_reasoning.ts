import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';
import type { TestQuestion } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ReasoningResult {
  answer: string;
  reasoning: string;
  references: string[];
}

// 判断理由を含めた回答
const getAIJudgmentWithReasoning = async (
  question: string,
  searchResults: any[]
): Promise<ReasoningResult> => {

  if (searchResults.length === 0) {
    return {
      answer: '×',
      reasoning: '関連する条文が見つかりませんでした',
      references: [],
    };
  }

  const context = searchResults.map((r, i) =>
    `【検索結果${i + 1}】${r.sectionId} - ${r.sectionName}\n${r.content}\n(関連度: ${(r.combinedScore * 100).toFixed(1)}%)`
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
    // JSONパース（```json を除去）
    const cleaned = content.replace(/```json\n?|```\n?/g, '');
    const parsed = JSON.parse(cleaned);

    return {
      answer: parsed.answer === '○' ? '○' : '×',
      reasoning: parsed.reasoning || '',
      references: searchResults.map(r => r.sectionId),
    };
  } catch (error) {
    console.error('  [警告] JSON解析失敗、デフォルト判定');
    return {
      answer: '×',
      reasoning: 'AI応答の解析に失敗しました',
      references: searchResults.map(r => r.sectionId),
    };
  }
};

const runTestWithReasoning = async () => {
  console.log('='.repeat(60));
  console.log('推論記録付きテスト（全178問）');
  console.log('='.repeat(60));
  console.log();

  const questions: TestQuestion[] = JSON.parse(
    fs.readFileSync('tests/data/jba_test_questions_178.json', 'utf-8')
  );

  const results: any[] = [];
  let correctCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    process.stdout.write(`問題 ${question.question_number} (${i+1}/${questions.length})...`);

    const startTime = Date.now();
    const searchResults = await searchRules(question.question_text, 3);
    const aiResult = await getAIJudgmentWithReasoning(question.question_text, searchResults);
    const responseTime = Date.now() - startTime;

    const isCorrect = aiResult.answer === question.correct_answer;
    if (isCorrect) correctCount++;

    results.push({
      question_number: question.question_number,
      question_text: question.question_text,
      correct_answer: question.correct_answer,
      ai_answer: aiResult.answer,
      is_correct: isCorrect,
      reasoning: aiResult.reasoning,
      references: aiResult.references.join(', '),
      top_article: searchResults[0]?.sectionId || 'なし',
      confidence_grade: (searchResults[0]?.combinedScore ?? 0) >= 0.9 ? 'A+' :
                        (searchResults[0]?.combinedScore ?? 0) >= 0.75 ? 'A' :
                        (searchResults[0]?.combinedScore ?? 0) >= 0.6 ? 'B' : 'C',
      response_time_ms: responseTime,
    });

    console.log(` ${isCorrect ? '✓' : '✗'} (${aiResult.answer})`);
    if ((i + 1) % 10 === 0) {
      console.log(`   進捗: ${i + 1}/${questions.length} (${(correctCount/(i+1)*100).toFixed(1)}%)\n`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  const accuracy = (correctCount / questions.length) * 100;

  console.log('\n' + '='.repeat(60));
  console.log('結果');
  console.log('='.repeat(60));
  console.log(`正解率: ${accuracy.toFixed(2)}%`);
  console.log(`正解: ${correctCount}/${questions.length}問`);

  // 結果を保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = path.join(process.cwd(), `tests/results/test_with_reasoning_${timestamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total_questions: questions.length,
    correct_count: correctCount,
    accuracy_rate: accuracy,
    results: results,
  }, null, 2));

  console.log(`\n💾 結果を保存: ${resultPath}`);

  // スプレッドシート更新用のPythonスクリプトを呼び出し
  console.log('\n📊 スプレッドシートを更新中...');
  try {
    const { execSync } = require('child_process');
    execSync(`python3 tests/scripts/update_sheet_with_reasoning.py ${resultPath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error('⚠️  スプレッドシート更新失敗');
  }
};

runTestWithReasoning().catch(console.error);
