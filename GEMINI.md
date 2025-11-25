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

## アーキテクチャ

### データストレージ

**IndexedDBストレージ:**
- データベース名: `MarkdownTodoDB`
- オブジェクトストア: `projects` (keyPath: `id`)
- 各プロジェクトには `id`, `title`, `tasks[]`, `path` が含まれる
- タスクは生成されたID: `{projectId}-{timestamp}-{random}` を使用

**利点:**
- 🚀 オフライン動作 - サーバー不要
- ⚡ 高速 - ブラウザ内の直接ストレージ
- 🔒 プライベート - データはデバイス内に保存
- 💾 永続的 - ページリフレッシュ後も保持
- 🛠️ セットアップ不要 - 環境変数やAPIキー不要

**Markdownフォーマット(インポート/エクスポート用):**
```markdown
# プロジェクトタイトル

## Todo
- [ ] タスク1 #due:2025-11-23
- [ ] タスク2 #due:2025-11-20 #repeat:daily
    - [ ] サブタスク1

## Doing
- [ ] 進行中のタスク

## Done
- [x] 完了したタスク
```

### 主要モジュール

#### [lib/types.ts](lib/types.ts)
型定義を提供:
- `Task` - タスクオブジェクト(id, content, status, dueDate, repeatFrequency, subtasks, parentId, parentContent)
- `Project` - プロジェクトオブジェクト(id, title, tasks, path)
- `TaskStatus` - 'todo' | 'doing' | 'done'
- `RepeatFrequency` - 'daily' | 'weekly' | 'monthly'

#### [lib/indexeddb.ts](lib/indexeddb.ts)
IndexedDBの基本操作を提供:
- `openDatabase()` - IndexedDBの初期化
- `getAllProjects()` - 全プロジェクトを取得
- `getProjectById()` - プロジェクトをIDで取得
- `addProject()` / `updateProject()` / `deleteProject()` - プロジェクトCRUD
- `addTask()` / `updateTask()` / `deleteTask()` - タスクCRUD
- `handleRecurringTask()` - 繰り返しタスクの完了処理
- `reorderTasks()` - タスクの並び替え
- `initializeSampleData()` - 初回起動時のサンプルデータ作成

#### [lib/api-indexeddb.ts](lib/api-indexeddb.ts)
IndexedDBベースのAPIクライアント:
- `lib/api.ts`と同じインターフェースを提供(HTTPの代わりにIndexedDBを使用)
- `fetchProjects()` - プロジェクト一覧取得
- `createProject()` - プロジェクト作成
- `addTask()` - タスク追加(`parentId`を使用)
- `updateTask()` - タスク更新(`taskId`が必須)
- `deleteTask()` - タスク削除(`taskId`が必須)
- `fetchRawMarkdown()` - プロジェクトをMarkdown形式にシリアライズ
- `saveRawMarkdown()` - Markdownをパースしてプロジェクトを更新
- `serializeProjectToMarkdown()` - プロジェクトオブジェクト → Markdown文字列
- `parseMarkdownToProject()` - Markdown文字列 → プロジェクトオブジェクト

#### [lib/markdown.ts](lib/markdown.ts)
Markdownパース機能(インポート/エクスポート用):
- `parseMarkdown()` - Markdownテキストをタスク/プロジェクト構造にパース
- Markdown Viewのインポート機能で使用

#### [lib/utils.ts](lib/utils.ts)
汎用ユーティリティ関数を提供:
- `filterTasksBySearch()` - タスクの再帰的検索フィルタリング
- `filterDoneTasks()` - 完了タスクのフィルタリング
- `updateTaskInTree()` - タスクツリーの再帰的更新
- `deleteTaskFromTree()` - タスクツリーからの再帰的削除

#### [lib/hooks.ts](lib/hooks.ts)
カスタムReactフックを提供:
- `useDebounce()` - 値の変更を遅延させるフック(検索バーなどで使用)

### UIコンポーネント

#### [app/page.tsx](app/page.tsx)
メインコンテナ:
- プロジェクトと現在のビュー状態を管理
- タスクの変更操作を調整(トグル、削除、追加、更新)
- 検索機能とフィルタリング(完了済み非表示)を実装
- `lib/api-indexeddb.ts`を使用してIndexedDBと通信

#### [components/TreeView.tsx](components/TreeView.tsx)
ツリービュー:
- タスクを階層構造で表示
- インライン編集、ドラッグ&ドロップ並び替えをサポート
- ダブルクリックで編集、Escapeでキャンセル、blurで自動保存

#### [components/WeeklyView.tsx](components/WeeklyView.tsx)
カレンダービュー:
- 期日ごとにタスクを整理
- タスクをドラッグして日付を変更
- 親タスク名を表示してコンテキストを提供

