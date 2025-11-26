// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// .env.local ファイルでこれらが設定されていることを確認してください
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL または Anon Key が見つかりません。同期機能は無効化されます。');
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// API ルート用のサーバーサイドクライアントを取得する方法も必要になるかもしれません
// これはクライアントサイド用の簡略化されたクライアントです。
// API ルートの場合、通常はリクエスト/レスポンスを createClient に渡すか、
// サービスロールキーを持つ別の管理者クライアントを使用します。
// 今は基本的なクライアントサイドのセットアップに限定します。
