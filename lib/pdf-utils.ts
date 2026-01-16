import * as fs from 'fs';
import * as path from 'path';

const PDFParser = require('pdf2json');

// PDFからテキストを抽出
export async function extractPdfText(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('PDFファイルを読み込み中:', pdfPath);
    
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('PDF解析エラー:', errData.parserError);
      reject(errData.parserError);
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let fullText = '';
        
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            if (page.Texts) {
              page.Texts.forEach((text: any) => {
                if (text.R) {
                  text.R.forEach((r: any) => {
                    if (r.T) {
                      const decodedText = decodeURIComponent(r.T);
                      fullText += decodedText + ' ';
                    }
                  });
                }
              });
              fullText += '\n';
            }
            
            if ((pageIndex + 1) % 50 === 0) {
              console.log(`${pageIndex + 1}ページ処理完了`);
            }
          });
        }
        
        console.log('PDF解析完了:', pdfData.Pages.length, 'ページ,', fullText.length, '文字');
        resolve(fullText);
      } catch (error) {
        console.error('テキスト抽出エラー:', error);
        reject(error);
      }
    });
    
    pdfParser.loadPDF(pdfPath);
  });
}

// 競技規則PDFのテキストを取得
export async function getRulesText(): Promise<string> {
  const pdfPath = path.join(process.cwd(), 'public', 'rules', 'jba2025.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDFファイルが見つかりません: ${pdfPath}`);
  }
  
  return await extractPdfText(pdfPath);
}

