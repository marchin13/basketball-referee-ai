import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { enhancedSearch } from '@/lib/enhanced_search';
import { searchSignalImages } from '@/lib/signal-images';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ReasoningResult {
  answer: string;
  reasoning: string;
  references: Array<{
    sectionId: string;
    sectionName: string;
    content: string;
    score: number;
  }>;
  detailChecks: string[];
  confidence: string;
}

const getAIJudgmentWithReasoning = async (
  question: string,
  searchData: any
): Promise<ReasoningResult> => {
  const { results, detailCheck } = searchData;

  if (results.length === 0) {
    return {
      answer: '×',
      reasoning: '関連する競技規則が見つかりませんでした。',
      references: [],
      detailChecks: [],
      confidence: 'C',
    };
  }

  const context = results.map((r: any, i: number) =>
    `【検索結果${i + 1}】${r.sectionId} - ${r.sectionName}\n${r.content}\n(関連度: ${(r.combinedScore * 100).toFixed(1)}%)`
  ).join('\n\n---\n\n');

  let detailWarning = '';
  if (detailCheck.hasIssues) {
    detailWarning = '\n\n【注意事項】\n' + detailCheck.issues.map((issue: string) => `- ${issue}`).join('\n');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `バスケットボール競技規則の専門家として、わかりやすく回答してください。

【回答スタイル】
- 審判や指導者に説明するように、自然な日本語で回答
- 「問題文」「検索結果」といった表現は使わない
- 規則の内容を簡潔に説明し、必要に応じて根拠条文を示す

【判定基準】
1. 明確な誤り → ×で指摘
2. 趣旨が一致 → ○で説明

【出力形式】JSON
{
  "answer": "結論を1-2文で簡潔に",
  "reasoning": "詳細な説明と根拠条文"
}

【重要】answer と reasoning は異なる内容にする：
- answer: 質問に対する端的な回答（結論のみ）
- reasoning: なぜそう判断したか、どの条文に基づくか

【良い例】
質問: アンスポーツマンライクファウルの判定基準は？

{
  "answer": "アンスポーツマンライクファウルは、相手選手に対して不適切な行動を取った場合に宣せられます。",
  "reasoning": "具体的には、スポーツマンシップに反する行為や、相手選手に対する危険な接触が含まれます。このファウルが宣せられた場合、通常はフリースローが与えられ、ゲームはフロントコートのスローインラインから再開されます（規則_第17条 17-2-7）。"
}`,
      },
      {
        role: 'user',
        content: `【質問】${question}\n\n【参照条文】${context}${detailWarning}\n\n回答:`,
      },
    ],
    temperature: 0,
    max_tokens: 500,
  });

  try {
    const content = response.choices[0]?.message?.content?.trim() || '';
    const cleaned = content.replace(/```json\n?|```\n?/g, '');
    const parsed = JSON.parse(cleaned);

    const topScore = results[0]?.combinedScore || 0;
    const confidence = topScore >= 0.9 ? 'A+' : topScore >= 0.75 ? 'A' : topScore >= 0.6 ? 'B' : 'C';

    return {
      answer: parsed.answer || '',
      reasoning: parsed.reasoning || '',
      references: results.map((r: any) => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        content: r.content,
        score: r.combinedScore,
      })),
      detailChecks: detailCheck.issues || [],
      confidence,
    };
  } catch (error) {
    console.error('AI応答の解析エラー:', error);
    return {
      answer: '×',
      reasoning: 'AI応答の解析に失敗しました。',
      references: results.map((r: any) => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        content: r.content,
        score: r.combinedScore,
      })),
      detailChecks: detailCheck.issues || [],
      confidence: 'C',
    };
  }
};

const generateRelatedQuestions = async (question: string, references: any[]): Promise<string[]> => {
  try {
    const context = references.slice(0, 2).map(r => r.sectionName).join('、');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `バスケットボール審判向けの関連質問を3つ生成してください。

【重要】
- 元の質問とは異なる角度から
- 実際に審判が知りたいであろう内容
- 具体的で実用的な質問

【悪い例】
- 「〜の具体例を教えてください」← 抽象的
- 「〜のシグナルは？」← 機械的

【良い例】
- 元の質問が「トラベリング」なら:
  1. ピボットフットを決める前に動いたらトラベリング？
  2. ジャンプ後に着地する前にパスを受けた場合は？
  3. トラベリングのシグナルは両手で回す？

JSON配列で返す: ["質問1", "質問2", "質問3"]`
      }, {
        role: 'user',
        content: `元の質問: ${question}\n関連条文: ${context}`
      }],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const cleaned = content.replace(/```json\n?|```\n?/g, '');
    const questions = JSON.parse(cleaned);

    return Array.isArray(questions) ? questions.slice(0, 3) : [];
  } catch (error) {
    console.error('関連質問生成エラー:', error);
    return [];
  }
};

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: '質問が必要です' }, { status: 400 });
    }

    // 拡張検索
    const searchData = await enhancedSearch(question);

    // 判断理由付き回答
    const result = await getAIJudgmentWithReasoning(question, searchData);

    // 関連質問生成（LLM）
    const relatedQuestions = await generateRelatedQuestions(question, result.references);

    // 審判シグナル画像を検索
    const matchedSignalImages = searchSignalImages(question);

    return NextResponse.json({
      answer: result.answer, // 簡潔な結論
      rawAnswer: result.answer, // 同じ
      normalizedQuestion: question,
      ragResults: result.references.map(r => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        similarity: r.score,
      })),
      relatedQuestions, // 既存機能
      signalImages: matchedSignalImages.map(img => ({
        name: img.name,
        path: img.path,
        description: img.description,
      })),
      // v1.1.0 新機能
      reasoning: result.reasoning,
      references: result.references,
      detailChecks: result.detailChecks,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
