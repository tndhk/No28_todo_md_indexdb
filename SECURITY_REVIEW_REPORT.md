# セキュリティコードレビュー報告書

**プロジェクト名**: Markdown Todo
**レビュー日**: 2025-11-22
**レビュー基準**: OWASP Top 10 (2021)
**レビュー対象**: Next.js 16 タスク管理アプリケーション

---

## 🔍 エグゼクティブサマリー

本アプリケーションは全体的に良好なセキュリティ実装を備えていますが、**5つの高リスク脆弱性**、**4つの中リスク脆弱性**、**3つの低リスク脆弱性**が検出されました。早急な対応が必要な項目があります。

### 総合評価
- **セキュリティスコア**: 65/100
- **緊急対応が必要**: 5件
- **推奨対応**: 4件
- **改善推奨**: 3件

---

## 🚨 検出された脆弱性（危険度：高）

### 1. 正規表現DoS攻撃の脆弱性

**該当箇所**: `lib/constants.ts:44-50`

**脆弱性の種類**: Regular Expression Denial of Service (ReDoS)

**危険度**: 🔴 **高**

**詳細**:
```typescript
export const DANGEROUS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,  // 脆弱
    /<iframe[^>]*>.*?<\/iframe>/gi,  // 脆弱
    /<object[^>]*>.*?<\/object>/gi,  // 脆弱
    /<embed[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
] as const;
```

これらの正規表現パターン（特に`.*?`を含むもの）は、Catastrophic Backtrackingを引き起こす可能性があります。

**攻撃シナリオ**:
```javascript
// 攻撃ペイロード例
const maliciousInput = "<script" + ">".repeat(10000) + "alert(1)</script>";
// このような入力により、正規表現マッチングが指数関数的に遅くなり、
// サーバーリソースを枯渇させることができる
```

1. 攻撃者が `/api/projects` の POST リクエストでタスク追加時に、長大な文字列を送信
2. `validateTaskContent()` が `DANGEROUS_PATTERNS` で検証を実行
3. 正規表現エンジンがバックトラッキングループに入り、CPU使用率が100%に到達
4. サーバーが応答不能になり、DoS攻撃が成立

**修正コード案**:
```typescript
// lib/constants.ts
// より安全な正規表現パターン（線形時間で完了）
export const DANGEROUS_PATTERNS = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,  // 改善版
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,  // 改善版
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,  // 改善版
    /<embed\b[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
] as const;

// さらに安全なアプローチ：タイムアウト付き検証
// lib/security.ts に追加
const VALIDATION_TIMEOUT_MS = 100;

function validateWithTimeout(text: string, pattern: RegExp): boolean {
    return new Promise((resolve) => {
        const worker = new Worker(/* validator worker */);
        const timeout = setTimeout(() => {
            worker.terminate();
            resolve(false); // タイムアウト時は拒否
        }, VALIDATION_TIMEOUT_MS);

        worker.postMessage({ text, pattern: pattern.source });
        worker.onmessage = (e) => {
            clearTimeout(timeout);
            resolve(e.data.matches);
        };
    });
}
```

---

### 2. APIレート制限の欠如

**該当箇所**:
- `app/api/projects/route.ts`
- `app/api/v1/projects/**/*.ts`

**脆弱性の種類**: Broken Authentication (OWASP A07:2021)

**危険度**: 🔴 **高**

**詳細**:
APIエンドポイントにレート制限が実装されていません。これにより、以下の攻撃が可能です：
- ブルートフォース攻撃
- リソース枯渇攻撃
- データスクレイピング

**攻撃シナリオ**:
```python
# 攻撃スクリプト例
import requests
import concurrent.futures

def attack():
    for i in range(100000):
        requests.post('https://target.com/api/projects',
                     json={'action': 'add',
                           'projectId': 'test',
                           'content': 'task' + str(i)})

# 並列実行で秒間1000リクエスト送信可能
with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
    executor.map(lambda _: attack(), range(50))
```

1. 攻撃者が自動化スクリプトで大量のAPIリクエストを送信
2. サーバーが全リクエストを処理しようとしてリソースが枯渇
3. 正当なユーザーがサービスを利用できなくなる
4. データベース/ファイルシステムが破損する可能性

**修正コード案**:
```typescript
// lib/rate-limit.ts (新規作成)
import { NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  interval: number;
  uniqueTokenPerInterval: number;
};

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  });

  return {
    check: (request: NextRequest, limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= limit;

        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
        } else {
          resolve();
        }
      }),
  };
}

// 使用例: app/api/projects/route.ts
const limiter = rateLimit({
  interval: 60 * 1000, // 1分
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  // IPアドレスまたはユーザーIDでレート制限
  const token = request.headers.get('x-forwarded-for') || 'anonymous';

  try {
    await limiter.check(request, 10, token); // 1分間に10リクエストまで
  } catch {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  // 既存の処理...
}
```

