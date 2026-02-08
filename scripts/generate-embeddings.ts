import { config } from 'dotenv';
import { resolve } from 'path';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// .env.localから環境変数を読み込み
config({ path: resolve(process.cwd(), '.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 環境変数チェック
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('SUPABASE_KEY:', SUPABASE_KEY ? '✅' : '❌');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateEmbeddings() {
  console.log('🚀 Embedding生成を開始します...\n');
  
  // 全セクションを取得
  const { data: sections, error } = await supabase
    .from('jba_rules')
    .select('id, section_id, content')
    .is('embedding', null) // embeddingがまだないもののみ
    .order('id');
  
  if (error) {
    console.error('❌ セクション取得エラー:', error);
    return;
  }
  
  console.log(`📊 対象セクション数: ${sections?.length || 0}件\n`);
  
  if (!sections || sections.length === 0) {
    console.log('✅ すべてのセクションに既にembeddingが存在します');
    return;
  }
  
  let processed = 0;
  let errors = 0;
  
  // バッチ処理（10件ずつ）
  const batchSize = 10;
  
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    
    console.log(`\n📦 バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(sections.length / batchSize)} (${batch.length}件)`);
    
    for (const section of batch) {
      try {
        // OpenAI APIでembeddingを生成
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: section.content,
        });
        
        const embedding = response.data[0].embedding;
        
        // Supabaseに保存
        const { error: updateError } = await supabase
          .from('jba_rules')
          .update({ embedding })
          .eq('id', section.id);
        
        if (updateError) {
          console.error(`  ❌ ${section.section_id}: 更新エラー`, updateError);
          errors++;
        } else {
          processed++;
          console.log(`  ✅ ${section.section_id}`);
        }
        
        // レート制限対策（0.1秒待機）
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ ${section.section_id}: エラー`, error);
        errors++;
      }
    }
    
    console.log(`  進捗: ${processed}/${sections.length} (${Math.round(processed / sections.length * 100)}%)`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 Embedding生成完了');
  console.log(`✅ 成功: ${processed}件`);
  console.log(`❌ 失敗: ${errors}件`);
  console.log('='.repeat(80));
}

generateEmbeddings().catch(console.error);