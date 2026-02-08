import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// LLMで登場人物と行動を抽出
export const extractPlayerActions = async (text: string) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `バスケットボールの問題文から、登場人物と行動を抽出してください。

【出力形式】JSON配列
[
  {
    "player": "A1",
    "action": "ショット",
    "object": "バスケット",
    "result": "成功"
  },
  {
    "player": "B1",
    "action": "押す",
    "object": "B2",
    "result": ""
  }
]

【重要】
- すべての登場人物（A1, B2など）を抽出
- 誰が何をしたか
- 誰に対して
- 結果（宣せられる、与えられる）

**JSON配列のみを返してください。説明は不要です。**`
    }, {
      role: 'user',
      content: text
    }],
    temperature: 0,
    max_tokens: 500,
  });

  try {
    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.log('    [警告] JSON解析失敗');
    return [];
  }
};

// 整合性チェック
export const checkConsistency = (actions: any[]) => {
  // 実際に接触したプレーヤーを特定
  const contactActions = actions.filter(a =>
    a.action?.includes('接触') ||
    a.action?.includes('触れ') ||
    a.action?.includes('触れ合い') ||
    a.action?.includes('ファウル') && a.object
  );

  // ファウルを宣せられたプレーヤーを特定
  const foulActions = actions.filter(a =>
    (a.action?.includes('ファウル') || a.action?.includes('ヴァイオレイション')) &&
    (a.result?.includes('宣せられる') || a.result?.includes('与えられる'))
  );

  if (contactActions.length > 0 && foulActions.length > 0) {
    // 接触したプレーヤー
    const contactPlayer = contactActions[0].player;

    // ファウル宣告されたプレーヤー
    const foulPlayer = foulActions[0].player;

    if (contactPlayer && foulPlayer && contactPlayer !== foulPlayer) {
      return {
        hasInconsistency: true,
        contactPlayer,
        foulPlayer,
        reason: `${contactPlayer}が接触/ファウルしたのに、${foulPlayer}にファウルが宣せられている（接触したプレーヤーにファウルを宣すべき）`,
      };
    }
  }

  return { hasInconsistency: false };
};
