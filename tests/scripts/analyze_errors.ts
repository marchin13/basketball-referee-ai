import fs from 'fs';
import path from 'path';

interface TestResult {
  question_number: number;
  question_text: string;
  correct_answer: string;
  ai_answer: string;
  is_correct: boolean;
  confidence_grade: string;
  search_results: any[];
  top_article: string;
}

interface ErrorPattern {
  pattern_type: string;
  count: number;
  questions: number[];
  examples: TestResult[];
  suggested_fix: string;
}

const analyzeErrors = () => {
  // 最新のテスト結果を読み込み
  const resultsDir = path.join(process.cwd(), 'tests/results');
  const files = fs.readdirSync(resultsDir).filter(f => f.startsWith('test_run_'));
  const latestFile = files.sort().reverse()[0];
  const resultPath = path.join(resultsDir, latestFile);

  const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  const results: TestResult[] = data.results;

  console.log('='.repeat(60));
  console.log('エラー分析レポート');
  console.log('='.repeat(60));
  console.log();
  console.log(`テスト実行: ${data.timestamp}`);
  console.log(`正解率: ${data.accuracy_rate.toFixed(2)}%`);
  console.log(`不正解: ${data.incorrect_count}問\n`);

  // 不正解問題を抽出
  const errors = results.filter(r => !r.is_correct);

  // パターン1: 検索失敗（結果が0件）
  const searchFailures = errors.filter(r => r.search_results.length === 0);

  // パターン2: 低信頼度（C）
  const lowConfidence = errors.filter(r => r.confidence_grade === 'C' && r.search_results.length > 0);

  // パターン3: 中信頼度（B）
  const mediumConfidence = errors.filter(r => r.confidence_grade === 'B');

  // パターン4: 高信頼度だが誤答（A, A+）
  const highConfidenceErrors = errors.filter(r => ['A', 'A+'].includes(r.confidence_grade));

  // パターン5: ○を×と誤判定
  const falseNegatives = errors.filter(r => r.correct_answer === '○' && r.ai_answer === '×');

  // パターン6: ×を○と誤判定
  const falsePositives = errors.filter(r => r.correct_answer === '×' && r.ai_answer === '○');

  const errorPatterns: ErrorPattern[] = [
    {
      pattern_type: '検索失敗（結果0件）',
      count: searchFailures.length,
      questions: searchFailures.map(r => r.question_number),
      examples: searchFailures.slice(0, 3),
      suggested_fix: 'キーワード抽出ロジックの改善、同義語辞書の追加',
    },
    {
      pattern_type: '低信頼度検索（C）',
      count: lowConfidence.length,
      questions: lowConfidence.map(r => r.question_number),
      examples: lowConfidence.slice(0, 3),
      suggested_fix: 'ベクトル検索の重み調整、キーワード検索の強化',
    },
    {
      pattern_type: '中信頼度（B）',
      count: mediumConfidence.length,
      questions: mediumConfidence.map(r => r.question_number),
      examples: mediumConfidence.slice(0, 3),
      suggested_fix: '検索結果の順位調整、複数候補の再評価',
    },
    {
      pattern_type: '高信頼度だが誤答（A/A+）',
      count: highConfidenceErrors.length,
      questions: highConfidenceErrors.map(r => r.question_number),
      examples: highConfidenceErrors.slice(0, 3),
      suggested_fix: 'LLM判定プロンプトの改善、Few-shot例の追加',
    },
    {
      pattern_type: '偽陰性（○→×）',
      count: falseNegatives.length,
      questions: falseNegatives.map(r => r.question_number),
      examples: falseNegatives.slice(0, 3),
      suggested_fix: 'プロンプトで「正しい記述も存在する」ことを強調',
    },
    {
      pattern_type: '偽陽性（×→○）',
      count: falsePositives.length,
      questions: falsePositives.map(r => r.question_number),
      examples: falsePositives.slice(0, 3),
      suggested_fix: '否定形・数値の厳密チェック、批判的読解の強化',
    },
  ];

  // レポート出力
  console.log('【エラーパターン分析】\n');
  errorPatterns.forEach((pattern, index) => {
    if (pattern.count > 0) {
      console.log(`${index + 1}. ${pattern.pattern_type}: ${pattern.count}問`);
      console.log(`   問題番号: ${pattern.questions.slice(0, 10).join(', ')}${pattern.questions.length > 10 ? '...' : ''}`);
      console.log(`   改善案: ${pattern.suggested_fix}`);

      if (pattern.examples.length > 0) {
        console.log(`   例:`);
        pattern.examples.forEach(ex => {
          console.log(`     問${ex.question_number}: ${ex.question_text.substring(0, 50)}...`);
          console.log(`       正解:${ex.correct_answer} / AI:${ex.ai_answer} / 信頼度:${ex.confidence_grade}`);
        });
      }
      console.log();
    }
  });

  // 優先順位の提案
  console.log('='.repeat(60));
  console.log('【改善の優先順位】');
  console.log('='.repeat(60));
  console.log();

  const prioritized = errorPatterns
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);

  prioritized.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.pattern_type} (${pattern.count}問, ${(pattern.count / errors.length * 100).toFixed(1)}%)`);
    console.log(`   → ${pattern.suggested_fix}\n`);
  });

  // 詳細レポートをJSONで保存
  const reportPath = path.join(process.cwd(), 'tests/results/error_analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    test_file: latestFile,
    total_errors: errors.length,
    patterns: errorPatterns,
  }, null, 2));

  console.log(`\n💾 詳細レポートを保存: ${reportPath}`);
};

analyzeErrors();
