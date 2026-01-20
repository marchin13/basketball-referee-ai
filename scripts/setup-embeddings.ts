import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// 環境変数を読み込み
config({ path: '.env.local' });

// 開発モード設定（本番実行時は false に変更）
const DEV_MODE = false; // ⚠️ 本番実行時は false にしてください

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 開発モードでない場合のみ環境変数チェック
if (!DEV_MODE && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY)) {
  console.error('❌ 環境変数が設定されていません');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  console.error('OPENAI_API_KEY:', OPENAI_API_KEY ? '✅' : '❌');
  console.error('\n.env.local ファイルを確認してください');
  process.exit(1);
}

// 開発モードではnullを使用、本番モードではクライアントを初期化
const supabase = DEV_MODE ? null : createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
const openai = DEV_MODE ? null : new OpenAI({ apiKey: OPENAI_API_KEY! });

const PDFParser = require('pdf2json');

// PDF解析
async function extractPdfText(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(errData.parserError);
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      let fullText = '';
      if (pdfData.Pages) {
        pdfData.Pages.forEach((page: any) => {
          if (page.Texts) {
            page.Texts.forEach((text: any) => {
              if (text.R) {
                text.R.forEach((r: any) => {
                  if (r.T) {
                    fullText += decodeURIComponent(r.T) + ' ';
                  }
                });
              }
            });
            fullText += '\n';
          }
        });
      }
      resolve(fullText);
    });
    
    pdfParser.loadPDF(pdfPath);
  });
}

