import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import { searchRules } from '../../lib/rag-v2';
import type { TestQuestion, TestResult, TestRunSummary } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o';
const SEARCH_COUNT = 5; // v4: 少数精鋭（ベクトル候補は内部で15件取得）

// v4: 信頼度グレード（80/20スコアリングに合わせた閾値）
const calculateConfidenceGrade = (combinedScore?: number): string => {
  if (!combinedScore) return 'C';
  if (combinedScore >= 0.80) return 'A+';
  if (combinedScore >= 0.65) return 'A';
  if (combinedScore >= 0.50) return 'B';
  return 'C';
};

// 178問のデータを読み込み
const loadTestQuestions = (): TestQuestion[] => {
  const jsonPath = path.join(process.cwd(), 'tests/data/jba_test_questions_178.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ファイルが見つかりません: ${jsonPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
};

// v6: LLM判定（gpt-4o + 5件検索 + ベクトル優先80/20 + v3厳格プロンプト）
const getAIJudgment = async (question: string, searchResults: any[]): Promise<string> => {
  if (searchResults.length === 0) {
    return '×';
  }

  const context = searchResults.map((r, i) =>
    `【${i + 1}】${r.sectionId} - ${r.sectionName} (${((r.combinedScore || 0) * 100).toFixed(0)}%)\n${r.content}`
  ).join('\n\n---\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `あなたはJBA競技規則の審判試験問題を採点する専門家です。

【タスク】問題文がJBA競技規則に照らして正しい（○）か誤り（×）かを判定する。

【統計】この試験は○が約47%、×が約53%です。偏りなく判定してください。

【判定手順】
1. 問題文の全ての主張を分解する（複数の主張がある場合がある）
2. 各主張について、検索結果のルールと照合する
3. 全ての主張が正しければ○、1つでも誤りがあれば×

【×と判定すべき典型パターン】
- 数値の相違（例: 5個→6個、14秒→24秒、20分→30分）
- 主語・対象の入れ替え（例: 「タイマーがショットクロックを操作」→実際は別の役職）
- 条件の過大/過小（例: 「いつでも」「全て」「のみ」が付加されている）
- 罰則の誤り（例: フリースロー本数、スローイン位置、ショットクロック秒数の誤り）
- 手続きの順序の誤り

【○と判定すべき典型パターン】
- ルール原文とほぼ同じ内容
- 検索結果で直接支持される記述
- 複合文で全ての部分が正しい場合（一部が検索結果にないだけでは×にしない）

【出力形式】
理由を2〜3文で述べ、最後に「判定: ○」または「判定: ×」と書く。`,
        },
        // Few-shot: ○の例（ルール原文一致）
        {
          role: 'user',
          content: `問題: "競技時間中、5個のファウルを宣せられプレーをする資格を失ったチームメンバーは、以降そのゲームに出場することはできないが、チームベンチに座ることは許される。"
検索結果: "プレーヤーが5個のファウルを宣せられた場合、そのゲームの残りの時間プレーをすることはできない。チームベンチに座ることは許される。"`,
        },
        { role: 'assistant', content: `ルールに「5個のファウルでプレー不可」「チームベンチに座ることは許される」と明記されており、問題文の両方の主張が一致します。\n判定: ○` },
        // Few-shot: ×の例（数値の誤り）
        {
          role: 'user',
          content: `問題: "審判とゲームの関係は、ゲーム開始予定時刻の30分前に始まる"
検索結果: "審判とゲームの関係は、ゲーム開始予定時刻の20分前に始まる"`,
        },
        { role: 'assistant', content: `ルールでは「20分前」ですが問題文は「30分前」としており数値が異なります。\n判定: ×` },
        // Few-shot: ○の例（複合文で部分的に検索にない）
        {
          role: 'user',
          content: `問題: "プレーヤー兼ヘッドコーチがプレーヤーとして5個のファウルを宣せられた場合、プレーをすることはできないが、ヘッドコーチの役割は継続できる。"
検索結果: "5個のファウルでプレーヤーは失格" / "ヘッドコーチとしての資格はプレーヤーの失格とは別"`,
        },
        { role: 'assistant', content: `5個のファウルでプレー不可はルール通り。ヘッドコーチの役割継続も規定上矛盾なし。「検索結果に明示がない」部分があっても矛盾がなければ○です。\n判定: ○` },
        // Few-shot: ×の例（罰則の誤り - 偽陽性対策）
        {
          role: 'user',
          content: `問題: "インタフェアレンスのバイオレーションを宣してA1に1点のみを罰則として与えた"
検索結果: "インタフェアレンスの場合、得点が認められるか、相手チームのスローインとなる"`,
        },
        { role: 'assistant', content: `インタフェアレンスの罰則は「得点を認める」か「スローイン」であり、「1点のみを罰則として与える」という表現はルールと異なります。フリースローの点数とインタフェアレンスの罰則は別の概念です。\n判定: ×` },
        // 実際の問題
        {
          role: 'user',
          content: `【問題】
${question}

【検索結果（関連度順）】
${context}

全ての主張を検証し、判定してください。`,
        },
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const answer = response.choices[0]?.message?.content?.trim() || '';
    const match = answer.match(/判定[:：]\s*([○×])/);
    if (match) return match[1];
    if (answer.includes('○') && !answer.includes('×')) return '○';
    if (answer.includes('×') && !answer.includes('○')) return '×';
    return '×';
  } catch (error) {
    console.error('    [エラー] LLM判定失敗:', error);
    return '×';
  }
};

// 1問ずつテスト実行
const runSingleTest = async (question: TestQuestion): Promise<TestResult> => {
  const startTime = Date.now();
  try {
    const searchResults = await searchRules(question.question_text, SEARCH_COUNT);
    const aiAnswer = await getAIJudgment(question.question_text, searchResults);
    const topArticle = searchResults.length > 0 ? searchResults[0].sectionId : 'なし';
    const confidenceGrade = calculateConfidenceGrade(searchResults[0]?.combinedScore);
    const isCorrect = aiAnswer === question.correct_answer;
    const responseTime = Date.now() - startTime;
    return {
      question_number: question.question_number,
      question_text: question.question_text,
      correct_answer: question.correct_answer,
      ai_answer: aiAnswer,
      is_correct: isCorrect,
      confidence_grade: confidenceGrade,
      search_results: searchResults.map(r => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        combinedScore: r.combinedScore,
      })),
      top_article: topArticle,
      response_time_ms: responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      question_number: question.question_number,
      question_text: question.question_text,
      correct_answer: question.correct_answer,
      ai_answer: 'エラー',
      is_correct: false,
      confidence_grade: 'C',
      search_results: [],
      top_article: 'なし',
      response_time_ms: responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// スプレッドシートを更新
const updateSpreadsheet = (resultPath: string) => {
  console.log('\n📊 スプレッドシートを更新中...');
  try {
    const scriptPath = path.join(process.cwd(), 'tests/scripts/update_sheet_with_results.py');
    execSync(`python3 ${scriptPath} ${resultPath}`, { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ スプレッドシート更新完了');
  } catch (error) {
    console.error('⚠️  スプレッドシート更新に失敗しました');
  }
};

const runTestSuite = async () => {
  console.log('='.repeat(60));
  console.log(`JBA審判試験 178問 (v6: ${MODEL} + ${SEARCH_COUNT}件 + ベクトル優先80/20 + v3厳格プロンプト)`);
  console.log('='.repeat(60));
  console.log();

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY が設定されていません');
    process.exit(1);
  }
  console.log(`✅ 環境変数OK | モデル: ${MODEL} | 検索: ${SEARCH_COUNT}件`);
  console.log();

  const questions = loadTestQuestions();
  console.log(`📚 ${questions.length}問を読み込みました\n`);

  const results: TestResult[] = [];
  let correctCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    process.stdout.write(`問${question.question_number} (${i+1}/${questions.length})...`);

    const result = await runSingleTest(question);
    results.push(result);

    if (result.is_correct) {
      correctCount++;
      console.log(` ✓ (AI:${result.ai_answer})`);
    } else {
      console.log(` ✗ (AI:${result.ai_answer} 正解:${result.correct_answer} ${result.confidence_grade})`);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  -- ${i + 1}/${questions.length} 正解率: ${(correctCount / (i + 1) * 100).toFixed(1)}%\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n' + '='.repeat(60));
  console.log('テスト完了');
  console.log('='.repeat(60));

  const totalTime = results.reduce((sum, r) => sum + r.response_time_ms, 0);
  const summary: TestRunSummary = {
    timestamp: new Date().toISOString(),
    total_questions: questions.length,
    correct_count: correctCount,
    incorrect_count: questions.length - correctCount,
    accuracy_rate: (correctCount / questions.length) * 100,
    avg_response_time_ms: totalTime / questions.length,
    results,
    error_patterns: [],
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = path.join(process.cwd(), `tests/results/test_run_${timestamp}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2));

  console.log(`\n📊 結果: ${summary.correct_count}/${summary.total_questions} (${summary.accuracy_rate.toFixed(2)}%)`);
  console.log(`⏱  平均: ${summary.avg_response_time_ms.toFixed(0)}ms`);
  console.log(`💾 保存: ${resultPath}`);

  updateSpreadsheet(resultPath);
  return summary;
};

runTestSuite()
  .then(() => { console.log('\n✅ 完了'); process.exit(0); })
  .catch((e) => { console.error('\n❌ 失敗:', e); process.exit(1); });
