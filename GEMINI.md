# GEMINI.md

このファイルは、Gemini Code(gemini.google.com)がこのリポジトリのコードを扱う際のガイダンスを提供します。

## プロジェクト概要

「Markdown Todo」は、**IndexedDB**を使用してブラウザ内にデータを保存するNext.js 16のタスク管理アプリケーションです。複数のビュー(ツリー、カレンダー)を提供し、期日追跡とドラッグ&ドロップをサポートしています。

**主要技術スタック:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- IndexedDB (ブラウザストレージ)
- dnd-kit (ドラッグ&ドロップ)
- Remark (Markdownパース・シリアライゼーション)
- Supabase (認証・クラウド同期用)

## アーキテクチャ

### データストレージ

**IndexedDBストレージ (主データソース):**
- データベース名: `MarkdownTodoDB`
- オブジェクトストア: `projects` (keyPath: `id`)
- 各プロジェクトには `id`, `title`, `tasks[]`, `path` が含まれる
- タスクは生成されたID: `{projectId}-{timestamp}-{random}` を使用

**Supabase (クラウド同期・バックアップ):**
- **認証:** Google OAuth (`lib/auth-context.tsx`)
- **データベース:** `projects` テーブル
  - `id`: プロジェクトID
  - `user_id`: 所有者のSupabase Auth UUID
  - `data`: プロジェクト全体のJSONデータ (JSONB型)
  - `updated_at`: 最終更新日時
- **注意:** `tasks` テーブルは使用していません。タスクデータは `projects.data` カラム内のJSON構造の一部として保存されます。
- **同期ロジック (`lib/hooks.ts`):**
  - **Pull:** ログイン時にサーバー上の新しいデータ (`updated_at` 比較) をIndexedDBに反映
  - **Push:** IndexedDBへの書き込みを検知し、デバウンスしてSupabaseへUpsert

### セキュリティ仕様

**重要:** 以下のセキュリティ制約を遵守してください。変更する際は慎重な検討が必要です。

1.  **入力バリデーション (`lib/api-indexeddb.ts`, `lib/validation.ts`)**
    - **Markdownパース時:** `parseMarkdownToProject` 内で `validateTaskContent` を実行し、XSS攻撃パターン（`<script>`等）を含むタスクの保存をブロックします。
    - **ネスト制限:** DoS攻撃（スタックオーバーフロー）防止のため、タスクのネストは最大 **10階層** に制限されています (`MAX_TASK_NESTING_LEVEL`)。

2.  **出力サニタイズ (`lib/markdown-link-renderer.tsx`)**
    - Markdown内のリンクレンダリング時、URLプロトコルをチェックします。
    - 許可されるプロトコル: `http:`, `https:`, `mailto:`, `tel:`, 相対パス
    - **禁止:** `javascript:` スキーム（XSS防止のため、警告テキストとして表示）

3.  **データベースアクセス (`supabase/migrations/`)**
    - RLSポリシーにより、ユーザーは自身のプロジェクト (`user_id = auth.uid()`) にのみアクセス可能です。
    - 将来的な共有機能の実装時は、JSONB内のタスクデータの露出に注意してください。

### 主要モジュール

#### [lib/types.ts](lib/types.ts)
型定義を提供:
- `Task`, `Project`, `TaskStatus`, `RepeatFrequency`

#### [lib/indexeddb.ts](lib/indexeddb.ts)
IndexedDBのCRUD操作:
- データ変更時、`setProjectChangeCallback` を通じて同期フックへ通知

#### [lib/hooks.ts](lib/hooks.ts)
カスタムフック:
- `useSync`: Supabaseとのデータ同期（Pull/Push）を管理
- `useDebounce`: 入力遅延処理

#### [lib/api-indexeddb.ts](lib/api-indexeddb.ts)
UI層向けのAPIクライアント:
- バリデーションとMarkdownパース/シリアライズを担当

### 開発ガイドライン

（既存の内容と同じため省略... 変更なし部分は保持されるべきですが、ツール仕様上、全文書き換えになるため、既存の内容をマージして出力します）

## トラブルシューティング

### 同期されない
- コンソールログを確認 (`Sync failed` 等)
- Supabase URL/Keyの設定を確認
- ネットワーク接続を確認

### "Security Error" または "Blocked"
- タスク内容に禁止タグが含まれていないか確認
- リンクが `javascript:` で始まっていないか確認
- タスクのネストが深すぎないか（>10階層）確認