// 改良版：インタープリテーションを細かく分割
function splitIntoSections(fullText: string): Array<{
  sectionId: string;
  sectionName: string;
  content: string;
  sectionType: 'rule' | 'interpretation' | 'appendix';
}> {
  const sections: Array<{
    sectionId: string;
    sectionName: string;
    content: string;
    sectionType: 'rule' | 'interpretation' | 'appendix';
  }> = [];
  
  console.log('\n=== 📊 分割処理開始 ===\n');
  console.log(`📖 全文字数: ${fullText.length}文字\n`);
  
  // === 1. 競技規則本文とインタープリテーションを分離 ===
  
  // 「インタープリテーション」キーワードを探す
  const interpretationKeyword = fullText.indexOf('インタープリテーション');
  
  // インタープリテーション部分の「第4条 チーム」を探す（複数パターン対応）
  let article4Start = -1;
  if (interpretationKeyword > 0) {
    const article4Patterns = [
      '第   4   条   チーム',
      '第 4 条 チーム',
      '第4条 チーム',
      /第\s*4\s*条\s*チーム/,
      /第\s*4\s*条\s+チーム/,
    ];
    
    for (const pattern of article4Patterns) {
      if (typeof pattern === 'string') {
        const pos = fullText.indexOf(pattern, interpretationKeyword);
        if (pos > 0) {
          article4Start = pos;
          break;
        }
      } else {
        const match = fullText.slice(interpretationKeyword).match(pattern);
        if (match) {
          article4Start = interpretationKeyword + fullText.slice(interpretationKeyword).indexOf(match[0]);
          break;
        }
      }
    }
  }
  
  console.log(`📍 インタープリテーションキーワード位置: ${interpretationKeyword}文字目`);
  console.log(`📍 第4条開始位置: ${article4Start}文字目\n`);
  
  const rulesText = fullText.slice(0, interpretationKeyword > 0 ? interpretationKeyword : fullText.length);
  const interpretationText = article4Start > 0 ? fullText.slice(article4Start) : '';
  
  console.log(`📖 競技規則本文: ${rulesText.length}文字`);
  console.log(`📖 インタープリテーション: ${interpretationText.length}文字\n`);
  
  // === 2. 競技規則本文を処理 ===
  console.log('=== 1️⃣ 競技規則本文を処理 ===\n');
  
  const ruleParts = rulesText.split(/(?=第\s*\d+\s*条|別添資料\s*[A-Z])/);
  
  ruleParts.forEach((part) => {
    if (part.trim().length < 50) return;
    
    const articleMatch = part.match(/第\s*(\d+)\s*条\s+([^\n]+)/);
    const appendixMatch = part.match(/別添資料\s*([A-Z])\s*[−ー―‐\-]+\s*([^\n]+)/);
    
    if (articleMatch) {
      sections.push({
        sectionId: `第${articleMatch[1]}条`,
        sectionName: articleMatch[2].trim().split(/\s+/)[0],
        content: part.slice(0, 3000),
        sectionType: 'rule'
      });
      console.log(`✅ 第${articleMatch[1]}条 ${articleMatch[2].trim().split(/\s+/)[0]}`);
    } else if (appendixMatch) {
      sections.push({
        sectionId: `別添資料${appendixMatch[1]}`,
        sectionName: appendixMatch[2].trim(),
        content: part.slice(0, 3000),
        sectionType: 'appendix'
      });
      console.log(`✅ 別添資料${appendixMatch[1]} ${appendixMatch[2].trim()}`);
    }
  });
  
  console.log(`\n✅ 競技規則本文: ${sections.filter(s => s.sectionType === 'rule' || s.sectionType === 'appendix').length}個\n`);
  
  // === 3. インタープリテーションを処理 ===
  console.log('=== 2️⃣ インタープリテーションを処理 ===\n');
  
  if (interpretationText.length > 0) {
    // 「第○条」で大きく分割（第18/19条のような統合条文にも対応）
    const interpretationParts = interpretationText.split(/(?=第\s*\d+(?:\/\d+)?\s*条)/);
    
    console.log(`📊 インタープリテーション大分類: ${interpretationParts.length}個\n`);
    
    interpretationParts.forEach((articlePart, articleIndex) => {
      if (articlePart.trim().length < 50) return;
      
      // 条文番号と名称を抽出
      const articleMatch = articlePart.match(/第\s*(\d+(?:\/\d+)?)\s*条\s+([^\n]+)/);
      
      if (!articleMatch) return;
      
      const articleNumber = articleMatch[1]; // "4" または "18/19"
      const articleName = articleMatch[2].trim();
      
      console.log(`\n--- 第${articleNumber}条 ${articleName} ---`);
      
      // サブセクション（4-1、4-2など）で分割
      // 条文番号を基準にサブセクションを探す
      const articleNumBase = articleNumber.split('/')[0]; // "18/19" → "18"
      
      // サブセクションパターン：条文番号に対応するもののみ
      const subSectionPattern = new RegExp(`${articleNumBase}\\s*[-−ー]\\s*\\d+`, 'g');
      const subSectionMatches = articlePart.match(subSectionPattern);
      
      console.log(`   🔍 サブセクション候補: ${subSectionMatches ? subSectionMatches.length : 0}個`);
      
      if (!subSectionMatches || subSectionMatches.length === 0) {
        // サブセクションがない場合は条文全体を1つのセクションとして登録
        sections.push({
          sectionId: `インタープリテーション_第${articleNumber}条`,
          sectionName: articleName,
          content: articlePart.slice(0, 3000),
          sectionType: 'interpretation'
        });
        console.log(`   ✅ インタープリテーション_第${articleNumber}条`);
      } else {
        // サブセクションで分割
        const splitPattern = new RegExp(`(?=${articleNumBase}\\s*[-−ー]\\s*\\d+)`);
        const subSections = articlePart.split(splitPattern);
        
        console.log(`   📝 分割後のセクション数: ${subSections.length}個`);
        
        // サブセクションごとに登録
        subSections.forEach((subPart, subIndex) => {
          if (subPart.trim().length < 30) return;
          
          // サブセクション番号を抽出（例: "4 - 1" → "1"）
          const subMatch = subPart.match(new RegExp(`${articleNumBase}\\s*[-−ー]\\s*(\\d+)`));
          
          if (subMatch) {
            const subNum = subMatch[1];
            
            sections.push({
              sectionId: `インタープリテーション_第${articleNumber}条_${articleNumBase}-${subNum}`,
              sectionName: `${articleName} ${articleNumBase}-${subNum}`,
              content: subPart.slice(0, 3000),
              sectionType: 'interpretation'
            });
            console.log(`   ✅ ${articleNumBase}-${subNum}`);
          }
        });
      }
    });
  }
  
  const interpretationCount = sections.filter(s => s.sectionType === 'interpretation').length;
  console.log(`\n✅ インタープリテーション: ${interpretationCount}個\n`);
  
  console.log('=== 📊 分割完了 ===\n');
  console.log(`✅ 合計: ${sections.length}個のセクション\n`);
  console.log(`  - 競技規則本文: ${sections.filter(s => s.sectionType === 'rule').length}個`);
  console.log(`  - 別添資料: ${sections.filter(s => s.sectionType === 'appendix').length}個`);
  console.log(`  - インタープリテーション: ${interpretationCount}個\n`);
  
  return sections;
}

