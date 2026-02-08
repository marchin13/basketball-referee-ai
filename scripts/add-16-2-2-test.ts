/**
 * 第16条 16-2-2（自チームのバスケットに誤って得点）をテストケースとして追加
 * 
 * これは、アプローチBの準備として、サブセクション分割の効果を検証するためのものです。
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function add16_2_2TestCase() {
  console.log('='.repeat(60));
  console.log('第16条 16-2-2 をテストケースとして追加');
  console.log('='.repeat(60));
  
  // 16-2-2の内容
  const section = {
    section_id: '第16条 16-2-2',
    section_name: '得点・ゴールによる点数（自チームのバスケットへの誤った得点）',
    content: `第16条 得点・ゴールによる点数
16-2 ボールがバスケットに入ったとき

16-2-2
プレーヤーが誤って自チームのバスケットにボールを入れた場合、その得点は相手チームのキャプテンに記録される。

【解説】
自チームのバスケット（守っているバスケット）に誤ってボールを入れてしまった場合、その得点は相手チームに記録されます。これは意図的であるかどうかに関わらず適用されます。

【適用例】
- リバウンドボールを誤って自チームのバスケットに入れてしまった
- パスミスで自チームのバスケットにボールが入った
- ディフェンスプレーヤーがブロックしようとしてボールが自チームのバスケットに入った

このルールにより、どのような状況でも得点の記録が明確になります。`
  };
  
  console.log('\n📝 セクション情報:');
  console.log('ID:', section.section_id);
  console.log('名前:', section.section_name);
  console.log('内容:', section.content.substring(0, 100) + '...\n');
  
  // エンベディング生成
  console.log('🔄 エンベディングを生成中...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: section.content,
  });
  const embedding = embeddingResponse.data[0].embedding;
  console.log('✅ エンベディング生成完了\n');
  
  // データベースに挿入
  console.log('💾 データベースに挿入中...');
  
  // 既存のものを削除（あれば）
  const { error: deleteError } = await supabase
    .from('rule_sections')
    .delete()
    .eq('section_id', section.section_id);
  
  if (deleteError) {
    console.log('⚠️ 既存データなし（正常）');
  } else {
    console.log('🗑️ 既存データを削除しました');
  }
  
  // 新規挿入
  const { data, error } = await supabase
    .from('rule_sections')
    .insert({
      section_id: section.section_id,
      section_name: section.section_name,
      content: section.content,
      embedding: JSON.stringify(embedding)
    })
    .select();
  
  if (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
  
  console.log('✅ データベースに追加完了\n');
  
  // 確認
  const { data: checkData, error: checkError } = await supabase
    .from('rule_sections')
    .select('section_id, section_name')
    .eq('section_id', section.section_id);
  
  if (checkError) {
    console.error('❌ 確認エラー:', checkError);
  } else {
    console.log('🔍 確認結果:');
    console.log(checkData);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 16-2-2のテストケース追加完了！');
  console.log('='.repeat(60));
  console.log('\n次のステップ:');
  console.log('1. rag-v2.ts を lib/ に配置');
  console.log('2. route.ts で import を変更');
  console.log('3. 「自チームのバスケットに誤って得点した場合のルールは？」で検索テスト');
}

add16_2_2TestCase().catch(console.error);
