# バスケ審判AI - 機能一覧

## リグレッション防止について

`npm run build` 実行時に `tests/check-core-features.sh` が自動で走り、
全機能の重要コードが存在することを検証します。
チェックに失敗するとビルドが中断されます。

新しい機能を追加した場合は、`tests/check-core-features.sh` にもチェックを追加してください。

---

## 機能一覧

### 1. 質問回答 API（/api/ask）

| 項目 | 内容 |
|------|------|
| ファイル | `app/api/ask/route.ts` |
| 概要 | ユーザーの質問を受け取り、RAG検索 → AI回答生成 → 関連質問・シグナル画像を返す |
| モデル | GPT-4o-mini（回答: temperature 0、関連質問: temperature 0.7） |
| 依存 | `lib/enhanced_search.ts`, `lib/signal-images.ts`, OpenAI API |

**レスポンス構造:**
- `answer` - 簡潔な結論
- `reasoning` - 詳細な説明と根拠条文
- `references` - 参照した条文一覧
- `ragResults` - RAG検索結果
- `relatedQuestions` - 関連質問3件
- `signalImages` - 審判シグナル画像
- `confidence` - 信頼度（A+/A/B/C）
- `detailChecks` - 詳細条件チェック結果

---

### 2. クエリログ保存（query_logs）

| 項目 | 内容 |
|------|------|
| ファイル | `app/api/ask/route.ts` 内 |
| テーブル | `query_logs` |
| 概要 | 全ての質問と回答をSupabaseに記録する |
| 依存先 | 日次レポート機能がこのテーブルに依存 |

**保存フィールド:**
`question`, `normalized_question`, `ai_answer`, `raw_answer`, `rag_results`,
`rag_count`, `response_time_ms`, `user_agent`, `ip_address`, `referrer`, `model_used`

> この処理を削除すると日次レポートが機能しなくなります。

---

### 3. RAG 検索エンジン（ベクトル + キーワード + フレーズ）

| 項目 | 内容 |
|------|------|
| ファイル | `lib/enhanced_search.ts`, `lib/rag-v2.ts` |
| 概要 | 3段階の検索パイプラインで最適な条文を特定する |
| Embedding | OpenAI `text-embedding-3-small` |
| RPC | `match_jba_rules()` |
| テーブル | `jba_rules` |

**検索パイプライン:**
1. **Stage 1**: ベクトル検索（`searchRules()` → `match_jba_rules` RPC）
2. **Stage 2**: キーワード補強（スコア < 0.75 の場合、ilike検索で補完）
3. **Stage 3**: 詳細条件チェック（時間条件、限定表現、否定形の検証）

**スコアリング（v5）:**
- ベクトル類似度: 70%
- ランクスコア: 15%
- フレーズスコア: 15%

---

### 4. フレーズマッチング

| 項目 | 内容 |
|------|------|
| ファイル | `lib/phrase-matching-v2.ts` |
| 概要 | 質問と条文のフレーズ一致度をスコアリングする |
| エクスポート | `calculatePhraseScoreV2()`, `findMatchingPhrasesV2()` |

**ボーナスパターン:** ヘルドボール (+0.15), アウトオブバウンズ (+0.15), ショットクロック (+0.15), 複合パターン (+0.20)

---

### 5. 審判シグナル画像

| 項目 | 内容 |
|------|------|
| ファイル | `lib/signal-images.ts` |
| 概要 | 質問内容に関連する審判シグナル画像を検索・表示する |
| 画像パス | `/public/images/signals/` |
| エクスポート | `searchSignalImages()`, `signalImages[]`, `SignalImage` |

47種のシグナル画像をキーワードベースで検索（上位3件を返却）。

---

### 6. フィードバック機能

| 項目 | 内容 |
|------|------|
| ファイル | `components/FeedbackForm.tsx` |
| テーブル | `feedbacks` |
| 概要 | ユーザーがAI回答の正確性を報告できるフォーム |

**フィードバック種別:** `correct`, `partially_wrong`, `completely_wrong`
**審判レベル:** S級〜E級、一般（資格なし）

---

### 7. 日次レポート（Supabase Edge Function）

| 項目 | 内容 |
|------|------|
| ファイル | `supabase/functions/daily-report/index.ts` |
| スケジュール | 毎日 23:00 UTC（= 08:00 JST） |
| メール送信 | Resend API |
| 宛先 | marchin.momo@gmail.com |

**レポート内容:**
- 前日の質問数（前々日との比較）
- 平均応答時間
- 質問一覧
- 累計質問数

**環境変数（Supabase側）:** `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

### 8. Vercel Analytics

| 項目 | 内容 |
|------|------|
| ファイル | `app/layout.tsx` |
| 概要 | ページビュー・インタラクションの自動追跡 |
| パッケージ | `@vercel/analytics` |

---

## 環境変数一覧

### アプリケーション（.env.local）
| 変数名 | 用途 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API（回答生成 + Embedding） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |

### Edge Function（Supabase側）
| 変数名 | 用途 |
|--------|------|
| `RESEND_API_KEY` | Resend メール送信 API |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |

---

## データベーステーブル

| テーブル | 用途 | 主な参照元 |
|----------|------|-----------|
| `jba_rules` | JBA競技規則（ベクトル検索対象） | `lib/rag-v2.ts` |
| `query_logs` | クエリログ | `app/api/ask/route.ts`, `daily-report` |
| `feedbacks` | ユーザーフィードバック | `components/FeedbackForm.tsx` |

### RPC 関数
| 関数名 | 用途 |
|--------|------|
| `match_jba_rules()` | ベクトル類似度検索 |
