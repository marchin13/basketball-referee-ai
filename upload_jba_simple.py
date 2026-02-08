import json
import os
from supabase import create_client

# 環境変数から取得
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')

if not supabase_url or not supabase_key:
    print("エラー: 環境変数を設定してください")
    exit(1)

# Supabaseクライアント
supabase = create_client(supabase_url, supabase_key)

# JSONファイル読み込み
with open('jba_rules_final.json', 'r', encoding='utf-8') as f:
    sections = json.load(f)

print(f"読み込んだセクション数: {len(sections)}")
print("="*80)

# 既存データの削除
print("既存データを削除中...")
try:
    supabase.table('jba_rules').delete().neq('id', 0).execute()
    print("削除完了")
except Exception as e:
    print(f"削除エラー: {e}")

# 必要なフィールドだけを抽出
cleaned_sections = []
for s in sections:
    cleaned = {
        'section_id': s['section_id'],
        'section_name': s['section_name'],
        'part': s['part'],
        'type': s['type'],
        'chapter': s.get('chapter'),
        'article': s['article'],
        'section': s.get('section'),
        'content': s['content'],
        'is_split': s.get('is_split', False),
        'split_index': s.get('split_index'),
        'split_total': s.get('split_total')
    }
    cleaned_sections.append(cleaned)

# アップロード
print("\nデータをアップロード中...")
uploaded = 0
batch_size = 100

for i in range(0, len(cleaned_sections), batch_size):
    batch = cleaned_sections[i:i+batch_size]
    try:
        supabase.table('jba_rules').insert(batch).execute()
        uploaded += len(batch)
        print(f"進捗: {uploaded}/{len(cleaned_sections)} ({uploaded*100//len(cleaned_sections)}%)")
    except Exception as e:
        print(f"エラー: {e}")
        break

print("\n" + "="*80)
print(f"アップロード完了: {uploaded}件")
print("="*80)

# 統計確認
try:
    result = supabase.table('jba_rules').select('*', count='exact').execute()
    print(f"\nデータベース登録件数: {result.count}件")
except Exception as e:
    print(f"統計エラー: {e}")
