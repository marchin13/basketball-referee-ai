import fs from 'fs';
import path from 'path';

const extractCorrectQuestions = () => {
  // 最新のテスト結果を読み込み
  const resultsDir = path.join(process.cwd(), 'tests/results');
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('test_run_') && f.endsWith('.json'))
    .sort()
    .reverse();

  const latestFile = files[0];
  const resultPath = path.join(resultsDir, latestFile);

  console.log(`📂 最新結果を読み込み: ${latestFile}\n`);

  const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  const correctResults = data.results.filter((r: any) => r.is_correct);

  console.log(`✅ 正解していた問題: ${correctResults.length}問\n`);

  // 正解問題のみを抽出
  const correctQuestions = correctResults.map((r: any) => ({
    question_number: r.question_number,
    question_text: r.question_text,
    correct_answer: r.correct_answer,
    ai_answer: r.ai_answer,
    confidence_grade: r.confidence_grade,
  }));

  // 保存
  const outputPath = path.join(process.cwd(), 'tests/data/correct_questions_subset.json');
  fs.writeFileSync(outputPath, JSON.stringify(correctQuestions, null, 2));

  console.log(`💾 正解問題を保存: ${outputPath}`);
  console.log(`\n次: この${correctQuestions.length}問で厳格プロンプトが悪影響を与えないかテストします`);
};

extractCorrectQuestions();
