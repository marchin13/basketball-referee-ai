import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { searchRules } from '@/lib/rag-v2';
import { searchSignalImages } from '@/lib/signal-images';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function normalizeQuestion(question: string): Promise<string> {
  console.log('=== 質問の正規化 ===');
  console.log('元の質問:', question);
  
  if (question.length < 20) {
    console.log('⚠️ 長文のため正規化をスキップ');
    return question;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはバスケットボール審判の質問を正規化する専門家です。

ユーザーの質問を、検索しやすい形に正規化してください。

【正規化ルール】
1. 略語を正式名称に展開
   - アンスポ → アンスポーツマンライクファウル
   - テクニカル → テクニカルファウル
   - ダブル → ダブルファウル
   - TO → タイムアウト
   - FT → フリースロー

2. 曖昧な表現を具体化
   - 「あれ」「それ」→ 文脈から推測して具体的に
   - 「どうなる」→ 「ルールは」「判定は」

3. 重要な情報は残す
   - 数字（秒数、点数、人数など）
   - 状況（フロントコート、バックコート、スローインなど）
   - 動作（シュート、パス、ドリブルなど）

4. 不要な情報は削除
   - 挨拶、お礼
   - 「教えてください」「質問です」などの定型句

【出力】
正規化された質問のみを返してください。説明は不要です。`
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const normalized = completion.choices[0]?.message?.content?.trim() || question;
    console.log('正規化後:', normalized);
    console.log('===================\n');
    return normalized;
  } catch (error) {
    console.error('正規化エラー:', error);
    return question;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { question } = await request.json();
    console.log('\n' + '='.repeat(60));
    console.log('📝 新しい質問:', question);
    console.log('='.repeat(60) + '\n');

    const normalizedQuestion = await normalizeQuestion(question);
    const ragResults = await searchRules(normalizedQuestion, 3);
    
    // 審判シグナル画像を検索
    const signalImages = searchSignalImages(normalizedQuestion);
    console.log(`📸 シグナル画像: ${signalImages.length}件\n`);
    
    // 🆕🆕 信頼度を計算
    const confidence = calculateConfidenceFromResults(ragResults, normalizedQuestion);
    const alternativeResult = confidence.shouldShowAlternative && ragResults[1] ? ragResults[1] : null;
    
    console.log(`📊 信頼度: ${confidence.grade} - ${confidence.description}`);
    if (alternativeResult) {
      console.log(`📋 代替回答あり: ${alternativeResult.sectionId}`);
    }
    
    // 競技規則とインタープリテーションを分離
    const ruleResults = ragResults.filter(r => 
      r.sectionId.startsWith('規則_')
    );
    const interpretationResults = ragResults.filter(r => 
      r.sectionId.startsWith('解説_')
    );
    
    // 🆕🆕 代替回答用のテキストも準備
    let alternativeRuleText = '';
    let alternativeInterpretationText = '';
    
    if (alternativeResult) {
      if (alternativeResult.sectionId.startsWith('規則_')) {
        alternativeRuleText = `【${alternativeResult.sectionId} ${alternativeResult.sectionName}】\n${alternativeResult.content}`;
      } else {
        alternativeInterpretationText = `【${alternativeResult.sectionId} ${alternativeResult.sectionName}】\n${alternativeResult.content}`;
      }
    }
    
    const ruleText = ruleResults
      .map((result, index) => {
        if (index === 0) {
          // 🆕 1位の条文を特別扱い
          return `🏆 【最優先】検索1位の条文 - 必ずこれを主な根拠として引用すること\n【${result.sectionId} ${result.sectionName}】\n${result.content}`;
        }
        return `【${result.sectionId} ${result.sectionName}】\n${result.content}`;
      })
      .join('\n\n---\n\n');
    
    const interpretationText = interpretationResults
      .map((result, index) => {
        if (index === 0 && ruleResults.length === 0) {
          // 🆕 競技規則がない場合、解説の1位を特別扱い
          return `🏆 【最優先】検索1位の条文 - 必ずこれを主な根拠として引用すること\n【${result.sectionId} ${result.sectionName}】\n${result.content}`;
        }
        return `【${result.sectionId} ${result.sectionName}】\n${result.content}`;
      })
      .join('\n\n---\n\n');
    
    console.log('📄 競技規則:', ruleResults.length, '件');
    console.log('📄 インタープリテーション:', interpretationResults.length, '件\n');
    console.log('🤖 回答を生成中...');
    
    // 🆕🆕🆕 1位の条文情報を明示的に抽出
    const topResult = ragResults[0];
    const topResultInfo = topResult ? `
【最重要】検索1位の条文（必ずこの条文を最優先で確認・引用すること）
条文ID: ${topResult.sectionId}
条文名: ${topResult.sectionName}
信頼度: ${((topResult.combinedScore || 0) * 100).toFixed(1)}%
` : '';
    
    // 🆕🆕 システムプロンプトに信頼度情報を追加
    const systemPrompt = `あなたはバスケットボール競技規則の専門家です。

${topResultInfo}

以下に提供されるJBA公式競技規則の関連条文に基づいて、質問に答えてください。

【絶対厳守ルール - 違反は誤答とみなす】

1. **提供される条文は検索精度の厳密な順位順です**
2. **1位の条文（${topResult?.sectionId || '最初の条文'}）を必ず最優先で確認する**
3. **1位の条文が質問に関連する場合、必ずそれを主要な根拠として引用する**
4. 2位以降の条文は補足情報としてのみ使用する

【特に重要】
- 質問に「ヘルドボール」+「アウトオブバウンズ」が含まれる場合
  → 第23条 23-2-3 が提供されていれば必ずそれを引用
  → 正解: ジャンプボールシチュエーション
  → 間違い: スローイン
  
- 1位と2位の条文が異なる結論を示す場合
  → 必ず1位の条文の結論を採用する

【重要な判断プロセス - 回答前に必ず実行】

ショットクロック・タイマーに関する質問の場合：
1. ゲームクロックの残り時間は？
   - ゲームクロック < 14秒 → ショットクロックはオフ（表示しない）※最優先で確認
   - ゲームクロック ≥ 14秒 → 以下のルール適用
2. ボールポゼッションは変わったか？（YES/NO）
3. スローインの状況か、継続プレーか？
4. 「オフェンス継続」「ポゼッション変わらず」の場合 → 基本的にリセットなし
5. 該当する条文のすべての条件を満たしているか確認
6. 第29条（基本ルール）と第50条（運用）の両方を参照

ファウル判定に関する質問の場合：
1. 該当する条文の「すべての要件」を確認
2. 単一キーワード（例：「フロントコート」）だけで判断しない
3. 文脈全体から総合的に判断

【指示】
1. 提供された条文の内容を総合的に判断して回答してください
2. 複数の条文にまたがる情報がある場合は、それらを統合して説明してください
3. 該当する条文番号を明記してください
 ⚠️ 重要：【】で囲まれたセクションIDをそのまま使用してください
   例：【第16条 16-2-2 得点・ゴールによる点数（自チームのバスケットへの誤った得点）】
4. 重要な部分は原文を引用してください
5. 提供された条文から合理的に推論できる内容は説明に含めてください
6. 明らかに情報が不足している場合のみ「提供された資料では十分な情報が得られませんでした」と答えてください

【重要：引用する条文の選択基準】
- **最上位（最初に提供された）の条文を最優先で引用する**
- 質問のメインテーマに直接関連する条文を優先的に引用する
- 関連性の低い条文は避ける
- 提供された条文の中に質問に直接関連するものがない場合は、その旨を明記する

【提供される競技規則】※検索精度順（上から関連度が高い）

⚠️ 重要：最初の条文（🏆マーク付き）が最も関連度が高い条文です。
質問に関連する場合、必ずこの条文を主な根拠として使用してください。

${ruleText || '該当する競技規則本文はありません'}

【提供されるインタープリテーション（具体例と解説）】※検索精度順

${interpretationText || '該当するインタープリテーションはありません'}

【回答フォーマット - 厳守】
必ず以下のフォーマットに従って回答してください：

## 質問の解釈
[AIが理解した質問の意図を1-2文で明確に記述]

## 回答
[競技規則に基づく明確で簡潔な回答（2-4文程度）]

## 根拠

### 1. 競技規則
**第○条 ○-○-○ [条文名]**  ← 必ず完全な条文番号を含める
> [原文の重要部分を引用]

例：
**第25条 25-1-1 トラベリング**
> トラベリングとは、ライブのボールを持ったプレーヤーが...

**第23条 23-2-3 ヘルドボール**
> ヘルドボールの間にプレーヤーがアウトオブバウンズかバックコートに触れてしまった場合は、ジャンプボールシチュエーションとなる。

（該当する競技規則本文がある場合のみ記載）

### 2. インタープリテーション
**第○条 ○-○ [条文名]**  ← 必ず完全な条文番号を含める
> [原文の重要部分を引用]

例：
**第29条 29-2 ショットクロック**
> ヘルドボールでオルタネイティングポゼッションアローがボールをコントロールしていたチームを示している場合...

**第37条 37-1 アンスポーツマンライクファウル**
> 速攻の状況でディフェンスのプレーヤーがボールに対する正当なプレーをせずファウルをした場合...

[具体例の説明があれば簡潔に記載]

（該当するインタープリテーションがある場合のみ記載）

## 補足説明
[必要に応じて、複数の条文を統合した説明や注意点を記載]

## 関連する質問候補 ← 必須セクション：必ず3つの質問を生成すること
この質問に関連して、以下のような質問の意図もあるかもしれません：
1. [具体的な状況を追加した質問]
2. [例外ケースに関する質問]
3. [関連する別のルールに関する質問]

例：
質問が「トラベリングとは」の場合：
1. トラベリングの例外となるケースはありますか？
2. ピボットフットを決めた後の動きについて教えてください
3. ドリブル後のステップはトラベリングになりますか？`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: normalizedQuestion
        }
      ],
      temperature: 0.1,
      max_tokens: 2500,
    });

    const answerText = completion.choices[0]?.message?.content || '';
    console.log('✅ 回答生成完了\n');

    // 🆕🆕 代替回答を生成（信頼度がBの場合のみ）
    let alternativeAnswerText = '';
    if (alternativeResult && confidence.shouldShowAlternative) {
      console.log('🔄 代替回答を生成中...');
      
      const alternativeCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `あなたはバスケットボール競技規則の専門家です。

以下の条文に基づいて、簡潔な代替回答を提供してください。

【提供される競技規則】
${alternativeRuleText || '該当する競技規則本文はありません'}

【提供されるインタープリテーション】
${alternativeInterpretationText || '該当するインタープリテーションはありません'}

【回答フォーマット】
## 代替解釈
[この条文に基づく判定を2-3文で簡潔に]

## 根拠
**第○条 ○-○-○ [条文名]**  ← 必ず完全な条文番号を含める
> [原文の重要部分を引用]

例：
**第12条 12-4 ジャンプボールシチュエーション**
> どちらのチームもボールをコントロールしていないかボールを与えられる権利がない状態でボールがデッドになったとき。`
          },
          {
            role: 'user',
            content: normalizedQuestion
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      });
      
      alternativeAnswerText = alternativeCompletion.choices[0]?.message?.content || '';
      console.log('✅ 代替回答生成完了\n');
    }

    // 関連質問を抽出
    const relatedQuestionsMatch = answerText.match(/## 関連する質問候補\n([\s\S]*?)(?=\n##|\n$|$)/);
    let relatedQuestions: string[] = [];
    let mainAnswer = answerText;

    if (relatedQuestionsMatch) {
      const relatedSection = relatedQuestionsMatch[1];
      relatedQuestions = relatedSection
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);
      
      mainAnswer = answerText.replace(/## 関連する質問候補[\s\S]*$/, '').trim();
      
      console.log('💡 関連質問:', relatedQuestions.length, '件');
    }

    // 🆕🆕 信頼度バッジをHTMLに追加
    const confidenceBadgeHtml = `
<div class="mb-6 p-4 rounded-lg border-2 ${confidence.colorClass}">
  <div class="flex items-center gap-3">
    <span class="text-2xl font-bold">${confidence.grade}</span>
    <div>
      <div class="font-semibold">AI回答信頼度</div>
      <div class="text-sm">${confidence.description}</div>
    </div>
  </div>
</div>`;

    // HTMLに変換（改善されたスタイリング）
    let htmlAnswer = confidenceBadgeHtml + mainAnswer
      .replace(/(\d+)ー(\d+)/g, '$1-$2')  // 🆕 条文番号のみ変換（例: 23ー2 → 23-2）
      .replace(/(\d+)２/g, '$1-2')  // 🆕 全角数字の変換（例: 23２ → 23-2）
      .replace(/(\d+)３/g, '$1-3')
      .replace(/(\d+)４/g, '$1-4')
      .replace(/(\d+)１/g, '$1-1')
      .replace(/\（該当する.*?がある場合のみ記載）/g, '')  // 🆕 注意書きを削除
      .replace(/\(該当する.*?がある場合のみ記載\)/g, '')  // 🆕 半角括弧版も削除
      .replace(/## 質問の解釈\n/g, '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded"><h2 class="text-lg font-bold text-blue-900 mb-2">📌 質問の解釈</h2><p class="text-blue-800">')
      .replace(/\n## 回答\n/g, '</p></div><div class="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded"><h2 class="text-lg font-bold text-green-900 mb-2">✅ 回答</h2><p class="text-green-800 font-semibold text-lg">')
      .replace(/\n## 根拠\n/g, '</p></div><div class="bg-gray-50 border-l-4 border-gray-500 p-4 mb-6 rounded text-gray-900"><h2 class="text-lg font-bold text-gray-900 mb-3">📖 根拠</h2>')  // 🆕 text-gray-900 追加
      .replace(/### 1\. 競技規則\n/g, '<h3 class="text-md font-bold text-gray-800 mt-4 mb-2">【1. 競技規則】</h3>')
      .replace(/### 2\. インタープリテーション\n/g, '<h3 class="text-md font-bold text-gray-800 mt-4 mb-2">【2. インタープリテーション】</h3>')
      .replace(/\n## 補足説明\n/g, '</div><div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded"><h2 class="text-lg font-bold text-yellow-900 mb-2">💡 補足説明</h2><p class="text-yellow-800">')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/^> (.+)/gm, '<blockquote class="border-l-4 border-orange-400 pl-4 py-2 my-2 bg-orange-50 text-gray-900">$1</blockquote>')  // 🆕 text-gray-700 → text-gray-900
      .replace(/\n\n/g, '</p><p class="mb-2 text-gray-900">')  // 🆕 text-gray-700 → text-gray-900
      .replace(/$/, '</p></div>');
    
    // 🆕🆕 代替回答を追加
    if (alternativeAnswerText && confidence.shouldShowAlternative) {
      const alternativeHtml = `
<div class="mt-6 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
  <h2 class="text-lg font-bold text-orange-900 mb-3">⚠️ 別の解釈の可能性</h2>
  ${alternativeAnswerText
    .replace(/(\d+)ー(\d+)/g, '$1-$2')  // 🆕 条文番号のみ変換
    .replace(/(\d+)２/g, '$1-2')
    .replace(/(\d+)３/g, '$1-3')
    .replace(/(\d+)４/g, '$1-4')
    .replace(/(\d+)１/g, '$1-1')
    .replace(/## 代替解釈\n/g, '<p class="text-orange-800 mb-3">')
    .replace(/\n## 根拠\n/g, '</p><div class="mt-2 text-gray-900"><h3 class="font-semibold text-orange-900 mb-1">参考条文：</h3>')  // 🆕 text-gray-900 追加
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')  // 🆕 text-gray-900 追加
    .replace(/^> (.+)/gm, '<blockquote class="border-l-4 border-orange-400 pl-3 py-1 my-1 bg-orange-100 text-gray-900">$1</blockquote>')
    .replace(/$/, '</div>')}
</div>`;
      htmlAnswer += alternativeHtml;
    }

    const responseTime = Date.now() - startTime;

    // ログ保存
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      await supabase.from('query_logs').insert({
        question,
        normalized_question: normalizedQuestion,
        ai_answer: htmlAnswer,
        raw_answer: answerText,
        rag_results: ragResults,
        rag_count: ragResults.length,
        response_time_ms: responseTime,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        referrer: request.headers.get('referer'),
        model_used: 'gpt-4o-mini'
      });

      console.log('📊 ログ保存完了');
    } catch (logError) {
      console.error('⚠️ ログ保存エラー（処理は継続）:', logError);
    }

    return NextResponse.json({ 
      answer: htmlAnswer,
      rawAnswer: answerText,
      relatedQuestions,
      confidence: {
        grade: confidence.grade,
        description: confidence.description
      },
      signalImages: signalImages.map(img => ({
        name: img.name,
        path: img.path,
        description: img.description
      })),
      model: 'gpt-4o-mini (RAG)',
      originalQuestion: question,
      normalizedQuestion: normalizedQuestion,
      ragResults: ragResults.map(r => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        similarity: r.similarity,
        rankScore: r.rankScore,
        combinedScore: r.combinedScore
      }))
    });

  } catch (error: any) {
    console.error('❌ 詳細なエラー情報:', error);
    
    if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return NextResponse.json(
        { error: 'ネットワークエラーが発生しました。インターネット接続を確認してください。' },
        { status: 500 }
      );
    } else if (error.message.includes('Supabase') || error.message.includes('Database')) {
      return NextResponse.json(
        { error: 'データベース接続エラーが発生しました。しばらく待ってから再度お試しください。' },
        { status: 500 }
      );
    } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
      return NextResponse.json(
        { error: 'AI APIエラーが発生しました。しばらく待ってから再度お試しください。' },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { error: 'エラーが発生しました。もう一度お試しください。エラーが続く場合は管理者にお問い合わせください。' },
        { status: 500 }
      );
    }
  }
}

// 🆕🆕 ヘルパー関数: 信頼度を計算
function calculateConfidenceFromResults(results: any[], question: string): {
  grade: 'A+' | 'A' | 'B' | 'C';
  description: string;
  shouldShowAlternative: boolean;
  colorClass: string;
} {
  if (results.length === 0) {
    return {
      grade: 'C',
      description: '該当する競技規則が見つかりませんでした',
      shouldShowAlternative: false,
      colorClass: 'bg-red-100 text-red-800 border-red-300'
    };
  }
  
  const top = results[0];
  const topContent = top.content || '';
  
  // 🆕🆕 A+判定: 定義質問の完全一致
  const definitionMatch = question.match(/(.+?)とは/);
  if (definitionMatch) {
    const keyword = definitionMatch[1].trim();
    // 1位の条文が「〇〇とは」を含むか確認（条文番号があっても対応）
    // 例: "25-1-1  トラベリングとは、..." または "トラベリングとは、..."
    const definitionRegex = new RegExp(`${keyword}とは`, 'i');
    if (definitionRegex.test(topContent)) {
      // さらに、条文の最初の方（200文字以内）に含まれるか確認
      const firstPart = topContent.substring(0, 200);
      if (definitionRegex.test(firstPart)) {
        return {
          grade: 'A+',
          description: '完全一致：定義が明確に記載されています',
          shouldShowAlternative: false,
          colorClass: 'bg-green-100 text-green-800 border-green-300'
        };
      }
    }
  }
  
  const second = results[1];
  
  // 2位がない場合
  if (!second) {
    if (top.similarity >= 0.7) {
      return {
        grade: 'A',
        description: '該当する競技規則を特定しました',
        shouldShowAlternative: false,
        colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
      };
    } else {
      return {
        grade: 'B',
        description: '類似する規則はありますが、完全一致ではありません',
        shouldShowAlternative: false,
        colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300'
      };
    }
  }
  
  // スコア差を%で計算
  const topScore = (top.combinedScore || 0) * 100;
  const secondScore = (second.combinedScore || 0) * 100;
  const scoreDiff = topScore - secondScore;
  
  // A判定: 1位が明確（差が1%より大きい）
  if (scoreDiff > 1.0) {
    return {
      grade: 'A',
      description: '該当する競技規則を特定しました',
      shouldShowAlternative: false,
      colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
    };
  }
  
  // B判定: 僅差または同率（差が1%以内）
  if (scoreDiff <= 1.0) {
    return {
      grade: 'B',
      description: '複数の解釈がある可能性があります',
      shouldShowAlternative: true,
      colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
  }
  
  // フォールバック
  return {
    grade: 'A',
    description: '該当する競技規則を特定しました',
    shouldShowAlternative: false,
    colorClass: 'bg-blue-100 text-blue-800 border-blue-300'
  };
}