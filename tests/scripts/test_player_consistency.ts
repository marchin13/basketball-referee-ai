import fs from 'fs';
import path from 'path';
import { extractPlayerActions, checkConsistency } from './player_consistency_check';

const testPlayerConsistency = async () => {
  console.log('='.repeat(60));
  console.log('登場人物整合性チェック（不正解10問サンプル）');
  console.log('='.repeat(60));
  console.log();

  const failedQuestions = JSON.parse(
    fs.readFileSync('tests/data/failed_questions_subset.json', 'utf-8')
  );

  let foundInconsistencies = 0;
  const inconsistentQuestions: any[] = [];

  for (let i = 0; i < Math.min(10, failedQuestions.length); i++) {
    const q = failedQuestions[i];

    console.log(`\n問題${q.question_number}:`);
    console.log(`  ${q.question_text.substring(0, 80)}...`);
    console.log(`  正解: ${q.correct_answer} / AI回答: ${q.ai_answer}`);

    const actions = await extractPlayerActions(q.question_text);

    if (actions.length > 0) {
      console.log('  登場人物・行動:');
      actions.forEach((a: any) => {
        console.log(`    - ${a.player}: ${a.action}${a.object ? ` → ${a.object}` : ''}${a.result ? ` (${a.result})` : ''}`);
      });

      const check = checkConsistency(actions);
      if (check.hasInconsistency) {
        foundInconsistencies++;
        console.log(`  ⚠️  不整合検出: ${check.reason}`);
        inconsistentQuestions.push({
          question_number: q.question_number,
          ...check,
        });
      } else {
        console.log('  ✓ 整合性OK（または判定不可）');
      }
    } else {
      console.log('  - 登場人物抽出失敗');
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('結果サマリー');
  console.log('='.repeat(60));
  console.log(`不整合検出: ${foundInconsistencies}/10問`);

  if (inconsistentQuestions.length > 0) {
    console.log('\n【不整合が見つかった問題】');
    inconsistentQuestions.forEach(q => {
      console.log(`  問題${q.question_number}: ${q.contactPlayer}が接触したのに${q.foulPlayer}にファウル`);
    });

    console.log('\n💡 この検出ロジックを判定に組み込めば、これらの問題を正解できる可能性があります');
  } else {
    console.log('\n→ 今回のサンプルでは登場人物の不整合は検出されませんでした');
    console.log('   他のパターンの誤りである可能性が高いです');
  }
};

testPlayerConsistency().catch(console.error);
