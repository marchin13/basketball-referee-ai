import json
import os
from supabase import create_client, Client

def upload_to_supabase(json_file, supabase_url, supabase_key, table_name='jba_rules'):
    """構造化されたJBAルールをSupabaseにアップロード"""
    
    # Supabaseクライアントの初期化
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # JSONデータの読み込み
    with open(json_file, 'r', encoding='utf-8') as f:
        sections = json.load(f)
    
    print(f"読み込んだセクション数: {len(sections)}")
    print("="*80)
    
    # 既存データのクリア（オプション）
    print("既存データの削除...")
    try:
        # 全件削除
        supabase.table(table_name).delete().neq('id', 0).execute()
        print("削除完了")
    except Exception as e:
        print(f"削除時の警告: {e}")
    
    # データの準備とアップロード
    print("\nデータのアップロード開始...")
    uploaded_count = 0
    error_count = 0
    batch_size = 100  # バッチサイズ
    
    for i in range(0, len(sections), batch_size):
        batch = sections[i:i+batch_size]
        
        # Supabase用にデータを整形
        formatted_batch = []
        for section in batch:
            # section_nameの生成
            section_name = section['section_id']
            if section.get('is_split'):
                section_name = f"{section['section_id']} ({section.get('split_index')}/{section.get('split_total')})"
            
            formatted_section = {
                'section_id': section['section_id'],
                'section_name': section_name,
                'part': section['part'],
                'type': section['type'],
                'chapter': section.get('chapter'),
                'article': section.get('article'),
                'section': section.get('section'),
                'subsection': section.get('subsection'),
                'content': section['content'],
                'is_split': section.get('is_split', False),
                'split_index': section.get('split_index'),
                'split_total': section.get('split_total'),
                'line_start': section.get('line_start'),
                'line_end': section.get('line_end')
            }
            formatted_batch.append(formatted_section)
        
        try:
            # バッチアップロード
            response = supabase.table(table_name).insert(formatted_batch).execute()
            uploaded_count += len(batch)
            print(f"進捗: {uploaded_count}/{len(sections)} ({uploaded_count*100//len(sections)}%)")
        except Exception as e:
            error_count += len(batch)
            print(f"エラー (バッチ {i//batch_size + 1}): {str(e)[:200]}")
    
    print("\n" + "="*80)
    print("アップロード完了")
    print(f"成功: {uploaded_count}件")
    print(f"失敗: {error_count}件")
    print("="*80)
    
    # 統計情報の表示
    print("\nデータベース統計:")
    try:
        part1_result = supabase.table(table_name).select('*', count='exact').eq('part', 1).execute()
        part2_result = supabase.table(table_name).select('*', count='exact').eq('part', 2).execute()
        split_result = supabase.table(table_name).select('*', count='exact').eq('is_split', True).execute()
        
        print(f"第1部（競技規則）: {part1_result.count}件")
        print(f"第2部（インタープリテーション）: {part2_result.count}件")
        print(f"分割されたセクション: {split_result.count}件")
    except Exception as e:
        print(f"統計取得エラー: {e}")
    
    return uploaded_count, error_count

# 実行例
if __name__ == "__main__":
    # 環境変数からSupabase情報を取得
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("エラー: SUPABASE_URLとSUPABASE_KEYの環境変数を設定してください")
        print("\n使用方法:")
        print("export SUPABASE_URL='your-project-url'")
        print("export SUPABASE_KEY='your-anon-key'")
        print("python3 upload_to_supabase.py")
    else:
        json_file = 'jba_rules_final.json'
        upload_to_supabase(json_file, supabase_url, supabase_key)
