# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 task management application called "Markdown Todo" that stores all data in **IndexedDB** (browser storage). The app provides multiple views (tree, calendar) for managing tasks and subtasks with due date tracking and drag-and-drop support. Data is stored client-side with Markdown format support for import/export.

**Key Technology Stack:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- dnd-kit (drag and drop)
- Remark (Markdown parsing and serialization)
- Supabase (optional cloud sync)

## Architecture

### Data Storage & Format

**IndexedDB Structure (Primary):**
- Database: `MarkdownTodoDB`
- Object Store: `projects` (keyPath: `id`)
- Each project contains: `id`, `title`, `tasks[]`, `path`
- Tasks are nested objects with generated IDs: `{projectId}-{timestamp}-{random}`

**Supabase Structure (Sync):**
- **Auth:** Google OAuth via `lib/auth-context.tsx`
- **Table:** `projects` (RLS enabled: `user_id = auth.uid()`)
- **Data:** `data` column (JSONB) stores the full project object
- **Note:** The `tasks` table is not used; tasks are nested within the project JSON.

**Markdown Format (for export/import):**
```markdown
# My Awesome Project

## Todo
- [ ] Buy groceries #due:2025-11-23
- [ ] Take vitamins #due:2025-11-20 #repeat:daily
- [ ] Read a book
    - [ ] Chapter 1 #due:2025-11-20
    - [ ] Chapter 2 #due:2025-11-21
- [ ] Weekly team meeting #due:2025-11-22 #repeat:weekly

## Doing
- [ ] Implement feature

## Done
- [x] Setup project #due:2025-11-19
```

### Security Guidelines

**Critical Security Constraints:**

1.  **Input Validation:**
    - `parseMarkdownToProject` (in `lib/api-indexeddb.ts`) validates content to prevent XSS.
    - Task nesting is limited to **10 levels** to prevent stack overflow (DoS).

2.  **Output Sanitization:**
    - `renderMarkdownLinks` (in `lib/markdown-link-renderer.tsx`) sanitizes URLs.
    - `javascript:` scheme is strictly blocked and rendered as warning text.

3.  **Database Access:**
    - RLS policies restrict access to project owners only.
    - `projects` table data is isolated per user.

### Core Modules

**[lib/types.ts](lib/types.ts)** - Type definitions:
- `Task` - Represents individual tasks
- `Project` - Contains all tasks and metadata
- `TaskStatus` - 'todo' | 'doing' | 'done'

**[lib/indexeddb.ts](lib/indexeddb.ts)** - IndexedDB operations:
- CRUD operations for projects and tasks
- `setProjectChangeCallback()` - Triggers sync on data changes

**[lib/hooks.ts](lib/hooks.ts)** - Custom Hooks:
- `useSync` - Orchestrates bi-directional sync with Supabase
- `pullProjectsFromSupabase` - Downloads newer remote data
- `syncProjectToSupabase` - Uploads local changes (debounced)

**[lib/api-indexeddb.ts](lib/api-indexeddb.ts)** - Client-side API:
- **Note:** Replaces HTTP API routes in IndexedDB mode
- `fetchProjects()` - Loads from IndexedDB
- `saveRawMarkdown()` - Parses and saves markdown (with validation)

### UI Components

**[app/page.tsx](app/page.tsx)** - Main container:
- Manages projects and view state
- Initializes sync via `useSync`

**[components/TreeView.tsx](components/TreeView.tsx)** - Tree view:
- Hierarchical task list with drag-and-drop
- Auto-save on blur

**[components/WeeklyView.tsx](components/WeeklyView.tsx)** - Calendar view:
- Weekly organization by due date
- Uses local timezone for accurate date display

## Common Development Tasks

### Running the Application

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Create production build
npm start        # Run production build
npm run lint     # Run ESLint
```

### Modifying Task Persistence

When changing how tasks are saved to Markdown:
1. Update parsing logic in [lib/markdown.ts](lib/markdown.ts)
2. Ensure `validateTaskContent` is called in `lib/api-indexeddb.ts`
3. Respect `MAX_TASK_NESTING_LEVEL` constant

### Working with Task Hierarchies

The markdown format stores nesting via indentation (4 spaces):
- Hierarchy is built during parsing using a stack
- **Limit:** Deep nesting (>10 levels) will throw an error

## Important Implementation Details

- **Task IDs:** Generated: `{projectId}-{timestamp}-{random}`. Stable and unique.
- **Timezone Handling:** Calendar View uses local timezone to prevent UTC offset issues.
- **IndexedDB Storage:** Primary storage. Data is persistent but local.
- **Cloud Sync:** Optional. Uses Supabase `projects` table (JSONB).
- **Security:** stored XSS and DoS protections are implemented in the markdown parser/renderer.
