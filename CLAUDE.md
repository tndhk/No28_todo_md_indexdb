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

## Development Environment Setup

**IMPORTANT: Before running any commands, always run `npm install` first!**

This project requires dependencies to be installed before you can build, run, or test. Common issues:

1. **Missing dependencies error** (`next: not found`, etc.):
   - **Solution:** Run `npm install` before any other commands
   - This happens because `node_modules/` is not committed to git

2. **Lint errors are common**:
   - TypeScript/ESLint may report errors after code changes
   - Always run `npm run lint` to check for issues
   - Fix lint errors before committing

**Recommended workflow:**
```bash
npm install           # ALWAYS run this first in a fresh environment
npm run dev           # Then start development server
npm run lint          # Check for lint errors before committing
npm run build         # Verify production build works
```

## Coding Standards & Best Practices

### React 19 ESLint Rules

This project uses React 19 with strict ESLint rules. **ALWAYS run `npm run lint` after implementing new features** to catch errors before committing.

**Common ESLint Issues:**

1. **`react-hooks/set-state-in-effect` Error:**
   - **Problem:** Calling `setState()` directly inside `useEffect` body causes cascading renders
   - **Example of BAD code:**
     ```typescript
     useEffect(() => {
       if (someCondition) {
         setState(newValue)  // ❌ ERROR: Direct setState in effect
       }
     }, [someCondition])
     ```

   - **Solutions:**
     - **Option A:** Derive state from props/state (no effect needed)
       ```typescript
       const derivedValue = someCondition ? newValue : oldValue  // ✅ GOOD
       ```

     - **Option B:** Use event handlers instead of effects
       ```typescript
       const handleChange = () => {
         if (someCondition) setState(newValue)  // ✅ GOOD
       }
       ```

     - **Option C:** Use refs for tracking previous values
       ```typescript
       const prevValue = useRef(value)
       useEffect(() => {
         if (prevValue.current !== value) {
           prevValue.current = value
           // Update external system here, not React state
         }
       }, [value])
       ```

     - **Option D (Last Resort):** If state updates are truly necessary in effects (e.g., network status tracking), add eslint-disable comment:
       ```typescript
       /* eslint-disable react-hooks/set-state-in-effect */
       useEffect(() => {
         if (!isOnline) setHasBeenOffline(true)  // ✅ OK with disable comment
       }, [isOnline])
       ```

2. **`react-hooks/refs` Error:**
   - **Problem:** Cannot access `ref.current` during render
   - **Solution:** Only access refs in event handlers or effects, never during render

3. **TypeScript/ESLint Integration:**
   - Always fix TypeScript errors first, then ESLint errors
   - Use `npm run lint` frequently during development
   - Never commit code with lint errors

### Development Workflow

**MANDATORY steps before committing:**

1. **Write code** → Implement feature
2. **Run lint** → `npm run lint`
3. **Fix all errors** → Address ESLint/TypeScript issues
4. **Run build** → `npm run build` to verify production build
5. **Test locally** → Verify functionality works
6. **Commit** → Only after all checks pass

**Example workflow:**
```bash
# After implementing a new component
npm run lint          # Check for errors
npm run build         # Verify build succeeds
git add .
git commit -m "..."   # Only if lint and build succeed
```

### PWA-Specific Considerations

- Service Worker registration must be client-side only (`'use client'`)
- Check `typeof window !== 'undefined'` before accessing browser APIs
- Use refs or callbacks for tracking state changes in effects
- Test offline mode with Chrome DevTools (Network → Offline)

## Architecture

### Data Storage & Format

**IndexedDB Structure (Primary):**
- Database: `MarkdownTodoDB` (v2 schema with migration support)
- Object Store: `projects` (keyPath: `id`)
- Each project contains: `id`, `title`, `groups[]`, `path`, `updated_at`
- Groups are status containers (Todo, Doing, Done) with custom name support
- Tasks are nested objects within groups with generated IDs: `{projectId}-{timestamp}-{random}`
- Tasks support nested subtasks (max 10 levels deep)

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
- [ ] Work on feature #do:2025-11-22 #due:2025-11-30
- [ ] Read a book
    - [ ] Chapter 1 #due:2025-11-20
    - [ ] Chapter 2 #due:2025-11-21
- [ ] Weekly team meeting #due:2025-11-22 #repeat:weekly

