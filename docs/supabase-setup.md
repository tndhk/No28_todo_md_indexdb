# Supabase Setup Guide

This guide explains how to set up Supabase for production deployment of the Markdown Todo app.

## Overview

The app supports two storage modes:

- **Local Mode** (Development): Uses JSON files in `data/users.json` for user storage
- **Supabase Mode** (Production): Uses Supabase PostgreSQL database for user storage

This dual-mode approach allows local development without requiring Supabase, while enabling Vercel deployment which requires a database (no file writes).

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details:
   - **Name**: markdown-todo
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for project to be provisioned

## Step 2: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

### Option B: Manual SQL Execution

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:

   a. Copy contents of `supabase/migrations/20250120000001_initial_schema.sql`
   b. Paste and execute in SQL Editor
   c. Copy contents of `supabase/migrations/20250120000002_rls_policies.sql`
   d. Paste and execute in SQL Editor
   e. Copy contents of `supabase/migrations/20250121000001_add_users_table.sql`
   f. Paste and execute in SQL Editor

## Step 3: Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (⚠️ Keep secret!)

## Step 4: Configure Environment Variables

### Local Development

Create `.env.local`:

```bash
# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Supabase (optional for local dev)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Storage Mode: false = local JSON files, true = Supabase
USE_SUPABASE=false
```

### Production (Vercel)

Add environment variables in Vercel dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add the following:

   ```
   NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
   NEXTAUTH_URL=https://your-domain.vercel.app

   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   USE_SUPABASE=true
   ```

3. Redeploy your application

## Step 5: Verify Setup

### Check Tables

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

You should see:
- `users`
- `projects`
- `tasks`

### Check RLS Policies

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

You should see policies for all three tables.

### Test User Registration

1. Start your app locally with `USE_SUPABASE=true`
2. Go to `/auth/register`
3. Create a test account
4. Check Supabase dashboard → **Table Editor** → **users** table
5. You should see your new user record

## Storage Mode Switching

The app automatically selects storage based on `USE_SUPABASE` environment variable:

### Local JSON Files (`USE_SUPABASE=false` or unset)

- Users stored in `data/users.json`
- Projects/tasks stored as Markdown files (if not using Supabase adapter)
- Good for local development
- **Will NOT work on Vercel** (read-only filesystem)

### Supabase Database (`USE_SUPABASE=true`)

- Users stored in Supabase `users` table
- Projects/tasks stored in Supabase `projects` and `tasks` tables
- Required for Vercel deployment
- Can be used locally for testing

## Troubleshooting

### Error: "Registration failed"

Check Supabase logs:
1. Go to **Logs** → **Postgres Logs**
2. Look for errors around the timestamp of registration attempt

### Error: "Supabase is not configured"

- Verify all three environment variables are set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Verify `USE_SUPABASE=true`
- Restart your development server

### RLS Policy Errors

If users can't access their data:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Temporarily disable RLS for testing (DON'T use in production)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

## Migration from JSON to Supabase

If you have existing users in `data/users.json`:

1. Create a migration script:

```typescript
// scripts/migrate-users.ts
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateUsers() {
  const usersFile = path.join(process.cwd(), 'data', 'users.json');
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));

  for (const user of users) {
    const { error } = await supabase.from('users').insert({
      id: user.id,
      name: user.name,
      username: user.username,
      hashed_password: user.hashedPassword,
      data_dir: user.dataDir,
      created_at: user.createdAt,
    });

    if (error) {
      console.error(`Failed to migrate user ${user.username}:`, error);
    } else {
      console.log(`✓ Migrated user ${user.username}`);
    }
  }

  console.log('Migration complete!');
}

migrateUsers().catch(console.error);
```

2. Run migration:

```bash
npx tsx scripts/migrate-users.ts
```

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit** `SUPABASE_SERVICE_ROLE_KEY` to git
2. **Use RLS policies** - Always keep Row Level Security enabled in production
3. **Service role key** should only be used in server-side code (API routes)
4. **Anon key** can be used in client-side code safely
5. **Rotate keys** if they are ever exposed

## Next Steps

- [Deploy to Vercel](./deployment-guide.md)
- [Supabase Migration Design](./supabase-migration-design.md)
- [API Documentation](./api-documentation.md)
