import { searchRules } from '../../lib/rag-v2';

const testPhraseV2 = async () => {
  console.log('='.repeat(60));
  console.log('フレーズマッチングv2テスト（厳格版）');
  console.log('='.repeat(60));
  console.log();

  const testQueries = [
    '5個のファウルで失格',
    'テーブルオフィシャルズのみ',
    '20分前にチームベンチに報告',
    '24秒以内にシュート',
  ];

  for (const query of testQueries) {
    console.log(`\n質問: "${query}"`);
    console.log('-'.repeat(40));

    const results = await searchRules(query, 3);

    results.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.sectionId}`);
      console.log(`   総合: ${(r.combinedScore! * 100).toFixed(1)}% | フレーズ: ${(r.phraseScore! * 100).toFixed(1)}%`);
      console.log(`   一致: ${r.matchingPhrases?.join(', ') || 'なし'}`);
      console.log(`   不一致: ${(r as any).missedPhrases?.join(', ') || 'なし'}`);
    });

    await new Promise(r => setTimeout(r, 500));
  }
};

testPhraseV2().catch(console.error);