## Doing
- [ ] Implement feature

## Done
- [x] Setup project #due:2025-11-19
```

**Supported Tags:**
- `#due:YYYY-MM-DD` - Deadline/target completion date
- `#do:YYYY-MM-DD` - Scheduled date (when to start working on task)
- `#repeat:daily|weekly|monthly` - Recurring task frequency

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
- `Task` - Represents individual tasks with subtask support
- `Group` - Status containers (Todo, Doing, Done)
- `Project` - Contains groups, tasks, and metadata
- `TaskStatus` - 'todo' | 'doing' | 'done'
- `RepeatFrequency` - 'daily' | 'weekly' | 'monthly'

**[lib/indexeddb.ts](lib/indexeddb.ts)** - IndexedDB operations:
- CRUD operations for projects, groups, and tasks
- Schema v2 migration support (v1 → v2)
- `setProjectChangeCallback()` - Triggers sync on data changes
- `handleRecurringTask()` - Manages recurring task creation

**[lib/hooks.ts](lib/hooks.ts)** - Custom Hooks:
- `useSync()` - Orchestrates bi-directional sync with Supabase
- `useAuth()` - Google OAuth authentication via Supabase
- `pullProjectsFromSupabase()` - Downloads newer remote data
- `syncProjectToSupabase()` - Uploads local changes (debounced 2s)

**[lib/api-indexeddb.ts](lib/api-indexeddb.ts)** - Client-side API:
- **Note:** Replaces HTTP API routes in IndexedDB mode
- `fetchProjects()` - Loads from IndexedDB
- `saveRawMarkdown()` - Parses and saves markdown with validation
- Handles markdown parsing with tag extraction (#due:, #do:, #repeat:)

**[lib/validation.ts](lib/validation.ts)** - Input validation:
- XSS prevention with dangerous pattern detection
- ReDoS prevention with regex quantifier limits
- Task content length validation
- Early rejection before regex processing
- Used by `parseMarkdownToProject()` for security

### UI Components

**[app/page.tsx](app/page.tsx)** - Main container:
- Manages projects, groups, and view state
- Initializes bi-directional sync via `useSync`
- Handles search, view switching (Tree/Weekly/Markdown)
- Toggle for hiding completed tasks with localStorage persistence

**[components/TreeView.tsx](components/TreeView.tsx)** - Tree view:
- Hierarchical task list with dnd-kit drag-and-drop
- Inline editing with auto-save on blur
- Recursive task rendering with subtask support
- Cross-group task movement

**[components/WeeklyView.tsx](components/WeeklyView.tsx)** - Calendar view:
- Weekly organization by due/scheduled dates
- Uses local timezone for accurate date display
- Drag-and-drop date synchronization
- Click-to-open Pomodoro timer integration
- Task completion toggle with visual feedback

**[components/PomodoroModal.tsx](components/PomodoroModal.tsx)** - Pomodoro timer:
- Work/break cycle management (default 25min/5min)
- Desktop notifications on cycle completion
- Timer controls (play, pause, reset)
- Settings dialog for duration customization
- Integrated with WeeklyView task clicks

**[components/MDView.tsx](components/MDView.tsx)** - Markdown editor:
- Raw markdown editing with syntax view
- Auto-save on blur
- Real-time markdown parsing

**[components/Sidebar.tsx](components/Sidebar.tsx)** - Navigation:
- Project selector with creation
- View switcher (Tree/Weekly/Markdown)
- Mobile hamburger menu
- Responsive layout

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
- **Scheduled vs. Due Dates:**
  - `#due:` is the deadline/target completion date
  - `#do:` is when to start working on the task
  - Both sync to WeeklyView for calendar organization
- **Recurring Tasks:** Automatically recreate on next cycle when marked complete
- **Search:** Case-insensitive recursive search across task content and subtasks
- **Mobile Responsiveness:** Hamburger menu, responsive grid layouts, touch-friendly controls
- **IndexedDB Storage:** Primary storage. Data is persistent but local.
- **Cloud Sync:** Optional. Uses Supabase `projects` table (JSONB) with Last-Write-Wins conflict resolution.
- **Security:** Stored XSS and DoS protections are implemented in the markdown parser/renderer.
- **Pomodoro Integration:** Click any task in WeeklyView to start a Pomodoro session
- **Database Schema:** v2 supports groups/status organization (v1→v2 migration included)