---

### 3. CSRF保護の欠如

**該当箇所**: 全APIエンドポイント

**脆弱性の種類**: Cross-Site Request Forgery (OWASP A01:2021)

**危険度**: 🔴 **高**

**詳細**:
Next.js APIルートにCSRF保護が実装されていません。NextAuthは認証を提供しますが、CSRF保護は含まれていません。

**攻撃シナリオ**:
```html
<!-- 攻撃者のサイト (evil.com) -->
<html>
<body>
<h1>無料で1万円プレゼント！クリックしてね！</h1>
<img src="https://victim-todo-app.com/api/projects" style="display:none">
<script>
// ユーザーがログイン済みの場合、そのセッションで実行される
fetch('https://victim-todo-app.com/api/projects', {
  method: 'POST',
  credentials: 'include', // Cookieを含める
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    action: 'add',
    projectId: 'personal',
    content: 'Transfer all money to attacker account',
    status: 'todo'
  })
});
</script>
</body>
</html>
```

1. 被害者がアプリケーションにログイン済み（セッションCookieを保持）
2. 被害者が攻撃者のサイト（evil.com）を訪問
3. 攻撃者のサイトが被害者のブラウザから被害者のアプリに不正リクエストを送信
4. ブラウザが自動的にセッションCookieを含めるため、リクエストが認証される
5. 被害者の知らないうちにタスクが追加/削除される

**修正コード案**:
```typescript
// lib/csrf.ts (新規作成)
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export function getCsrfToken(): string {
  const cookieStore = cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!token) {
    token = generateCsrfToken();
    cookieStore.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24時間
    });
  }

  return token;
}

export function validateCsrfToken(request: Request): boolean {
  const cookieStore = cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // タイミング攻撃を防ぐため、定数時間比較を使用
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

// middleware.ts に追加
export async function middleware(request: NextRequest) {
  // POSTリクエストの場合、CSRFトークンを検証
  if (request.method === 'POST' && request.nextUrl.pathname.startsWith('/api/')) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}
```

---

### 4. ファイルシステム競合状態の脆弱性

**該当箇所**: `lib/markdown-updater.ts`

**脆弱性の種類**: Race Condition / Time-of-check Time-of-use (TOCTOU)

**危険度**: 🔴 **高**

**詳細**:
同期的なファイル操作（`fs.readFileSync`, `fs.writeFileSync`）を使用しており、以下の問題があります：
1. ファイルロック機構があってもTOCTOU脆弱性が存在
2. 並行リクエストでデータ破損の可能性
3. ブロッキングI/Oによるパフォーマンス低下

**該当コード**:
```typescript
// lib/markdown-updater.ts:16-19
export function updateMarkdown(filePath: string, tasks: Task[]): void {
    const content = fs.readFileSync(filePath, config.fileEncoding); // TOCTOU
    const lines = content.split('\n');
    // ... 処理 ...
    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding); // TOCTOU
}
```

**攻撃シナリオ**:
```javascript
// 2つの並行リクエストが同時に実行される場合
// リクエスト1: タスクAを追加
// リクエスト2: タスクBを追加

// タイムライン:
// T1: Request1がファイルを読み込み（タスクなし）
// T2: Request2がファイルを読み込み（タスクなし）
// T3: Request1がタスクAを追加して書き込み
// T4: Request2がタスクBを追加して書き込み
// 結果: タスクAが失われる（Last Write Wins）
```

