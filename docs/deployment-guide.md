# Deployment Guide: Supabase + Vercel

This guide walks you through deploying the Markdown Todo app to Vercel with Supabase as the database backend.

## Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Supabase account (sign up at [supabase.com](https://supabase.com))

## Part 1: Set Up Supabase Database

### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: `markdown-todo` (or your preferred name)
   - **Database Password**: Generate a secure password and save it
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait ~2 minutes for project initialization

### 2. Run Database Migrations

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the contents of `supabase/migrations/20250120000001_initial_schema.sql`
4. Click "Run" to execute the schema migration
5. Create another new query
6. Copy and paste the contents of `supabase/migrations/20250120000002_rls_policies.sql`
7. Click "Run" to execute the RLS policies

**Verification:**
- Go to **Table Editor** in Supabase
- You should see two tables: `projects` and `tasks`
- Go to **Authentication** > **Policies**
- You should see RLS policies for both tables

### 3. Get API Keys

1. In Supabase dashboard, go to **Settings** > **API**
2. Copy the following values (you'll need them for Vercel):
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ Keep this secret!

## Part 2: Deploy to Vercel

### 1. Push Code to GitHub

```bash
# If not already a git repository
git init
git add .
git commit -m "Initial commit with Supabase integration"

# Create GitHub repository and push
gh repo create markdown-todo --private --source=. --remote=origin --push
# Or manually create repo on GitHub and:
git remote add origin https://github.com/yourusername/markdown-todo.git
git push -u origin main
```

### 2. Import Project to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your `markdown-todo` repository
4. Click "Import"

### 3. Configure Environment Variables

In the Vercel import screen, add the following environment variables:

#### Required Supabase Variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Required NextAuth Variables:
```bash
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-app-name.vercel.app
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

#### Optional Variables:
```bash
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn-if-using
```

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at `https://your-app-name.vercel.app`

## Part 3: Migrate Existing Data (Optional)

If you have existing markdown files you want to migrate to Supabase:

### 1. Set Up Local Environment

```bash
# Copy .env.example to .env.local
cp .env.example .env.local

# Edit .env.local and add your Supabase credentials
# (same values used in Vercel)
```

### 2. Get Your User ID

1. Sign up/login to your app
2. Go to Supabase dashboard > **Authentication** > **Users**
3. Find your user and copy the UUID (e.g., `a1b2c3d4-e5f6-...`)

### 3. Run Migration Script

```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run migration
ts-node scripts/migrate-to-supabase.ts --user-id=YOUR_USER_UUID --data-dir=./data
```

### 4. Verify Migration

1. Go to Supabase dashboard > **Table Editor** > **tasks**
2. You should see all your tasks
3. Log into your deployed app
4. Verify all projects and tasks appear correctly

### 5. Backup Original Files

```bash
# Create backup of original markdown files
tar -czf markdown-backup-$(date +%Y%m%d).tar.gz data/
```

## Part 4: Post-Deployment

### Configure Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings** > **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable to your custom domain
5. Redeploy

### Set Up Monitoring (Optional)

#### Vercel Analytics
1. In Vercel dashboard, go to **Analytics**
2. Enable Web Analytics

#### Sentry Error Tracking
1. Create project at [sentry.io](https://sentry.io)
2. Copy DSN
3. Add `SENTRY_DSN` environment variable in Vercel
4. Redeploy

### Enable HTTPS (Automatic)

Vercel automatically provides SSL certificates. Your app is served over HTTPS by default.

## Troubleshooting

### Issue: "Unauthorized: No user session found"

**Solution:**
1. Verify `NEXTAUTH_URL` matches your deployed URL
2. Check `NEXTAUTH_SECRET` is set
3. Clear browser cookies and try logging in again

### Issue: "Failed to fetch projects"

**Solution:**
1. Check Supabase environment variables are correct
2. Verify RLS policies are enabled
3. Check browser console for specific error messages
4. Verify user is authenticated

### Issue: Tasks not appearing after migration

**Solution:**
1. Check Supabase **Table Editor** to verify data was inserted
2. Verify the `user_id` used in migration matches your authenticated user
3. Check RLS policies allow the user to read their data

### Issue: "Invalid file path" errors

**Solution:**
This error should not occur when using Supabase. If you see it:
1. Verify all Supabase environment variables are set
2. Check that `useSupabase` flag is evaluating to `true` in `app/api/projects/route.ts`

## Rollback Plan

If you need to rollback to file-based storage:

### Option 1: Redeploy Previous Version

1. In Vercel dashboard, go to **Deployments**
2. Find the last deployment before Supabase migration
3. Click **•••** > **Promote to Production**

### Option 2: Disable Supabase

1. In Vercel dashboard, go to **Settings** > **Environment Variables**
2. Remove all Supabase variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy

The app will automatically fall back to file-based storage (but this won't work on Vercel due to ephemeral file system).

## Monitoring & Maintenance

### Database Backups

Supabase automatically backs up your database:
- **Free tier**: Daily backups, 7 days retention
- **Pro tier**: Daily backups, 30 days retention

### Manual Backup

Export data from Supabase:
1. Go to **Table Editor**
2. Select table
3. Click **Export** > **CSV**

### Database Usage

Monitor database size:
1. Go to **Settings** > **Billing**
2. Check "Database size" usage

Free tier limit: 500MB

### Performance Monitoring

Check Vercel Analytics:
1. Go to **Analytics** in Vercel dashboard
2. Monitor response times, errors, and traffic

## Scaling Considerations

### When to Upgrade Supabase Plan

Consider upgrading from Free to Pro ($25/month) if:
- Database size > 500MB
- Need more than 2GB bandwidth/month
- Need more than 50,000 monthly active users
- Need custom domains with Supabase auth
- Need point-in-time recovery

### When to Upgrade Vercel Plan

Consider upgrading from Hobby to Pro ($20/month) if:
- Need team collaboration
- Need more than 100GB bandwidth/month
- Need advanced deployment protection
- Need priority support

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **NextAuth Docs**: https://next-auth.js.org
- **Issue Tracker**: [GitHub Issues](https://github.com/yourusername/markdown-todo/issues)

## Next Steps

1. ✅ Configure custom domain
2. ✅ Set up error monitoring (Sentry)
3. ✅ Enable Vercel Analytics
4. ✅ Set up automated backups
5. ✅ Configure email notifications for errors
6. ✅ Add status page (optional)

---

**Congratulations! Your Markdown Todo app is now deployed! 🎉**
