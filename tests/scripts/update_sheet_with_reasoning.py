#!/usr/bin/env python3
import json
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = 'tests/google_sheets_sync/jba-rag-test-system-29974349385f.json'
SPREADSHEET_ID = '1Fk8FgOC7RdblFzakDTXj-DJx4bz4Ck_-sDN9Tx37Sbc'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def main():
    result_path = sys.argv[1]

    with open(result_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)

    # データ行を作成
    rows = []
    for r in data['results']:
        row_number = r['question_number'] + 1  # スプレッドシートの行番号（ヘッダー考慮）

        # スコア計算
        combined_score = ''
        if r.get('confidence_grade'):
            if r['confidence_grade'] == 'A+':
                combined_score = 0.95
            elif r['confidence_grade'] == 'A':
                combined_score = 0.85
            elif r['confidence_grade'] == 'B':
                combined_score = 0.7
            else:
                combined_score = 0.5

        row = [
            r['ai_answer'],                              # D: AI回答
            r.get('references', ''),                     # E: 回答根拠
            r.get('reasoning', ''),                      # F: AI判断理由
            f'=IF(C{row_number}=D{row_number},"○","×")', # G: 判定（動的式）
            r.get('confidence_grade', ''),               # H: 信頼度スコア
            r.get('top_article', ''),                    # I: 検索された条文
            combined_score,                              # J: 検索スコア
            r.get('response_time_ms', ''),               # K: 応答時間(ms)
            data['timestamp'],                           # O: テスト実行日時
        ]
        rows.append(row)

    # 列ごとに更新（式が正しく設定されるようにUSER_ENTEREDを使用）
    updates = [
        {
            'range': f'テスト結果!D2:K{len(rows)+1}',
            'values': [r[:8] for r in rows]  # D-K列
        },
        {
            'range': f'テスト結果!O2:O{len(rows)+1}',
            'values': [[r[8]] for r in rows]  # O列（テスト実行日時）
        }
    ]

    body = {
        'valueInputOption': 'USER_ENTERED',  # 式を有効にする
        'data': updates
    }

    result = service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=body
    ).execute()

    print(f"✅ スプレッドシート更新完了")
    print(f"   更新されたセル数: {result.get('totalUpdatedCells')}")
    print(f"   正解率: {data['accuracy_rate']:.2f}%")

if __name__ == '__main__':
    main()