// Embeddingsを生成
async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI client is not initialized');
  }
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// メイン処理
async function main() {
  console.log('🚀 RAGセットアップ（改良版）を開始します...\n');
  
  if (DEV_MODE) {
    console.log('⚠️  開発モード: データベースへの保存はスキップします\n');
  }
  
  // 1. PDFを読み込み
  const pdfPath = path.join(process.cwd(), 'public', 'rules', 'jba2025.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDFファイルが見つかりません: ${pdfPath}`);
    console.error('プロジェクトのルートディレクトリで実行してください');
    process.exit(1);
  }
  
  console.log('📄 PDFを読み込み中...');
  const fullText = await extractPdfText(pdfPath);
  console.log(`✅ PDF読み込み完了: ${fullText.length}文字\n`);
  
  // 2. 条文に分割
  const sections = splitIntoSections(fullText);
  
  if (DEV_MODE) {
    console.log('\n=== 📋 分割結果サンプル ===\n');
    
    // 各タイプから5個ずつサンプル表示
    const rulesSample = sections.filter(s => s.sectionType === 'rule').slice(0, 5);
    const interpretationSample = sections.filter(s => s.sectionType === 'interpretation').slice(0, 20);
    
    console.log('競技規則本文（最初の5個）:');
    rulesSample.forEach(s => console.log(`  - ${s.sectionId}: ${s.sectionName}`));
    
    console.log('\nインタープリテーション（最初の20個）:');
    interpretationSample.forEach(s => console.log(`  - ${s.sectionId}`));
    
    console.log('\n✅ 開発モード完了。実際のDB保存はスキップしました。');
    console.log('💡 本番実行する場合は、スクリプト内の DEV_MODE を false に変更してください。\n');
    return;
  }
  
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }
  
  // 3. 既存データを削除
  console.log('🗑️  既存データを削除中...');
  const { error: deleteError } = await supabase
    .from('rule_sections')
    .delete()
    .neq('id', 0); // 全削除
  
  if (deleteError) {
    console.error('削除エラー:', deleteError);
  } else {
    console.log('✅ 既存データ削除完了\n');
  }
  
  // 4. 各条文をベクトル化して保存
  console.log('🔄 ベクトル化と保存を開始...\n');
  let successCount = 0;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    try {
      // ベクトル化
      const embedding = await generateEmbedding(section.content);
      
      // Supabaseに保存
      const { error } = await supabase
        .from('rule_sections')
        .insert({
          section_id: section.sectionId,
          section_name: section.sectionName,
          content: section.content,
          embedding: embedding
        });
      
      if (error) {
        console.error(`❌ ${section.sectionId} 保存失敗:`, error.message);
      } else {
        successCount++;
        console.log(`✅ ${i + 1}/${sections.length}: ${section.sectionId}`);
      }
      
      // レート制限対策（少し待つ）
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ ${section.sectionId} エラー:`, error);
    }
  }
  
  console.log(`\n🎉 完了！ ${successCount}/${sections.length} 件のデータを保存しました`);
}

main().catch(console.error);