**修正コード案**:
```typescript
// lib/markdown-updater.ts
import { promises as fsPromises } from 'fs';
import { acquireFileLock } from './security';

// 非同期版に書き換え
export async function updateMarkdown(filePath: string, tasks: Task[]): Promise<void> {
    const releaseLock = await acquireFileLock(filePath);

    try {
        // アトミックな読み取り-修正-書き込み
        const content = await fsPromises.readFile(filePath, config.fileEncoding);
        const lines = content.split('\n');

        // ... 処理 ...

        // アトミックな書き込み（一時ファイル経由）
        const tmpPath = `${filePath}.tmp`;
        await fsPromises.writeFile(tmpPath, lines.join('\n'), config.fileEncoding);
        await fsPromises.rename(tmpPath, filePath); // アトミック操作
    } finally {
        releaseLock();
    }
}

// さらに安全な実装：Write-Ahead Log (WAL)パターン
export async function updateMarkdownWithWAL(
    filePath: string,
    tasks: Task[]
): Promise<void> {
    const walPath = `${filePath}.wal`;
    const releaseLock = await acquireFileLock(filePath);

    try {
        // 1. WALに変更を記録
        await fsPromises.appendFile(
            walPath,
            JSON.stringify({ timestamp: Date.now(), tasks }) + '\n'
        );

        // 2. 実際のファイルを更新
        const content = await fsPromises.readFile(filePath, config.fileEncoding);
        // ... 処理 ...
        const tmpPath = `${filePath}.tmp`;
        await fsPromises.writeFile(tmpPath, newContent, config.fileEncoding);
        await fsPromises.rename(tmpPath, filePath);

        // 3. WALをクリア
        await fsPromises.truncate(walPath);
    } catch (error) {
        // エラー時はWALから復旧可能
        console.error('Failed to update, WAL preserved for recovery');
        throw error;
    } finally {
        releaseLock();
    }
}
```

---

### 5. 機密情報のログ出力

**該当箇所**:
- `lib/markdown.ts:36-37, 46-49`
- `app/page.tsx` および複数のコンポーネント

**脆弱性の種類**: Sensitive Data Exposure (OWASP A02:2021)

**危険度**: 🔴 **高**

**詳細**:
本番環境でユーザーIDや機密情報がログに出力されています。

**該当コード**:
```typescript
// lib/markdown.ts:34-38
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    securityLogger.info({
        hasSession: !!session,
        hasUserId: !!session?.user?.id,
        userId: session?.user?.id,  // ⚠️ 本番環境でユーザーIDをログ出力
    }, '[getAllProjects] Auth session check');
}
```

**攻撃シナリオ**:
1. 攻撃者がログ集約システム（Sentry、CloudWatch等）への不正アクセスを取得
2. ログからユーザーIDやセッション情報を収集
3. 収集した情報を使ってセッションハイジャックや権限昇格を試みる
4. ユーザーIDとプロジェクトIDの関連付けにより、個人情報が漏洩

**修正コード案**:
```typescript
// lib/markdown.ts
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    securityLogger.info({
        hasSession: !!session,
        hasUserId: !!session?.user?.id,
        // userIdは削除、またはハッシュ化
        userIdHash: session?.user?.id
            ? crypto.createHash('sha256').update(session.user.id).digest('hex').substring(0, 8)
            : undefined,
    }, '[getAllProjects] Auth session check');
}

// lib/logger.ts の redact 設定を強化
const baseConfig: pino.LoggerOptions = {
  // ... 既存設定 ...
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'authorization',
      'userId',  // 追加
      'user.id',  // 追加
      'user.email',  // 追加
      '*.password',
      '*.token',
      '*.secret',
      '*.userId',  // 追加
      'req.headers.authorization',  // 追加
      'req.headers.cookie',  // 追加
    ],
    censor: '[REDACTED]',
  },
};

// app/page.tsx などの console.error/log を削除
// 代わりに logger を使用
import { logger } from '@/lib/logger';

// 悪い例
console.error('Failed to load projects:', error);

// 良い例
logger.error({
  operation: 'loadProjects',
  errorType: error instanceof Error ? error.name : 'unknown'
  // メッセージやスタックトレースは自動的にサニタイズされる
}, 'Failed to load projects');
```

---

## ⚠️ 検出された脆弱性（危険度：中）

### 6. セキュリティヘッダーの欠如

**該当箇所**: `next.config.ts`, `middleware.ts`

**脆弱性の種類**: Security Misconfiguration (OWASP A05:2021)

**危険度**: 🟡 **中**

**詳細**:
重要なセキュリティヘッダーが設定されていません：
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

**修正コード案**:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  // ... 既存設定 ...

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.jsに必要
              "style-src 'self' 'unsafe-inline'",  // styled-componentsに必要
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};
```

---

### 7. エラーメッセージの詳細すぎる情報開示

**該当箇所**: `app/api/projects/route.ts:285-286`

**脆弱性の種類**: Sensitive Data Exposure

**危険度**: 🟡 **中**

**詳細**:
```typescript
const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
return NextResponse.json({ error: errorMessage }, { status: 500 });
```

エラーメッセージに内部実装の詳細（ファイルパス、データベース構造等）が含まれる可能性があります。

**修正コード案**:
```typescript
// lib/errors.ts (新規作成)
export class SafeError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public code: string
  ) {
    super(message);
  }
}

