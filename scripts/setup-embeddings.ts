import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// 環境変数を読み込み
config({ path: '.env.local' });

// 環境変数を取得（エラーチェック付き）
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('❌ 環境変数が設定されていません');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  console.error('OPENAI_API_KEY:', OPENAI_API_KEY ? '✅' : '❌');
  console.error('\n.env.local ファイルを確認してください');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// PDF解析
const PDFParser = require('pdf2json');

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

// 条文に分割
function splitIntoSections(fullText: string): Array<{
  sectionId: string;
  sectionName: string;
  content: string;
}> {
  const sections: Array<{
    sectionId: string;
    sectionName: string;
    content: string;
  }> = [];
  
  // 「第○条」と「別添資料」で分割
  const parts = fullText.split(/(?=第\s*\d+\s*条|別添資料\s*[A-Z])/);
  
  parts.forEach((part) => {
    if (part.trim().length < 50) return; // 短すぎるものはスキップ
    
    // 条文番号と名称を抽出
    const articleMatch = part.match(/第\s*(\d+)\s*条\s+([^\n]+)/);
    const appendixMatch = part.match(/別添資料\s*([A-Z])\s*[−ー―‐\-]+\s*([^\n]+)/);
    
    if (articleMatch) {
      sections.push({
        sectionId: `第${articleMatch[1]}条`,
        sectionName: articleMatch[2].trim().split(/\s+/)[0], // 最初の単語だけ
        content: part.slice(0, 2000) // 最大2000文字
      });
    } else if (appendixMatch) {
      sections.push({
        sectionId: `別添資料${appendixMatch[1]}`,
        sectionName: appendixMatch[2].trim(),
        content: part.slice(0, 2000)
      });
    }
  });
  
  return sections;
}

// Embeddingsを生成
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// メイン処理
async function main() {
  console.log('🚀 RAGセットアップを開始します...\n');
  
  // 1. PDFを読み込み
  const pdfPath = path.join(process.cwd(), 'public', 'rules', 'jba2025.pdf');
  console.log('📄 PDFを読み込み中...');
  const fullText = await extractPdfText(pdfPath);
  console.log(`✅ PDF読み込み完了: ${fullText.length}文字\n`);
  
  // 2. 条文に分割
  console.log('✂️  条文に分割中...');
  const sections = splitIntoSections(fullText);
  console.log(`✅ ${sections.length}個の条文に分割完了\n`);
  
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
  console.log('🔄 ベクトル化と保存を開始...');
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
        console.log(`✅ ${i + 1}/${sections.length}: ${section.sectionId} ${section.sectionName}`);
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