#### [components/MDView.tsx](components/MDView.tsx)
Markdownエディタービュー:
- プロジェクト全体をMarkdownテキストとして編集
- 変更は自動的にパースされてIndexedDBに保存
- `fetchRawMarkdown()`と`saveRawMarkdown()`を使用

## 開発ガイドライン

### タスクの追加

```typescript
// parentIdを指定してサブタスクとして追加
await addTask(
  projectId,
  'タスク内容',
  'todo',
  '2025-12-31',  // dueDate (optional)
  undefined,      // parentLineNumber (IndexedDBモードでは無視)
  'daily',        // repeatFrequency (optional)
  parentTaskId    // parentId (サブタスクの場合)
);
```

### タスクの更新

```typescript
// taskIdが必須
await updateTask(
  projectId,
  0,  // lineNumber (IndexedDBモードでは無視)
  {
    content: '更新されたタスク',
    status: 'done',
    dueDate: '2025-12-31',
    repeatFrequency: 'weekly'
  },
  taskId  // 必須パラメータ
);
```

### タスクの削除

```typescript
// taskIdが必須
await deleteTask(
  projectId,
  0,  // lineNumber (IndexedDBモードでは無視)
  taskId  // 必須パラメータ
);
```

### 繰り返しタスクの処理

繰り返しタスクが完了としてマークされると:
1. 現在のタスクが完了状態になる(`status = 'done'`)
2. 同じ内容と繰り返し頻度で新しいタスクが自動作成される
3. 期日が再計算される:
   - `daily`: +1日
   - `weekly`: +7日
   - `monthly`: +1ヶ月
4. 新しいタスクは同じレベル(ルートまたはサブタスク)に追加される

## 重要な実装詳細

### タスクID
- 生成されたID: `{projectId}-{timestamp}-{random}`
- 安定していて一意
- `lineNumber`と`rawLine`フィールドは互換性のために存在するが、IndexedDBモードでは使用されない

### IndexedDBストレージ
- すべてのデータはブラウザのIndexedDBに保存される
- データはセッション間で永続化されるが、ブラウザ/デバイスに紐付けられる
- ポータビリティのためにMarkdownバックアップをエクスポートすることを推奨

### Markdownシリアライゼーション
- Markdown Viewは`serializeProjectToMarkdown()`を使用してプロジェクトをMarkdown形式にシリアライズ
- 保存時には`parseMarkdownToProject()`でMarkdownをプロジェクト構造にパース
- インポート/エクスポート機能として使用

### ドラッグ&ドロップ
- **Tree View**: dnd-kitのSortableContextを使用して同じ親レベル内でタスクを並び替え
- **Calendar View**: タスクを日付列間でドラッグして期日を変更
- 並び替えはIndexedDB内のタスク配列の順序を更新

### タイムゾーン処理
Calendar Viewはローカルタイムゾーンを使用:
```typescript
const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
```
これによりUTCオフセットの問題(タスクが間違った日付に表示される)を防ぐ。

## 一般的な開発タスク

### アプリケーションの実行

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # プロダクションビルド作成
npm start        # プロダクションビルド実行
npm run lint     # ESLint実行
```

### 新しいビューの追加

1. `components/`に新しいコンポーネントを作成:
   ```tsx
   interface ViewProps {
     tasks: Task[];
     onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
   }
   ```
2. `ViewType`ユニオンに追加
3. 必要に応じて`app/page.tsx`にハンドラを追加
4. 条件分岐でコンポーネントをレンダリング

### タスク機能の追加

新しいインライン機能(例: `#priority:high`)を追加するには:
1. `lib/markdown.ts`のパース処理に追加 - 抽出してcontentから削除
2. `lib/types.ts`のTaskインターフェースにフィールドを追加
3. `lib/api-indexeddb.ts`の`serializeProjectToMarkdown()`と`parseMarkdownToProject()`を更新
4. コンポーネントを更新して機能を表示/編集
5. `lib/indexeddb.ts`の`updateTask()`を更新して新しいフィールドを処理

## トラブルシューティング

### タスクが保存されない
- ブラウザコンソールでIndexedDBエラーを確認
- ブラウザサポートを確認 - IndexedDBは全てのモダンブラウザでサポート
- ストレージクォータを確認 - ストレージが満杯の場合、ブラウザがIndexedDBをブロックする可能性
- シークレットモードを試す - 拡張機能やプライバシー設定がIndexedDBをブロックする可能性

### データがセッション間で保持されない
- ブラウザ設定を確認 - Cookie/ストレージが終了時にクリアされる設定になっていないか
- プライベートブラウジング - IndexedDBデータはプライベートウィンドウを閉じるとクリアされる
- ストレージクォータ - ストレージが満杯の場合、ブラウザがデータを削除する可能性

### データのバックアップ/エクスポート方法
- **Markdown View**を使用してプロジェクトデータをテキストとしてコピー
- Markdownコンテンツを`.md`ファイルとして保存してバックアップ
- Markdown Viewにコンテンツを貼り付けてインポート
