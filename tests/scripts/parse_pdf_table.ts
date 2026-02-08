import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

interface Question {
  question_number: number;
  chapter: string;
  chapter_question_number: number;
  question_text: string;
  correct_answer: string;
  category: string;
  difficulty: string;
  rule_reference: string;
  explanation: string;
}

// ○の文字コード正規化
const normalizeAnswer = (text: string): string => {
  const normalized = text.trim();

  // ○の各種バリエーション
  const maruVariants = ['○', '◯', '〇', '⭕', 'O', 'o'];
  const batsuVariants = ['×', '✕', '✖', 'X', 'x'];

  // ○系の文字があれば○に統一
  for (const variant of maruVariants) {
    if (normalized.includes(variant)) {
      return '○';
    }
  }

  // ×系の文字があれば×に統一
  for (const variant of batsuVariants) {
    if (normalized.includes(variant)) {
      return '×';
    }
  }

  return normalized;
};

const parsePDFTable = async () => {
  const pdfPath = path.join(process.cwd(), 'tests/data/2025_jba_rule_test.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDFファイルが見つかりません');
    console.log('   以下のコマンドでPDFを配置してください:');
    console.log('   cp ~/Downloads/2025_jba_rule_test.pdf tests/data/');
    process.exit(1);
  }

  console.log('📄 PDFを読み込んでいます...');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  console.log(`✅ PDF読み込み成功（${pdf.numPages}ページ）\n`);

  const questions: Question[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    console.log(`ページ ${pageNum}/${pdf.numPages} 処理中...`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // X座標とY座標でアイテムをグループ化
    interface CellItem {
      x: number;
      y: number;
      text: string;
    }

    const cells: CellItem[] = textContent.items.map((item: any) => ({
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      text: item.str,
    }));

    // デバッグ: 最初のページで文字コードを確認
    if (pageNum === 1) {
      console.log('\n=== 文字コードチェック（最初の100文字） ===');
      const sample = cells.slice(0, 100).map(c => c.text).join('');
      console.log(sample.substring(0, 200));

      // ○と×のUnicodeを確認
      const maruChars = cells.filter(c => c.text.match(/[○◯〇⭕O]/));
      const batsuChars = cells.filter(c => c.text.match(/[×✕✖X]/));
      console.log(`\n○系文字検出: ${maruChars.length}個`);
      if (maruChars.length > 0) {
        console.log(`サンプル: "${maruChars[0].text}" (Unicode: U+${maruChars[0].text.charCodeAt(0).toString(16).toUpperCase()})`);
      }
      console.log(`×系文字検出: ${batsuChars.length}個`);
      if (batsuChars.length > 0) {
        console.log(`サンプル: "${batsuChars[0].text}" (Unicode: U+${batsuChars[0].text.charCodeAt(0).toString(16).toUpperCase()})`);
      }
      console.log('=====================================\n');
    }

    // Y座標で行をグループ化
    const rowMap = new Map<number, CellItem[]>();
    cells.forEach(cell => {
      const existingRow = Array.from(rowMap.keys()).find(y => Math.abs(y - cell.y) < 5);
      const rowKey = existingRow !== undefined ? existingRow : cell.y;

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, []);
      }
      rowMap.get(rowKey)!.push(cell);
    });

    // 行をY座標でソート
    const sortedRows = Array.from(rowMap.entries())
      .sort((a, b) => b[0] - a[0]);

    // 各行を処理
    for (const [y, rowCells] of sortedRows) {
      const sortedCells = rowCells.sort((a, b) => a.x - b.x);

      const columns: string[] = [];
      let currentColumn = '';
      let lastX = -1;

      sortedCells.forEach(cell => {
        if (lastX !== -1 && cell.x - lastX > 20) {
          columns.push(currentColumn.trim());
          currentColumn = '';
        }
        currentColumn += cell.text + ' ';
        lastX = cell.x;
      });

      if (currentColumn.trim()) {
        columns.push(currentColumn.trim());
      }

      // 行が問題データかチェック
      if (columns.length >= 5) {
        if (columns[0] === '問題' || columns[1] === '問題') {
          continue;
        }

        const questionNum = parseInt(columns[0]);
        if (isNaN(questionNum)) {
          continue;
        }

        const chapter = columns.length > 1 ? columns[1] : '';
        const chapterQuestionNum = columns.length > 2 ? parseInt(columns[2]) || 0 : 0;
        const questionText = columns.length > 3 ? columns[3] : '';
        const rawAnswer = columns.length > 4 ? columns[4] : '';
        const category = columns.length > 5 ? columns[5] : '';
        const difficulty = columns.length > 6 ? columns[6] : '';
        const ruleReference = columns.length > 7 ? columns[7] : '';
        const explanation = columns.length > 8 ? columns[8] : '';

        // 文字コードを正規化
        const correctAnswer = normalizeAnswer(rawAnswer);

        // 正解が○または×であることを確認
        if (correctAnswer === '○' || correctAnswer === '×') {
          questions.push({
            question_number: questionNum,
            chapter: chapter,
            chapter_question_number: chapterQuestionNum,
            question_text: questionText,
            correct_answer: correctAnswer,
            category: category,
            difficulty: difficulty,
            rule_reference: ruleReference,
            explanation: explanation,
          });

          if (questions.length <= 5) {
            console.log(`  問題${questionNum}を抽出: ${correctAnswer} (元: "${rawAnswer}")`);
          }
        }
      }
    }
  }

  console.log(`\n✅ ${questions.length}問を抽出しました`);

  // 統計
  const maruCount = questions.filter(q => q.correct_answer === '○').length;
  const batsuCount = questions.filter(q => q.correct_answer === '×').length;

  console.log('\n統計:');
  console.log(`  ○: ${maruCount}`);
  console.log(`  ×: ${batsuCount}`);

  // 保存
  const outputPath = path.join(process.cwd(), 'tests/data/jba_test_questions_178_from_pdf.json');
  fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));
  console.log(`\n💾 保存: ${outputPath}`);

  // サンプルを表示
  console.log('\n=== サンプル（最初の3問） ===');
  questions.slice(0, 3).forEach(q => {
    console.log(`問題${q.question_number}: ${q.question_text.substring(0, 50)}...`);
    console.log(`  正解: ${q.correct_answer}`);
    console.log(`  分類: ${q.category}`);
    console.log('');
  });
};

parsePDFTable().catch(console.error);
