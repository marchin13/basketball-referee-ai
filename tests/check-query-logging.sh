#!/bin/bash
# Regression guard: query_logs への保存処理が API ルートに存在することを検証する
# この検証は npm run build の前に実行される（package.json の prebuild スクリプト）
#
# 背景: v1.1.0 リファクタリング時にログ保存コードが誤って削除され、
# 日次レポート機能が停止するデグレが発生した。再発防止のためのチェック。

API_ROUTE="app/api/ask/route.ts"

ERRORS=0

check() {
  if ! grep -q "$1" "$API_ROUTE"; then
    echo "ERROR: $API_ROUTE に '$1' が見つかりません。"
    echo "  -> $2"
    ERRORS=$((ERRORS + 1))
  fi
}

check "from('query_logs')" "query_logs テーブルへの保存処理が必要です（日次レポートが依存）"
check "createClient" "Supabase クライアントのインポートが必要です"
check "response_time_ms" "応答時間の記録が必要です（日次レポートが依存）"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "FAIL: query_logs ログ保存のリグレッションを検出しました（$ERRORS 件）"
  echo "app/api/ask/route.ts のログ保存処理を復元してください。"
  exit 1
fi

echo "OK: query_logs ログ保存の検証に合格しました"