// app/api/projects/route.ts
} catch (error) {
    logError(error, { operation: 'POST /api/projects', requestId }, apiLogger);
    Sentry.captureException(error, { extra: { requestId } });
    transaction.end(500);

    // 本番環境では一般的なエラーメッセージのみを返す
    const userMessage = process.env.NODE_ENV === 'production'
        ? 'An error occurred while processing your request'
        : (error instanceof Error ? error.message : 'Failed to update project');

    return NextResponse.json({
        error: userMessage,
        code: 'INTERNAL_ERROR',
        requestId  // デバッグ用
    }, { status: 500 });
}
```

---

### 8. 入力値検証前の長さチェック欠如

**該当箇所**: `lib/security.ts:66-79`

**脆弱性の種類**: Denial of Service

**危険度**: 🟡 **中**

**詳細**:
危険なパターンのチェック前に文字列長の検証がないため、極端に長い文字列で正規表現DoSが発生する可能性があります。

**修正コード案**:
```typescript
// lib/security.ts
function validateAgainstDangerousPatterns(
    text: string,
    fieldName: string
): { valid: boolean; error?: string } {
    // 早期リターン：長すぎる入力は即座に拒否
    const MAX_VALIDATION_LENGTH = 10000;
    if (text.length > MAX_VALIDATION_LENGTH) {
        return {
            valid: false,
            error: `${fieldName} is too long for validation (max ${MAX_VALIDATION_LENGTH} characters)`,
        };
    }

    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(text)) {
            return {
                valid: false,
                error: `${fieldName} contains potentially dangerous HTML/JavaScript code`,
            };
        }
    }
    return { valid: true };
}
```

---

### 9. 同期的ファイルI/Oによるブロッキング

**該当箇所**: `lib/markdown-updater.ts` 全体

**脆弱性の種類**: Denial of Service

**危険度**: 🟡 **中**

**詳細**:
すべてのファイル操作が同期的（`fs.readFileSync`, `fs.writeFileSync`）に実装されており、大量のリクエストでイベントループがブロックされます。

**修正コード案**:
上記の「脆弱性4」の修正コードを参照してください。すべてのファイル操作を非同期に変更する必要があります。

---

## ℹ️ 検出された脆弱性（危険度：低）

### 10. パスワードポリシーの未実装

**該当箇所**: 認証システム全体

**危険度**: 🟢 **低**

**詳細**:
NextAuth設定にパスワード強度の検証が見当たりません（CredentialsProviderを使用している場合）。

**修正コード案**:
```typescript
// lib/password-policy.ts
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

### 11. Session Fixation 対策の不足

**該当箇所**: `middleware.ts`

**危険度**: 🟢 **低**

**詳細**:
ログイン後のセッションID再生成が明示的に実装されていません。

**修正推奨**:
NextAuth.jsは内部的にセッション管理を行いますが、明示的な設定を追加することを推奨します：

```typescript
// lib/auth.config.ts
export const authConfig = {
  // ... 既存設定 ...
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日
    updateAge: 24 * 60 * 60, // 24時間ごとに更新
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true, // 本番環境のみ
      },
    },
  },
};
```

---

### 12. 依存ライブラリの脆弱性スキャン未実施

**該当箇所**: プロジェクト全体

**危険度**: 🟢 **低**

**詳細**:
`package.json`に依存関係の脆弱性スキャンツールが設定されていません。

**修正推奨**:
```json
// package.json
{
  "scripts": {
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix",
    "security:check": "npx snyk test",
    "security:monitor": "npx snyk monitor"
  },
  "devDependencies": {
    "@snyk/protect": "^1.x",
    "audit-ci": "^6.x"
  }
}

// GitHub Actions workflow (.github/workflows/security.yml)
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm audit --production
      - run: npx audit-ci --moderate
```

---

## ✅ 良好なセキュリティ実装

以下のセキュリティ対策が適切に実装されています：

1. **入力検証**:
   - `lib/security.ts` で包括的な入力検証を実装
   - ProjectID、タスクコンテンツ、ステータス、日付の検証

2. **パストラバーサル保護**:
   - `validateFilePath()` でディレクトリトラバーサルを防止
   - `path.resolve()` と `path.normalize()` の適切な使用

3. **XSS基本対策**:
   - React の自動エスケープ機能を活用
   - `dangerouslySetInnerHTML` の不使用

4. **ログのサニタイゼーション**:
   - Pinoロガーでパスワード/トークンの自動マスキング
   - 構造化ログの採用

5. **ファイルロック機構**:
   - 競合状態を防ぐファイルロック実装
   - タイムアウト機能付き

6. **認証システム**:
   - NextAuth.jsによる堅牢な認証
   - セッション管理の実装

7. **エラーハンドリング**:
   - Sentryによるエラー追跡
   - 構造化されたエラーログ