// 質問に関連する部分を抽出（Phase 2: 改善版）
// 質問に関連する部分を抽出（Phase 2: 改善版 v2）
// 質問に関連する部分を抽出（Phase 2: 改善版 v3）
export function findRelevantSections(fullText: string, question: string): string {
  console.log('=== 検索開始 ===');
  console.log('質問:', question);
  
  // 日本語の単語を抽出
  const katakanaWords = question.match(/[ァ-ヴー]+/g) || [];
  const kanjiWords = question.match(/[一-龯々]+/g) || [];
  const numbers = question.match(/\d+/g) || [];
  const articles = question.match(/第\s*\d+\s*条/g) || [];
  
  const searchWords = {
    katakana: katakanaWords.filter(w => w.length >= 3), // カタカナ（主要キーワード）
    kanji: kanjiWords.filter(w => w.length >= 2),       // 漢字
    numbers: numbers,                                    // 数字
    articles: articles                                   // 条文番号
  };
  
  const allWords = [
    ...searchWords.katakana,
    ...searchWords.kanji,
    ...searchWords.numbers,
    ...searchWords.articles
  ];
  
  const uniqueWords = [...new Set(allWords)];
  
  console.log('検索ワード（カタカナ）:', searchWords.katakana);
  console.log('検索ワード（漢字）:', searchWords.kanji);
  console.log('検索ワード（数字）:', searchWords.numbers);
  
  if (uniqueWords.length === 0) {
    console.log('⚠️ 検索ワードが抽出できませんでした。質問文全体で検索します。');
    uniqueWords.push(question);
  }
  
  // 「第○条」で分割
  const articleSections = fullText.split(/(?=第\s*\d+\s*条)/);
  console.log('条文数:', articleSections.length);
  
// 各条文をスコアリング（最終版）
const scoredArticles = articleSections.map((article, index) => {
  let score = 0;
  const scoreBreakdown: string[] = [];
  
  // 条文番号と名称を厳密に抽出
  // 例：「第29条 ショットクロック」の「ショットクロック」だけを抽出
  const titleMatch = article.match(/第\s*\d+\s*条\s+([^\s\n]+)/);
  const articleNumber = article.match(/第\s*\d+\s*条/);
  const articleName = titleMatch ? titleMatch[1].trim() : '';
  
  // 条文の最初の500文字
  const topSection = article.slice(0, 500);
  
  // タイトルマッチのブースト倍率
  let titleBoost = 1;
  
  // カタカナワード（最重要）
  searchWords.katakana.forEach(word => {
    // 条文名に完全一致する場合：最優先
    if (articleName === word) {
      score += 10000; // 条文名完全一致は絶対優先
      titleBoost = 10;
      scoreBreakdown.push(`条文名完全一致"${word}":+10000`);
    }
    // 条文名に含まれる場合
    else if (articleName.includes(word)) {
      score += 5000;
      titleBoost = 5;
      scoreBreakdown.push(`条文名"${word}":+5000`);
    }
    // 条文の冒頭500文字に含まれる場合
    else if (topSection.includes(word)) {
      score += 500;
      titleBoost = 2;
      scoreBreakdown.push(`冒頭部"${word}":+500`);
    }
    
    // 本文に含まれる回数：各10点
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = (article.match(regex) || []).length;
    const points = matches * 10;
    score += points;
    if (matches > 0) {
      scoreBreakdown.push(`本文"${word}"×${matches}:+${points}`);
    }
  });
  
  // 漢字ワード
  searchWords.kanji.forEach(word => {
    if (articleName === word) {
      score += 5000;
      scoreBreakdown.push(`条文名完全一致"${word}":+5000`);
    } else if (articleName.includes(word)) {
      score += 2000;
      scoreBreakdown.push(`条文名"${word}":+2000`);
    } else if (topSection.includes(word)) {
      score += 200;
      scoreBreakdown.push(`冒頭部"${word}":+200`);
    }
    
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = (article.match(regex) || []).length;
    const points = matches * 5;
    score += points;
    if (matches > 0) {
      scoreBreakdown.push(`本文"${word}"×${matches}:+${points}`);
    }
  });
  
  // 数字
  searchWords.numbers.forEach(word => {
    const regex = new RegExp(word, 'g');
    const matches = (article.match(regex) || []).length;
    const points = matches * 2;
    score += points;
    if (matches > 0) {
      scoreBreakdown.push(`数字"${word}"×${matches}:+${points}`);
    }
  });
  
  // 条文番号が指定されている場合
  searchWords.articles.forEach(word => {
    if (articleNumber && articleNumber[0] === word) {
      score += 20000; // 条文番号指定は最優先
      titleBoost = 10;
      scoreBreakdown.push(`条文番号指定"${word}":+20000`);
    }
  });
  
  // タイトルマッチした条文は全体スコアをブースト
  if (titleBoost > 1) {
    const originalScore = score;
    score = Math.floor(score * titleBoost);
    scoreBreakdown.push(`ブースト×${titleBoost}:${originalScore}→${score}`);
  }
  
  return {
    article,
    score,
    scoreBreakdown,
    articleNumber: articleNumber ? articleNumber[0] : '',
    articleName,
    index,
  };
}).filter(item => item.score > 0);

// スコア順にソート
scoredArticles.sort((a, b) => b.score - a.score);

console.log('マッチした条文数:', scoredArticles.length);
console.log('トップ5（詳細）:');
scoredArticles.slice(0, 5).forEach((item, i) => {
  console.log(`  ${i + 1}. スコア:${item.score}`);
  console.log(`     条文: ${item.articleNumber} ${item.articleName}`);
  console.log(`     内訳: ${item.scoreBreakdown.join(', ')}`);
});
  
  // 上位5つの条文を結合
  const topArticles = scoredArticles.slice(0, 5);
  let result = topArticles.map(item => item.article).join('\n\n');
  
  console.log('抽出されたテキスト長:', result.length);
  
  // 最大20000文字
  if (result.length > 20000) {
    console.log('20000文字に切り詰めます');
    result = result.slice(0, 20000);
  }
  
  // 結果が少なすぎる場合
  if (result.length < 500) {
    console.log('⚠️ 十分な結果が得られませんでした。全文の一部を返します。');
    result = fullText.slice(0, 10000);
  }
  
  console.log('=== 検索完了 ===\n');
  
  return result;
}