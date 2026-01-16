'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface FeedbackFormProps {
  question: string;
  aiAnswer: string;
  normalizedQuestion: string;
  ragResults: any[];
}

export default function FeedbackForm({
  question,
  aiAnswer,
  normalizedQuestion,
  ragResults
}: FeedbackFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [refereeLevel, setRefereeLevel] = useState('');
  const [feedbackType, setFeedbackType] = useState<'correct' | 'partially_wrong' | 'completely_wrong' | ''>('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!refereeLevel || !feedbackType) {
      alert('審判級と評価を選択してください');
      return;
    }

    if (feedbackType !== 'correct' && !correctAnswer) {
      alert('正しい回答を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.from('feedbacks').insert({
        question,
        ai_answer: aiAnswer,
        normalized_question: normalizedQuestion,
        rag_results: ragResults,
        referee_level: refereeLevel,
        is_correct: feedbackType === 'correct',
        feedback_type: feedbackType,
        correct_answer: feedbackType === 'correct' ? null : correctAnswer,
        explanation: explanation || null,
      });

      if (error) throw error;

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('フィードバック送信エラー:', error);
      alert('送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
        <p className="text-green-900 font-bold text-lg">✅ フィードバックを送信しました。ありがとうございます！</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition shadow-md"
        >
          💬 この回答についてフィードバックする
        </button>
      ) : (
        <div className="border-2 border-gray-400 rounded-lg p-6 bg-white shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-gray-900">📝 フィードバック</h3>

          {/* 審判級 */}
          <div className="mb-6">
            <label className="block text-base font-bold mb-3 text-gray-900">
              あなたの審判資格
            </label>
            <select
              value={refereeLevel}
              onChange={(e) => setRefereeLevel(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-gray-900 font-medium text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="" className="text-gray-500">選択してください</option>
              <option value="S級" className="text-gray-900">S級審判員</option>
              <option value="1級" className="text-gray-900">1級審判員</option>
              <option value="2級" className="text-gray-900">2級審判員</option>
              <option value="A級" className="text-gray-900">A級審判員</option>
              <option value="B級" className="text-gray-900">B級審判員</option>
              <option value="C級" className="text-gray-900">C級審判員</option>
              <option value="D級" className="text-gray-900">D級審判員</option>
              <option value="E級" className="text-gray-900">E級審判員</option>
              <option value="一般" className="text-gray-900">一般（資格なし）</option>
            </select>
          </div>

          {/* 評価 */}
          <div className="mb-6">
            <label className="block text-base font-bold mb-3 text-gray-900">
              この回答の評価
            </label>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer p-3 rounded-lg hover:bg-green-50 transition">
                <input
                  type="radio"
                  name="feedback"
                  value="correct"
                  checked={feedbackType === 'correct'}
                  onChange={(e) => setFeedbackType(e.target.value as any)}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-green-800 font-bold text-lg">✅ 正しい</span>
              </label>
              <label className="flex items-center cursor-pointer p-3 rounded-lg hover:bg-yellow-50 transition">
                <input
                  type="radio"
                  name="feedback"
                  value="partially_wrong"
                  checked={feedbackType === 'partially_wrong'}
                  onChange={(e) => setFeedbackType(e.target.value as any)}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-yellow-800 font-bold text-lg">⚠️ 一部異なる</span>
              </label>
              <label className="flex items-center cursor-pointer p-3 rounded-lg hover:bg-red-50 transition">
                <input
                  type="radio"
                  name="feedback"
                  value="completely_wrong"
                  checked={feedbackType === 'completely_wrong'}
                  onChange={(e) => setFeedbackType(e.target.value as any)}
                  className="mr-3 w-5 h-5"
                />
                <span className="text-red-800 font-bold text-lg">❌ 間違っている</span>
              </label>
            </div>
          </div>

          {/* 正しい回答 */}
          {feedbackType && feedbackType !== 'correct' && (
            <div className="mb-6">
              <label className="block text-base font-bold mb-3 text-gray-900">
                正しい回答 <span className="text-red-600">*</span>
              </label>
              <textarea
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="w-full p-4 border-2 border-gray-300 rounded-lg h-40 text-gray-900 text-base placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="正しい回答を入力してください"
              />
            </div>
          )}

          {/* 補足説明 */}
          <div className="mb-6">
            <label className="block text-base font-bold mb-3 text-gray-900">
              補足説明（任意）
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full p-4 border-2 border-gray-300 rounded-lg h-32 text-gray-900 text-base placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="なぜそう判断したかの理由や、参照すべき条文など"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md text-lg"
            >
              {isSubmitting ? '送信中...' : '送信'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition shadow-md text-lg"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}