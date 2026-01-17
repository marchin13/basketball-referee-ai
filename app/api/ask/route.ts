import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { searchRules } from '@/lib/rag';
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

// ... 既存のimport文 ...

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { question } = await request.json();
    console.log('\n' + '='.repeat(60));
    console.log('📝 新しい質問:', question);
    console.log('='.repeat(60) + '\n');

    const normalizedQuestion = await normalizeQuestion(question);
    const ragResults = await searchRules(normalizedQuestion, 10);
    
    const relevantText = ragResults
      .map((result) => {
        return `【${result.sectionId} ${result.sectionName}】（類似度: ${(result.similarity * 100).toFixed(1)}%）\n${result.content}`;
      })
      .join('\n\n---\n\n');
    
    console.log('📄 関連テキスト長:', relevantText.length, '文字\n');
    console.log('🤖 回答を生成中...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはバスケットボール競技規則の専門家です。

以下に提供されるJBA公式競技規則の関連条文に基づいて、質問に答えてください。

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
4. 重要な部分は原文を引用してください
5. 提供された条文から合理的に推論できる内容は説明に含めてください
6. 明らかに情報が不足している場合のみ「提供された資料では十分な情報が得られませんでした」と答えてください

【典型的な誤答パターン - これらを避けること】

❌ 誤答例1（ショットクロック - ポゼッション継続）:
質問: ショットクロック残り18秒のときに、フロントコートでヘルドボール、オフェンス継続。ショットクロックは？
誤答: 14秒にリセット
理由: 「フロントコート」というキーワードだけで判断

✅ 正答例1:
質問: ショットクロック残り18秒のときに、フロントコートでヘルドボール、オフェンス継続。ショットクロックは？
正答: 18秒継続（リセットなし）
理由: 「オフェンス継続」= ポゼッション変わらず → 14秒リセットの条件を満たさない

❌ 誤答例2（ファウル）:
質問: ディフェンスファウルでフリースロー1本
誤答: そのようなシチュエーションがあります
理由: 存在しないルールを生成

✅ 正答例2:
質問: ディフェンスファウルでフリースロー1本
正答: パーソナルファウルでフリースロー1本となるのは「アンドワン」（ショット成功+ファウル）の場合のみ

❌ 誤答例3（ゲームクロックとショットクロック）:
質問: ゲームクロック残り2秒、ショットクロック残り4秒。シュートファウルでフリースロー。ショットクロックは？
誤答: 24秒にリセット / 14秒にリセット
理由: ゲームクロックの残り時間を考慮していない

✅ 正答例3:
質問: ゲームクロック残り2秒、ショットクロック残り4秒。シュートファウルでフリースロー。ショットクロックは？
正答: ショットクロックはオフ（表示しない）
理由: ゲームクロック2秒 < 14秒のため、第50条によりショットクロックは使用しない

【提供される競技規則（関連度順）】
${relevantText}

【回答フォーマット】
## 回答
[質問に対する明確な回答]

## 根拠となる条文
**第○条 [条文名]**
> [関連する原文の引用]

## 補足説明
[必要に応じて、複数の条文を統合した説明]

## 関連する質問候補
この質問に関連して、以下のような質問の意図もあるかもしれません：
1. [具体的な状況を追加した質問]
2. [例外ケースに関する質問]
3. [関連する別のルールに関する質問]

（例）
元の質問: 審判がゲームクロックを進めることはありますか？
関連質問:
1. 審判が止める指示を出していないのに、テーブルオフィシャルズがゲームクロックを止めた場合、審判はゲームクロックを進める権限がありますか？
2. ゲームクロックの誤作動があった場合、審判はどのように対応しますか？
3. 審判がゲームクロックを修正できる状況はどのような場合ですか？`
        },
        {
          role: 'user',
          content: normalizedQuestion
        }
      ],
      temperature: 0.1,
      max_tokens: 2500, // 関連質問分を増やす
    });

    const answerText = completion.choices[0]?.message?.content || '';
    console.log('✅ 回答生成完了\n');

    // 関連質問を抽出
    const relatedQuestionsMatch = answerText.match(/## 関連する質問候補\n([\s\S]*?)(?=\n##|\n$|$)/);
    let relatedQuestions: string[] = [];
    let mainAnswer = answerText;

    if (relatedQuestionsMatch) {
      const relatedSection = relatedQuestionsMatch[1];
      // 番号付きリストを抽出
      relatedQuestions = relatedSection
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 0);
      
      // 関連質問セクションを本文から削除
      mainAnswer = answerText.replace(/## 関連する質問候補[\s\S]*$/, '').trim();
      
      console.log('💡 関連質問:', relatedQuestions.length, '件');
    }

    const htmlAnswer = mainAnswer
      .replace(/##\s+(.+)/g, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-800">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/>\s+(.+)/g, '<blockquote class="border-l-4 border-orange-500 pl-4 py-2 my-3 bg-orange-50 italic text-gray-700">$1</blockquote>')
      .replace(/\n\n/g, '</p><p class="mb-3 text-gray-700">')
      .replace(/^/, '<div class="prose max-w-none"><p class="mb-3 text-gray-700">')
      .replace(/$/, '</p></div>');

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
      relatedQuestions, // 新規追加
      model: 'gpt-4o-mini (RAG)',
      originalQuestion: question,
      normalizedQuestion: normalizedQuestion,
      ragResults: ragResults.map(r => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        similarity: r.similarity
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