import { searchRules } from '../../lib/rag-v2';

const testPhraseMatching = async () => {
  console.log('='.repeat(60));
  console.log('フレーズマッチングテスト');
  console.log('='.repeat(60));
  console.log();

  const testQueries = [
    '5個のファウルで失格',
    '24秒ルール',
    'テーブルオフィシャルズのみ',
    '20分前にチームベンチに報告',
  ];

  for (const query of testQueries) {
    console.log(`\n質問: "${query}"`);
    console.log('-'.repeat(40));

    const results = await searchRules(query, 3);

    results.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.sectionId} - ${r.sectionName}`);
      console.log(`   総合スコア: ${(r.combinedScore! * 100).toFixed(1)}%`);
      console.log(`   フレーズスコア: ${(r.phraseScore! * 100).toFixed(1)}%`);
      console.log(`   一致フレーズ: ${r.matchingPhrases?.slice(0, 3).join(', ') || 'なし'}`);
      console.log(`   内容: ${r.content.substring(0, 60)}...`);
    });

    await new Promise(r => setTimeout(r, 500));
  }
};

testPhraseMatching().catch(console.error);
