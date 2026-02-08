import fs from 'fs';
import path from 'path';

const extractFailedQuestions = () => {
  // 最新のテスト結果を読み込み
  const resultsDir = path.join(process.cwd(), 'tests/results');
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('test_run_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('❌ テスト結果ファイルが見つかりません');
    process.exit(1);
  }

  const latestFile = files[0];
  const resultPath = path.join(resultsDir, latestFile);

  console.log(`📂 最新結果を読み込み: ${latestFile}\n`);

  const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  const failedResults = data.results.filter((r: any) => !r.is_correct);

  console.log(`総問題数: ${data.results.length}`);
  console.log(`正解: ${data.correct_count}問`);
  console.log(`不正解: ${failedResults.length}問`);
  console.log(`正解率: ${data.accuracy_rate.toFixed(2)}%\n`);

  // 不正解問題のみを抽出
  const failedQuestions = failedResults.map((r: any) => ({
    question_number: r.question_number,
    question_text: r.question_text,
    correct_answer: r.correct_answer,
    ai_answer: r.ai_answer,
    confidence_grade: r.confidence_grade,
    top_article: r.top_article,
  }));

  // 保存
  const outputPath = path.join(process.cwd(), 'tests/data/failed_questions_subset.json');
  fs.writeFileSync(outputPath, JSON.stringify(failedQuestions, null, 2));

  console.log(`💾 不正解問題を保存: ${outputPath}`);
  console.log(`\n📊 この${failedQuestions.length}問だけで次の改善をテストします`);

  // サンプル表示
  console.log('\n=== 不正解問題サンプル（最初の5問） ===');
  failedQuestions.slice(0, 5).forEach((q: any) => {
    console.log(`\n問題${q.question_number}:`);
    console.log(`  ${q.question_text.substring(0, 60)}...`);
    console.log(`  正解: ${q.correct_answer} / AI回答: ${q.ai_answer} / 信頼度: ${q.confidence_grade}`);
  });
};

extractFailedQuestions();
