#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = 'tests/google_sheets_sync/jba-rag-test-system-29974349385f.json'
SPREADSHEET_ID = '1Fk8FgOC7RdblFzakDTXj-DJx4bz4Ck_-sDN9Tx37Sbc'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def load_results(result_path):
    with open(result_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_sheets_service():
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build('sheets', 'v4', credentials=credentials)

def update_spreadsheet(service, data):
    rows = []
    for result in data['results']:
        combined_score = result['search_results'][0]['combinedScore'] if result['search_results'] else ''
        if combined_score:
            combined_score = round(combined_score, 3)

        row = [
            result['ai_answer'],
            '=IF(C{0}=D{0},"○","×")'.format(result['question_number'] + 1),
            result['confidence_grade'],
            result['top_article'],
            combined_score,
            result['response_time_ms'],
            data['timestamp'],
        ]
        rows.append(row)

    updates = [
        {
            'range': f'テスト結果!D2:I{len(rows) + 1}',
            'values': [r[:6] for r in rows]
        },
        {
            'range': f'テスト結果!M2:M{len(rows) + 1}',
            'values': [[r[6]] for r in rows]
        }
    ]

    body = {
        'valueInputOption': 'USER_ENTERED',
        'data': updates
    }

    result = service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body=body
    ).execute()

    print(f"   更新されたセル数: {result.get('totalUpdatedCells')}")
    print(f"   正解率: {data['accuracy_rate']:.2f}%")

def main():
    if len(sys.argv) < 2:
        print("使用方法: python3 update_sheet_with_results.py <結果JSONパス>")
        sys.exit(1)

    result_path = sys.argv[1]
    data = load_results(result_path)
    service = create_sheets_service()
    update_spreadsheet(service, data)

if __name__ == '__main__':
    main()
