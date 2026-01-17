'use client';

import { useState } from 'react';
import FeedbackForm from '@/components/FeedbackForm';

interface RagResult {
  sectionId: string;
  sectionName: string;
  similarity: number;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [rawAnswer, setRawAnswer] = useState('');
  const [normalizedQuestion, setNormalizedQuestion] = useState('');
  const [ragResults, setRagResults] = useState<RagResult[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    setAnswer('');
    setRawAnswer('');
    setNormalizedQuestion('');
    setRagResults([]);
    setRelatedQuestions([]);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('回答の取得に失敗しました');
      }

      const data = await response.json();
      setAnswer(data.answer);
      setRawAnswer(data.rawAnswer);
      setNormalizedQuestion(data.normalizedQuestion);
      setRagResults(data.ragResults || []);
      setRelatedQuestions(data.relatedQuestions || []);
    } catch (err: any) {
      console.error('エラー詳細:', err);
      
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        setError('ネットワークエラーが発生しました。インターネット接続を確認してください。');
      } else if (err.message.includes('Supabase') || err.message.includes('Database')) {
        setError('データベース接続エラーが発生しました。しばらく待ってから再度お試しください。');
      } else if (err.message.includes('OpenAI') || err.message.includes('API')) {
        setError('AI APIエラーが発生しました。しばらく待ってから再度お試しください。');
      } else {
        setError('エラーが発生しました。もう一度お試しください。エラーが続く場合は管理者にお問い合わせください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRelatedQuestion = (relatedQ: string) => {
    setQuestion(relatedQ);
    // スクロールをトップに
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 少し待ってから自動送信
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🏀 バスケ審判AI
          </h1>
          <p className="text-gray-600 mt-2">
            JBA競技規則（2025年版）に基づいた質問に回答します
          </p>
          {/* ベータ版注意書き */}
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-900">
              ⚠️ <strong>ベータ版</strong>：回答が間違っている場合は、フィードバックをお願いします。
            </p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 質問入力フォーム */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="space-y-3">
            <label htmlFor="question" className="block text-base font-bold text-gray-900 px-1">
              質問を入力してください
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例: アンスポの4つのクライテリアを教えてください"
              className="w-full p-3 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base text-gray-900 placeholder-gray-400 resize-none shadow-sm"
              rows={5}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-lg transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md text-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  回答を生成中...
                </span>
              ) : (
                '質問する'
              )}
            </button>
          </div>
        </form>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* 回答表示 */}
        {answer && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📖 回答</h2>
            
            {/* AI回答 */}
            <div
              className="prose prose-lg max-w-none mb-6"
              dangerouslySetInnerHTML={{ __html: answer }}
            />

            {/* 関連質問（新規追加） */}
            {relatedQuestions && relatedQuestions.length > 0 && (
              <div className="mt-8 p-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-lg font-bold text-blue-900 mb-3">
                  💡 もしかして、こんな質問ですか？
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  クリックすると、その質問で検索できます
                </p>
                <div className="space-y-2">
                  {relatedQuestions.map((relatedQ, index) => (
                    <button
                      key={index}
                      onClick={() => handleRelatedQuestion(relatedQ)}
                      className="w-full text-left p-3 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg transition text-gray-800 text-sm"
                    >
                      <span className="font-semibold text-blue-700">{index + 1}. </span>
                      {relatedQ}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 検索された条文（デバッグ情報） */}
            {ragResults && ragResults.length > 0 && (
              <details className="mt-6 p-4 bg-gray-50 rounded-lg">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  🔍 参照した条文（{ragResults.length}件）
                </summary>
                <ul className="mt-3 space-y-2">
                  {ragResults.map((result, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {index + 1}. {result.sectionId} {result.sectionName} 
                      <span className="text-gray-400 ml-2">
                        (類似度: {(result.similarity * 100).toFixed(1)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* フィードバックフォーム */}
            <FeedbackForm
              question={question}
              aiAnswer={rawAnswer || answer}
              normalizedQuestion={normalizedQuestion || question}
              ragResults={ragResults}
            />
          </div>
        )}

        {/* 使い方ガイド */}
        {!answer && !loading && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💡 使い方</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-orange-500 font-bold mr-2">1.</span>
                <span>バスケットボール競技規則に関する質問を入力してください</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-500 font-bold mr-2">2.</span>
                <span>AIが関連する条文を検索して回答を生成します</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-500 font-bold mr-2">3.</span>
                <span>関連する質問候補も表示されるので、クリックして詳しく調べられます</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-500 font-bold mr-2">4.</span>
                <span>回答が正しくない場合はフィードバックをお願いします</span>
              </li>
            </ul>

            <div className="mt-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>📌 よくある質問例：</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• アンスポーツマンライクファウルの判定基準は？</li>
                <li>• ショットクロック残り18秒でヘルドボール、オフェンス継続の場合は？</li>
                <li>• 試合開始前のテクニカルファウルの記録方法は？</li>
                <li>• ゲームクロック残り2秒でフリースローの場合、ショットクロックは？</li>
                <li>• 審判がゲームクロックを進めることはありますか？</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-12 py-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-600 text-sm">
          <p>バスケ審判AI - JBA公式競技規則（2025年版）に基づく</p>
          <p className="mt-1">Beta Version - フィードバックをお待ちしています</p>
        </div>
      </footer>
    </div>
  );
}