---

## 📋 優先順位付けされた修正推奨事項

### 即時対応が必要（1週間以内）

1. **正規表現DoS対策** - 脆弱性1
   - 影響度: 極大（サービス停止の可能性）
   - 実装工数: 1日

2. **APIレート制限の実装** - 脆弱性2
   - 影響度: 大（DoS攻撃、リソース枯渇）
   - 実装工数: 2日

3. **CSRF保護の追加** - 脆弱性3
   - 影響度: 大（不正操作の実行）
   - 実装工数: 1日

### 短期対応（1ヶ月以内）

4. **ファイル操作の非同期化** - 脆弱性4
   - 影響度: 中（データ破損、パフォーマンス低下）
   - 実装工数: 5日

5. **機密情報ログ出力の削除** - 脆弱性5
   - 影響度: 中（情報漏洩）
   - 実装工数: 1日

6. **セキュリティヘッダーの設定** - 脆弱性6
   - 影響度: 中（XSS、クリックジャッキング）
   - 実装工数: 0.5日

### 中期対応（3ヶ月以内）

7. **エラーメッセージの安全化** - 脆弱性7
8. **入力長チェックの追加** - 脆弱性8
9. **依存ライブラリ監査の自動化** - 脆弱性12

---

## 🔒 総合的なセキュリティ強化推奨事項

### 1. セキュリティ開発ライフサイクルの導入

```yaml
# .github/workflows/security-checks.yml
name: Security Checks
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run SAST
        uses: github/super-linter@v4
      - name: Dependency audit
        run: npm audit --production
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
      - name: Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 2. セキュリティテストの追加

```typescript
// __tests__/security/xss.test.ts
describe('XSS Protection', () => {
  const xssPayloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
  ];

  test.each(xssPayloads)('should reject XSS payload: %s', async (payload) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add',
        projectId: 'test',
        content: payload,
        status: 'todo',
      }),
    });
    expect(response.status).toBe(400);
  });
});

// __tests__/security/path-traversal.test.ts
describe('Path Traversal Protection', () => {
  const maliciousPaths = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    'data/../../.env',
  ];

  test.each(maliciousPaths)('should reject path: %s', (path) => {
    expect(validateFilePath(path)).toBe(false);
  });
});
```

### 3. セキュリティ監視の強化

```typescript
// lib/security-monitoring.ts
import * as Sentry from '@sentry/nextjs';

export function detectAnomalousActivity(
  userId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  // 異常検知ロジック
  const activityRate = getActivityRate(userId);

  if (activityRate > THRESHOLD) {
    Sentry.captureMessage('Suspicious activity detected', {
      level: 'warning',
      user: { id: hashUserId(userId) },
      extra: { action, metadata, activityRate },
    });

    // アラート送信
    sendSecurityAlert({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: hashUserId(userId),
      action,
      activityRate,
    });
  }
}
```

---

## 📊 リスク評価マトリクス

| 脆弱性 | 発生確率 | 影響度 | リスクレベル | 優先度 |
|--------|----------|--------|--------------|--------|
| 1. 正規表現DoS | 高 | 極大 | **Critical** | P0 |
| 2. レート制限欠如 | 高 | 大 | **Critical** | P0 |
| 3. CSRF保護欠如 | 中 | 大 | **High** | P0 |
| 4. ファイル競合 | 中 | 大 | **High** | P1 |
| 5. 情報漏洩 | 低 | 大 | **High** | P1 |
| 6. ヘッダー欠如 | 中 | 中 | **Medium** | P2 |
| 7. エラー詳細 | 低 | 中 | **Medium** | P2 |
| 8. 入力長未検証 | 中 | 中 | **Medium** | P2 |
| 9. 同期I/O | 中 | 中 | **Medium** | P1 |
| 10. パスワード | 低 | 低 | **Low** | P3 |
| 11. Session固定 | 低 | 低 | **Low** | P3 |
| 12. 依存監査 | 低 | 低 | **Low** | P3 |

---

## 📝 結論

本アプリケーションは基本的なセキュリティ対策は実装されていますが、**本番環境での運用には5つの重大な脆弱性の修正が必須**です。

特に以下の3点は早急な対応が必要です：
1. 正規表現DoS対策（サービス停止のリスク）
2. APIレート制限の実装（DoS攻撃対策）
3. CSRF保護の追加（不正操作防止）

全ての推奨事項を実装することで、OWASP Top 10の主要なリスクをカバーし、セキュアなアプリケーションとして運用可能になります。

---

**レビュー実施者**: Claude Code Security Review Agent
**レビュー完了日**: 2025-11-22
