#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = 'jba-rag-test-system-29974349385f.json'
SPREADSHEET_ID = '1Fk8FgOC7RdblFzakDTXj-DJx4bz4Ck_-sDN9Tx37Sbc'
QUESTIONS_JSON = 'jba_test_questions_178.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def load_questions():
    print("📂 問題データを読み込んでいます...")
    with open(QUESTIONS_JSON, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    print(f"✅ {len(questions)}問のデータを読み込みました")
    return questions

def create_sheets_service():
    print("🔐 Google Sheets APIに認証中...")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)
    print("✅ 認証成功")
    return service

def write_to_spreadsheet(service, questions):
    print(f"\n📝 スプレッドシートに書き込んでいます...")

    rows = []
    for q in questions:
        row = [
            q['question_number'],
            q['question_text'],
            q['correct_answer'],
            '',  # AI回答
            '',  # 判定
            '',  # 信頼度スコア
            '',  # 検索された条文
            '',  # 検索スコア
            '',  # 応答時間
            q['category'],
            q['difficulty'],
            q['explanation'],
            '',  # テスト実行日時
            ''   # 備考
        ]
        rows.append(row)

    range_name = f'テスト結果!A2:N{len(rows) + 1}'
    body = {'values': rows}

    result = service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=range_name,
        valueInputOption='RAW',
        body=body
    ).execute()

    print(f"✅ 書き込み成功！")
    print(f"   更新されたセル数: {result.get('updatedCells')}")
    print(f"   更新された行数: {result.get('updatedRows')}")
    print(f"\n🔗 スプレッドシートURL:")
    print(f"   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")

def main():
    print("="*60)
    print("JBA試験問題 → Google Sheets 書き込みツール")
    print("="*60)
    print()

    questions = load_questions()
    questions.sort(key=lambda x: x['question_number'])

    service = create_sheets_service()
    write_to_spreadsheet(service, questions)

    print("\n" + "="*60)
    print("🎉 すべての処理が完了しました！")
    print("="*60)

if __name__ == '__main__':
    main()
