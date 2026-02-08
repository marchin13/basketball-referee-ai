import fs from 'fs';
import path from 'path';

interface Question {
  question_number: number;
  question_text: string;
  correct_answer: string;
  category: string;
  difficulty: string;
  explanation: string;
}

const fixJsonData = () => {
  const jsonPath = path.join(process.cwd(), 'tests/data/jba_test_questions_178.json');
  const data: Question[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`📂 ${data.length}問を読み込みました`);

  let fixedCount = 0;
  let alreadyOk = 0;

  const fixed = data.map((q, index) => {
    // 既に正解がある場合はスキップ
    if (q.correct_answer !== '') {
      alreadyOk++;
      return q;
    }

    const text = q.question_text;

    // パターン1: 問題文 ○/×/〇/◯/○ 第XX条 ... 難易度 ルール/インプリ XX-XX
    // ○(U+25CB) or ○(U+2B55) or × or 〇(U+3007) or ◯(U+25EF) を探す
    const match = text.match(/^([\s\S]+?)\s+([○×〇◯\u25CB])\s+(第[\d０-９]+条[\s\S]*?)$/)
      // パターン2: 別添資料F パターン
      || text.match(/^([\s\S]+?)\s+([○×〇◯\u25CB])\s+(別添資料[\s\S]*?)$/);

    if (match) {
      const questionText = match[1].trim();
      const answer = (match[2] === '〇' || match[2] === '◯' || match[2] === '\u25CB') ? '○' : match[2];
      const remainder = match[3].trim();

      // 難易度を抽出 (A, B, C, D)
      const diffMatch = remainder.match(/\s([A-D])\s/);
      const difficulty = diffMatch ? diffMatch[1] : '';

      // カテゴリ（条文名 or 別添資料）を抽出
      const catMatch = remainder.match(/^(第\d+条[^A-D]*)/) || remainder.match(/^(別添資料[^A-D]*)/);
      const category = catMatch ? catMatch[1].trim() : '';

      // 解説を抽出（インプリ/ルール番号の後の文章）
      const explMatch = remainder.match(/(?:ルール|インプリ)\s*[\w\d\-\/,\s]+\s*([\s\S]*)/)
        || remainder.match(/\d+\s+([\s\S]+)$/);
      const explanation = explMatch ? explMatch[1].trim() : '';

      fixedCount++;

      return {
        ...q,
        question_text: questionText,
        correct_answer: answer,
        category: category || q.category,
        difficulty: difficulty || q.difficulty,
        explanation: explanation || q.explanation,
      };
    }

    // パターンにマッチしない場合
    console.log(`⚠️ パース失敗 [${index + 1}]: ${text.slice(-150)}`);
    return q;
  });

  console.log(`\n📊 結果:`);
  console.log(`   既に正解あり: ${alreadyOk}問`);
  console.log(`   修正した: ${fixedCount}問`);
  console.log(`   未修正: ${data.length - alreadyOk - fixedCount}問`);

  // 正解の分布
  const answerDist = fixed.reduce((acc, q) => {
    acc[q.correct_answer] = (acc[q.correct_answer] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`\n📊 正解分布:`, answerDist);

  // 保存
  const outputPath = path.join(process.cwd(), 'tests/data/jba_test_questions_178.json');
  fs.writeFileSync(outputPath, JSON.stringify(fixed, null, 2));
  console.log(`\n💾 修正済みデータを保存: ${outputPath}`);

  // 修正後のサンプルを表示
  console.log(`\n--- 修正サンプル ---`);
  fixed.filter(q => q.correct_answer !== '').slice(0, 5).forEach((q, i) => {
    console.log(`[${i + 1}] 正解:${q.correct_answer} 難易度:${q.difficulty} カテゴリ:${q.category}`);
    console.log(`    ${q.question_text.substring(0, 80)}...`);
    console.log();
  });
};

fixJsonData();
