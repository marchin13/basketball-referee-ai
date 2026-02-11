#!/bin/bash
# ==============================================================================
# コア機能リグレッション防止スクリプト
# ==============================================================================
# ビルド前に全機能の重要コードが存在することを検証する。
# package.json の prebuild で自動実行される。
#
# 背景: v1.1.0 リファクタリング時に query_logs 保存コードが削除され、
# 日次レポート機能が停止するデグレが発生。全機能を網羅的にチェックし再発を防止する。
#
# 使い方:
#   bash tests/check-core-features.sh
#
# 新しい機能を追加した場合は、このスクリプトにもチェックを追加してください。
# ==============================================================================

PASS=0
FAIL=0

# --- ユーティリティ ---

check_file_exists() {
  local file="$1"
  local desc="$2"
  if [ -f "$file" ]; then
    return 0
  else
    echo "  ❌ ファイルが存在しません: $file"
    echo "     $desc"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

check_pattern() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    return 0
  else
    echo "  ❌ $desc"
    echo "     パターン '$pattern' が $file に見つかりません"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

feature_start() {
  echo ""
  echo "--- $1 ---"
}

feature_pass() {
  echo "  ✅ $1"
  PASS=$((PASS + 1))
}

# ==============================================================================
# 1. 質問回答 API エンドポイント (/api/ask)
# ==============================================================================
feature_start "1. 質問回答 API（/api/ask）"

API_ROUTE="app/api/ask/route.ts"
if check_file_exists "$API_ROUTE" "API エンドポイントが必要です"; then
  ALL_OK=true

  check_pattern "$API_ROUTE" "export async function POST" \
    "POST ハンドラーが必要です" || ALL_OK=false

  check_pattern "$API_ROUTE" "import OpenAI" \
    "OpenAI のインポートが必要です（AI 回答生成に使用）" || ALL_OK=false

  check_pattern "$API_ROUTE" "import.*enhancedSearch.*from" \
    "enhancedSearch のインポートが必要です（RAG 検索に使用）" || ALL_OK=false

  check_pattern "$API_ROUTE" "import.*searchSignalImages.*from" \
    "searchSignalImages のインポートが必要です（審判シグナル画像に使用）" || ALL_OK=false

  check_pattern "$API_ROUTE" "getAIJudgmentWithReasoning" \
    "getAIJudgmentWithReasoning 関数が必要です（推論付き回答生成）" || ALL_OK=false

  check_pattern "$API_ROUTE" "generateRelatedQuestions" \
    "generateRelatedQuestions 関数が必要です（関連質問生成）" || ALL_OK=false

  if $ALL_OK; then
    feature_pass "質問回答 API - 正常"
  fi
fi

# ==============================================================================
# 2. query_logs ログ保存（日次レポートが依存）
# ==============================================================================
feature_start "2. クエリログ保存（query_logs）"

if [ -f "$API_ROUTE" ]; then
  ALL_OK=true

  check_pattern "$API_ROUTE" "import.*createClient.*from.*@supabase/supabase-js" \
    "Supabase クライアントのインポートが必要です" || ALL_OK=false

  check_pattern "$API_ROUTE" "from('query_logs')" \
    "query_logs テーブルへの保存処理が必要です（日次レポートが依存）" || ALL_OK=false

  check_pattern "$API_ROUTE" "response_time_ms" \
    "応答時間の記録が必要です（日次レポートが依存）" || ALL_OK=false

  check_pattern "$API_ROUTE" "NEXT_PUBLIC_SUPABASE_URL" \
    "Supabase URL 環境変数の参照が必要です" || ALL_OK=false

  check_pattern "$API_ROUTE" "NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    "Supabase Anon Key 環境変数の参照が必要です" || ALL_OK=false

  if $ALL_OK; then
    feature_pass "クエリログ保存 - 正常"
  fi
fi

# ==============================================================================
# 3. RAG 検索エンジン（ベクトル検索 + キーワード検索）
# ==============================================================================
feature_start "3. RAG 検索エンジン"

ENHANCED_SEARCH="lib/enhanced_search.ts"
RAG_V2="lib/rag-v2.ts"

ALL_OK=true

if check_file_exists "$ENHANCED_SEARCH" "拡張検索モジュールが必要です"; then
  check_pattern "$ENHANCED_SEARCH" "export.*enhancedSearch" \
    "enhancedSearch のエクスポートが必要です" || ALL_OK=false

  check_pattern "$ENHANCED_SEARCH" "searchRules" \
    "searchRules の呼び出しが必要です（ベクトル検索）" || ALL_OK=false
else
  ALL_OK=false
fi

if check_file_exists "$RAG_V2" "RAG v2 モジュールが必要です"; then
  check_pattern "$RAG_V2" "export.*function searchRules" \
    "searchRules 関数のエクスポートが必要です" || ALL_OK=false

  check_pattern "$RAG_V2" "match_jba_rules" \
    "match_jba_rules RPC 呼び出しが必要です（ベクトル検索）" || ALL_OK=false

  check_pattern "$RAG_V2" "text-embedding" \
    "OpenAI Embedding モデルの指定が必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "RAG 検索エンジン - 正常"
fi

# ==============================================================================
# 4. フレーズマッチング
# ==============================================================================
feature_start "4. フレーズマッチング"

PHRASE_V2="lib/phrase-matching-v2.ts"
ALL_OK=true

if check_file_exists "$PHRASE_V2" "フレーズマッチング v2 モジュールが必要です"; then
  check_pattern "$PHRASE_V2" "export.*calculatePhraseScoreV2" \
    "calculatePhraseScoreV2 のエクスポートが必要です" || ALL_OK=false

  check_pattern "$PHRASE_V2" "export.*findMatchingPhrasesV2" \
    "findMatchingPhrasesV2 のエクスポートが必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "フレーズマッチング - 正常"
fi

# ==============================================================================
# 5. 審判シグナル画像
# ==============================================================================
feature_start "5. 審判シグナル画像"

SIGNAL_IMAGES="lib/signal-images.ts"
ALL_OK=true

if check_file_exists "$SIGNAL_IMAGES" "審判シグナル画像モジュールが必要です"; then
  check_pattern "$SIGNAL_IMAGES" "export function searchSignalImages" \
    "searchSignalImages 関数のエクスポートが必要です" || ALL_OK=false

  check_pattern "$SIGNAL_IMAGES" "export.*signalImages" \
    "signalImages データ配列のエクスポートが必要です" || ALL_OK=false

  check_pattern "$SIGNAL_IMAGES" "export interface SignalImage" \
    "SignalImage インターフェースのエクスポートが必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "審判シグナル画像 - 正常"
fi

# ==============================================================================
# 6. フィードバック機能
# ==============================================================================
feature_start "6. フィードバック機能"

FEEDBACK="components/FeedbackForm.tsx"
ALL_OK=true

if check_file_exists "$FEEDBACK" "フィードバックフォームコンポーネントが必要です"; then
  check_pattern "$FEEDBACK" "import.*createClient.*from.*@supabase/supabase-js" \
    "Supabase クライアントのインポートが必要です" || ALL_OK=false

  check_pattern "$FEEDBACK" "from('feedbacks')" \
    "feedbacks テーブルへの保存処理が必要です" || ALL_OK=false

  check_pattern "$FEEDBACK" "export default function FeedbackForm" \
    "FeedbackForm コンポーネントのエクスポートが必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "フィードバック機能 - 正常"
fi

# ==============================================================================
# 7. 日次レポート（Supabase Edge Function）
# ==============================================================================
feature_start "7. 日次レポート（Edge Function）"

DAILY_REPORT="supabase/functions/daily-report/index.ts"
ALL_OK=true

if check_file_exists "$DAILY_REPORT" "日次レポート Edge Function が必要です"; then
  check_pattern "$DAILY_REPORT" "from(\"query_logs\")" \
    "query_logs テーブルの参照が必要です" || ALL_OK=false

  check_pattern "$DAILY_REPORT" "RESEND_API_KEY" \
    "Resend API Key の参照が必要です（メール送信）" || ALL_OK=false

  check_pattern "$DAILY_REPORT" "api.resend.com/emails" \
    "Resend API エンドポイントの呼び出しが必要です" || ALL_OK=false

  check_pattern "$DAILY_REPORT" "SUPABASE_SERVICE_ROLE_KEY" \
    "Supabase Service Role Key の参照が必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "日次レポート - 正常"
fi

# ==============================================================================
# 8. Vercel Analytics
# ==============================================================================
feature_start "8. Vercel Analytics"

LAYOUT="app/layout.tsx"
ALL_OK=true

if check_file_exists "$LAYOUT" "レイアウトファイルが必要です"; then
  check_pattern "$LAYOUT" "import.*Analytics.*from.*@vercel/analytics" \
    "Vercel Analytics のインポートが必要です" || ALL_OK=false

  check_pattern "$LAYOUT" "<Analytics" \
    "Analytics コンポーネントの使用が必要です" || ALL_OK=false
else
  ALL_OK=false
fi

if $ALL_OK; then
  feature_pass "Vercel Analytics - 正常"
fi

# ==============================================================================
# 9. 必須ファイル存在チェック
# ==============================================================================
feature_start "9. 必須ファイル"

REQUIRED_FILES=(
  "app/page.tsx:メインページ"
  "app/layout.tsx:ルートレイアウト"
  "app/api/ask/route.ts:質問 API"
  "lib/enhanced_search.ts:拡張検索"
  "lib/rag-v2.ts:RAG エンジン"
  "lib/phrase-matching-v2.ts:フレーズマッチング"
  "lib/signal-images.ts:シグナル画像"
  "components/FeedbackForm.tsx:フィードバックフォーム"
  "supabase/functions/daily-report/index.ts:日次レポート"
)

FILES_OK=true
for entry in "${REQUIRED_FILES[@]}"; do
  file="${entry%%:*}"
  desc="${entry##*:}"
  if [ ! -f "$file" ]; then
    echo "  ❌ $file ($desc) が存在しません"
    FAIL=$((FAIL + 1))
    FILES_OK=false
  fi
done

if $FILES_OK; then
  feature_pass "必須ファイル - 全 ${#REQUIRED_FILES[@]} ファイル存在"
fi

# ==============================================================================
# 結果サマリー
# ==============================================================================
echo ""
echo "=============================================="
TOTAL=$((PASS + FAIL))

if [ $FAIL -eq 0 ]; then
  echo "✅ 全チェック合格（$PASS / $TOTAL）"
  echo "=============================================="
  exit 0
else
  echo "❌ リグレッション検出（$FAIL 件の問題）"
  echo "   合格: $PASS / 不合格: $FAIL"
  echo "=============================================="
  echo ""
  echo "上記の問題を修正してからビルドしてください。"
  echo "詳細: FEATURES.md を参照"
  exit 1
fi
