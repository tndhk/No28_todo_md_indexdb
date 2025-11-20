# Supabase Migration - Detailed Design Document

## 📋 Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Data Flow Comparison](#data-flow-comparison)
5. [Module-by-Module Changes](#module-by-module-changes)
6. [Migration Strategy](#migration-strategy)
7. [UI/UX Impact](#uiux-impact)
8. [Implementation Phases](#implementation-phases)
9. [Risks and Mitigation](#risks-and-mitigation)
10. [Testing Strategy](#testing-strategy)

---

## 1. Executive Summary

### Objective
Migrate the Markdown Todo app from file-based storage to Supabase (PostgreSQL) while **preserving 100% of the current Markdown UI/UX**. Users will continue to view and edit tasks in Markdown format, but data will be stored in a database instead of `.md` files.

### Key Principles
- ✅ **Zero UI Changes**: Tree View, Weekly View, and all interactions remain identical
- ✅ **Markdown View Preserved**: Users still see/edit Markdown-formatted tasks
- ✅ **Transparent Migration**: Users won't notice the backend change
- ✅ **Vercel Compatible**: Enable deployment on Vercel's serverless platform

### Why This Works
The current system has a **separation of concerns**:
- **Storage Layer**: `lib/markdown.ts` (reads) and `lib/markdown-updater.ts` (writes) talk to files
- **Presentation Layer**: Components display tasks using the `Task` interface

We'll swap the storage layer to use Supabase while keeping the presentation layer unchanged.

---

## 2. System Architecture

### Current Architecture (File-based)
```
┌─────────────────┐
│   UI Components │  (TreeView, WeeklyView, AddTaskModal)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   API Routes    │  (app/api/projects/route.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│  lib/markdown   │◄──────┤ data/*.md files │
└─────────────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│ markdown-updater│──────►│ data/*.md files │
└─────────────────┘       └─────────────────┘
```

### New Architecture (Supabase)
```
┌─────────────────┐
│   UI Components │  (TreeView, WeeklyView, AddTaskModal)
└────────┬────────┘
         │ NO CHANGES
         ▼
┌─────────────────┐
│   API Routes    │  (app/api/projects/route.ts)
└────────┬────────┘
         │ MINOR CHANGES
         ▼
┌─────────────────┐       ┌─────────────────┐
│  lib/supabase-  │◄──────┤  Supabase DB    │
│     adapter     │       │  (PostgreSQL)    │
└─────────────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐
│  lib/markdown-  │  Generates Markdown view from DB data
│    renderer     │
└─────────────────┘
```

**Key Changes:**
- New `lib/supabase-adapter.ts`: Replaces file I/O with database operations
- New `lib/markdown-renderer.ts`: Generates Markdown strings from `Task[]` objects
- Updated `lib/markdown.ts`: Calls Supabase adapter instead of reading files
- Updated `lib/markdown-updater.ts`: Calls Supabase adapter instead of writing files
- **UI Components**: Zero changes

---

## 3. Database Schema

### Supabase Tables

#### Table: `projects`
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,                  -- e.g., "sample", "work-tasks"
    user_id TEXT NOT NULL,                -- NextAuth user ID
    title TEXT NOT NULL,                  -- Project title (from H1)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
```

#### Table: `tasks`
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,                  -- e.g., "sample-15" (projectId-lineNumber)
    project_id TEXT NOT NULL,
    parent_id TEXT,                       -- Reference to parent task

    -- Content
    content TEXT NOT NULL,                -- Task text (without tags)
    status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
    completed BOOLEAN DEFAULT FALSE,      -- Checkbox state

    -- Metadata
    due_date DATE,                        -- YYYY-MM-DD
    repeat_frequency TEXT CHECK (repeat_frequency IN ('daily', 'weekly', 'monthly')),

    -- Hierarchy & Ordering
    indent_level INTEGER DEFAULT 0,       -- Nesting depth (0 = top-level)
    display_order INTEGER NOT NULL,       -- Order within parent (for sorting)
    line_number INTEGER NOT NULL,         -- Virtual line number for Markdown rendering

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT tasks_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_display_order ON tasks(project_id, display_order);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
```

#### Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can view their own projects"
    ON projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
    ON projects FOR DELETE
    USING (auth.uid() = user_id);

-- Tasks: Users can only access tasks in their own projects
CREATE POLICY "Users can view tasks in their projects"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tasks in their projects"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks in their projects"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tasks in their projects"
    ON tasks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );
```

### Schema Design Decisions

**Q: Why store `line_number` in the database?**
A: To maintain compatibility with existing code. The current system uses line numbers as part of task IDs and for update operations. We'll generate virtual line numbers when rendering Markdown.

**Q: Why `display_order` instead of just using `line_number`?**
A: `display_order` is the source of truth for task ordering (used for drag-and-drop). `line_number` is calculated dynamically when generating Markdown views.

**Q: Why separate `completed` and `status`?**
A: `completed` maps to checkbox state `[x]` vs `[ ]`, while `status` determines the section (Todo/Doing/Done). A task can be in "Todo" section but have `[x]` checkbox.

---

## 4. Data Flow Comparison

### Current Flow: Reading Tasks

```
User opens page
    ↓
API: GET /api/projects
    ↓
lib/markdown.ts: getAllProjects()
    ↓
Read all .md files from data/
    ↓
parseMarkdown() for each file
    ↓
Return Task[] objects to UI
    ↓
UI renders Tree/Calendar view
```

### New Flow: Reading Tasks

```
User opens page
    ↓
API: GET /api/projects
    ↓
lib/supabase-adapter.ts: getAllProjects()
    ↓
SELECT * FROM projects WHERE user_id = ?
SELECT * FROM tasks WHERE project_id IN (...)
    ↓
buildTaskHierarchy() - reconstruct tree from flat rows
    ↓
Return Task[] objects to UI (SAME FORMAT)
    ↓
UI renders Tree/Calendar view (UNCHANGED)
```

### Current Flow: Updating a Task

```
User edits task in TreeView
    ↓
onTaskUpdate() called with updates
    ↓
API: POST /api/projects (action: updateTask)
    ↓
lib/markdown-updater.ts: updateTask()
    ↓
Read .md file, modify line at lineNumber, write back
    ↓
API returns updated projects
    ↓
UI re-renders with new data
```

### New Flow: Updating a Task

```
User edits task in TreeView
    ↓
onTaskUpdate() called with updates (UNCHANGED)
    ↓
API: POST /api/projects (action: updateTask)
    ↓
lib/supabase-adapter.ts: updateTask()
    ↓
UPDATE tasks SET content = ?, status = ?, ... WHERE id = ?
    ↓
API returns updated projects
    ↓
UI re-renders with new data (UNCHANGED)
```

---

## 5. Module-by-Module Changes

### 5.1 New Module: `lib/supabase-client.ts`

**Purpose**: Initialize Supabase client with server-side configuration.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key (bypasses RLS for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client-side browser client (respects RLS)
export const supabase = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 5.2 New Module: `lib/supabase-adapter.ts`

**Purpose**: Database operations that replace file I/O.

**Functions to implement**:
```typescript
// Read operations (replace lib/markdown.ts functions)
export async function getAllProjects(userId: string): Promise<Project[]>
export async function getProject(projectId: string, userId: string): Promise<Project | null>

// Write operations (replace lib/markdown-updater.ts functions)
export async function createProject(userId: string, title: string): Promise<Project>
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void>
export async function addTask(projectId: string, task: Omit<Task, 'id'>): Promise<Task>
export async function deleteTask(taskId: string): Promise<void>
export async function reorderTasks(projectId: string, tasks: Task[]): Promise<void>
export async function handleRecurringTask(task: Task): Promise<void>

// Helper functions
function buildTaskHierarchy(rows: DbTask[]): Task[]
function calculateLineNumbers(tasks: Task[]): Task[]
```

**Key Implementation Details**:

1. **buildTaskHierarchy()**: Reconstructs nested task tree from flat database rows
   ```typescript
   function buildTaskHierarchy(rows: DbTask[]): Task[] {
       const taskMap = new Map<string, Task>();
       const rootTasks: Task[] = [];

       // Sort by display_order first
       rows.sort((a, b) => a.display_order - b.display_order);

       // Build flat map
       rows.forEach(row => {
           taskMap.set(row.id, {
               id: row.id,
               content: row.content,
               status: row.status,
               dueDate: row.due_date,
               repeatFrequency: row.repeat_frequency,
               subtasks: [],
               parentId: row.parent_id,
               rawLine: '', // Generated later
               lineNumber: row.line_number,
           });
       });

       // Build hierarchy
       taskMap.forEach(task => {
           if (task.parentId) {
               const parent = taskMap.get(task.parentId);
               parent?.subtasks.push(task);
           } else {
               rootTasks.push(task);
           }
       });

       return rootTasks;
   }
   ```

2. **calculateLineNumbers()**: Assign virtual line numbers for Markdown rendering
   ```typescript
   function calculateLineNumbers(tasks: Task[], startLine = 1): Task[] {
       let currentLine = startLine;

       function assignLineNumbers(taskList: Task[]) {
           taskList.forEach(task => {
               task.lineNumber = currentLine++;
               if (task.subtasks.length > 0) {
                   assignLineNumbers(task.subtasks);
               }
           });
       }

       assignLineNumbers(tasks);
       return tasks;
   }
   ```

### 5.3 New Module: `lib/markdown-renderer.ts`

**Purpose**: Generate Markdown string representations from Task objects (for display purposes).

```typescript
import { Project, Task } from './types';

/**
 * Generates Markdown string from Project object
 * This is the INVERSE of parseMarkdown() in lib/markdown.ts
 */
export function renderMarkdown(project: Project): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${project.title}`);
    lines.push('');

    // Group tasks by status
    const todoTasks = project.tasks.filter(t => t.status === 'todo');
    const doingTasks = project.tasks.filter(t => t.status === 'doing');
    const doneTasks = project.tasks.filter(t => t.status === 'done');

    // Render sections
    if (todoTasks.length > 0) {
        lines.push('## Todo');
        renderTasks(todoTasks, lines);
        lines.push('');
    }

    if (doingTasks.length > 0) {
        lines.push('## Doing');
        renderTasks(doingTasks, lines);
        lines.push('');
    }

    if (doneTasks.length > 0) {
        lines.push('## Done');
        renderTasks(doneTasks, lines);
        lines.push('');
    }

    return lines.join('\n');
}

function renderTasks(tasks: Task[], lines: string[], indentLevel = 0) {
    const indent = '    '.repeat(indentLevel);

    tasks.forEach(task => {
        const checkbox = task.status === 'done' ? '[x]' : '[ ]';
        const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
        const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';

        const line = `${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`;
        lines.push(line);

        // Store as rawLine for compatibility
        task.rawLine = line;

        if (task.subtasks.length > 0) {
            renderTasks(task.subtasks, lines, indentLevel + 1);
        }
    });
}

/**
 * Generate rawLine for a single task (used in API responses)
 */
export function renderTaskLine(task: Task, indentLevel = 0): string {
    const indent = '    '.repeat(indentLevel);
    const checkbox = task.status === 'done' ? '[x]' : '[ ]';
    const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
    const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';

    return `${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`;
}
```

### 5.4 Update: `lib/markdown.ts`

**Changes**: Replace file reading with Supabase queries.

```typescript
// BEFORE
export async function getAllProjects(): Promise<Project[]> {
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));
    return files.map(file => {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        return parseMarkdown(file.replace('.md', ''), content, path.join(dataDir, file));
    });
}

// AFTER
import { getAllProjects as getProjectsFromDB } from './supabase-adapter';
import { renderMarkdown } from './markdown-renderer';
import { auth } from '@/auth'; // NextAuth

export async function getAllProjects(): Promise<Project[]> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const projects = await getProjectsFromDB(session.user.id);

    // Generate rawLine and lineNumbers for each task
    projects.forEach(project => {
        assignLineNumbers(project.tasks);
    });

    return projects;
}

function assignLineNumbers(tasks: Task[], currentLine = { value: 1 }) {
    tasks.forEach(task => {
        task.lineNumber = currentLine.value++;
        task.rawLine = renderTaskLine(task, getIndentLevel(task));
        if (task.subtasks.length > 0) {
            assignLineNumbers(task.subtasks, currentLine);
        }
    });
}

// parseMarkdown() can be REMOVED or kept for migration script
```

### 5.5 Update: `lib/markdown-updater.ts`

**Changes**: Replace file writing with Supabase mutations.

```typescript
// BEFORE
export function updateTask(filePath: string, lineNumber: number, updates: {...}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines[lineNumber - 1] = generateNewLine(updates);
    fs.writeFileSync(filePath, lines.join('\n'));
}

// AFTER
import { updateTask as updateTaskInDB } from './supabase-adapter';

export async function updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Task>
): Promise<void> {
    await updateTaskInDB(taskId, updates);
}

// Similar changes for addTask(), deleteTask(), rewriteMarkdown()
```

### 5.6 Update: `app/api/projects/route.ts`

**Changes**: Minor adjustments to pass correct parameters.

```typescript
// BEFORE
const projects = await getAllProjects(); // No user context

// AFTER
import { auth } from '@/auth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await getAllProjects(); // Now uses session internally
    return NextResponse.json(projects);
}

// POST handler: Change project.path to project.id
// BEFORE: updateTask(project.path, task.lineNumber, updates)
// AFTER: updateTask(project.id, task.id, updates)
```

### 5.7 No Changes Required

These modules remain **100% unchanged**:
- ✅ `app/page.tsx` - Main container
- ✅ `components/TreeView.tsx` - Tree view UI
- ✅ `components/WeeklyView.tsx` - Calendar view UI
- ✅ `components/AddTaskModal.tsx` - Task creation modal
- ✅ `components/Sidebar.tsx` - Navigation
- ✅ `lib/types.ts` - Type definitions (Task, Project interfaces)

---

## 6. Migration Strategy

### Phase 1: Database Setup
1. Create Supabase project
2. Run schema migration scripts
3. Enable Row Level Security
4. Configure environment variables in Vercel

### Phase 2: Data Migration Script
Create `scripts/migrate-to-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { getAllProjectsFromDir } from '@/lib/markdown';
import path from 'path';

async function migrate() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Read all existing markdown files
    const dataDir = path.join(process.cwd(), 'data');
    const projects = await getAllProjectsFromDir(dataDir);

    for (const project of projects) {
        // Insert project
        const { data: insertedProject } = await supabase
            .from('projects')
            .insert({
                id: project.id,
                user_id: 'MIGRATED_USER_ID', // Replace with actual user ID
                title: project.title,
            })
            .select()
            .single();

        // Insert tasks recursively
        let displayOrder = 0;
        async function insertTasks(tasks: Task[], parentId?: string, indentLevel = 0) {
            for (const task of tasks) {
                const { data: insertedTask } = await supabase
                    .from('tasks')
                    .insert({
                        id: task.id,
                        project_id: project.id,
                        parent_id: parentId,
                        content: task.content,
                        status: task.status,
                        completed: task.status === 'done',
                        due_date: task.dueDate,
                        repeat_frequency: task.repeatFrequency,
                        indent_level: indentLevel,
                        display_order: displayOrder++,
                        line_number: task.lineNumber,
                    })
                    .select()
                    .single();

                if (task.subtasks.length > 0) {
                    await insertTasks(task.subtasks, insertedTask.id, indentLevel + 1);
                }
            }
        }

        await insertTasks(project.tasks);
    }

    console.log(`✅ Migrated ${projects.length} projects`);
}

migrate().catch(console.error);
```

Run with:
```bash
npx ts-node scripts/migrate-to-supabase.ts
```

### Phase 3: Gradual Rollout
1. Deploy to staging environment with feature flag
2. Test all CRUD operations
3. Verify Markdown rendering matches file-based version
4. Enable for production

---

## 7. UI/UX Impact

### User-Facing Changes: **ZERO** ✅

| Feature | Before (Files) | After (Supabase) | Status |
|---------|---------------|------------------|--------|
| View tasks in Tree format | ✅ Works | ✅ Works | Unchanged |
| View tasks in Calendar | ✅ Works | ✅ Works | Unchanged |
| Edit task inline | ✅ Works | ✅ Works | Unchanged |
| Drag-and-drop reorder | ✅ Works | ✅ Works | Unchanged |
| Due date picker | ✅ Works | ✅ Works | Unchanged |
| Recurring tasks | ✅ Works | ✅ Works | Unchanged |
| Add subtasks | ✅ Works | ✅ Works | Unchanged |
| Delete tasks | ✅ Works | ✅ Works | Unchanged |
| Markdown display | ✅ Shows Markdown | ✅ Shows Markdown | Unchanged |

### Developer-Facing Changes

**Positive Changes**:
- ✅ Deploy to Vercel without worrying about file persistence
- ✅ Better concurrency (database transactions vs file locks)
- ✅ Query flexibility (e.g., "show all tasks due this week")
- ✅ Automatic backups via Supabase

**Potential Concerns**:
- ⚠️ Database costs (mitigated by Supabase free tier)
- ⚠️ Migration complexity (one-time cost)

---

## 8. Implementation Phases

### Phase 1: Database Setup (1-2 days)
- [ ] Create Supabase project
- [ ] Run schema migration
- [ ] Configure RLS policies
- [ ] Set up environment variables

### Phase 2: Core Adapter Implementation (3-4 days)
- [ ] Implement `lib/supabase-client.ts`
- [ ] Implement `lib/supabase-adapter.ts`
  - [ ] getAllProjects()
  - [ ] getProject()
  - [ ] createProject()
  - [ ] buildTaskHierarchy()
- [ ] Implement `lib/markdown-renderer.ts`
  - [ ] renderMarkdown()
  - [ ] renderTaskLine()
- [ ] Unit tests for adapter functions

### Phase 3: Update Existing Modules (2-3 days)
- [ ] Update `lib/markdown.ts`
  - [ ] Replace file reads with DB queries
  - [ ] Add authentication checks
- [ ] Update `lib/markdown-updater.ts`
  - [ ] updateTask()
  - [ ] addTask()
  - [ ] deleteTask()
  - [ ] handleRecurringTask()
  - [ ] reorderTasks()
- [ ] Update `app/api/projects/route.ts`
  - [ ] Add auth checks
  - [ ] Change function signatures (path → projectId)

### Phase 4: Data Migration (1-2 days)
- [ ] Write migration script
- [ ] Test on sample data
- [ ] Migrate production data
- [ ] Backup original files

### Phase 5: Testing (2-3 days)
- [ ] Integration tests for all CRUD operations
- [ ] Test recurring task logic
- [ ] Test drag-and-drop reordering
- [ ] Visual regression tests (ensure UI unchanged)
- [ ] Performance testing

### Phase 6: Deployment (1 day)
- [ ] Deploy to Vercel staging
- [ ] Smoke tests
- [ ] Deploy to production
- [ ] Monitor error rates

**Total Estimated Time: 10-15 days**

---

## 9. Risks and Mitigation

### Risk 1: Data Loss During Migration
**Probability**: Low
**Impact**: Critical
**Mitigation**:
- Keep original `.md` files as backup
- Run migration script on staging first
- Export database before production migration
- Add rollback script

### Risk 2: Line Number Synchronization Issues
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Virtual line numbers calculated on-the-fly
- Use task.id (UUID or projectId-order) as primary identifier
- Add validation tests to ensure line numbers match rendered Markdown

### Risk 3: Performance Degradation
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Add database indexes on frequently queried columns
- Use Supabase connection pooling
- Cache projects in-memory for duration of API request

### Risk 4: Recurring Task Logic Breaks
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Comprehensive unit tests for `handleRecurringTask()`
- Test edge cases (recurring task with subtasks, monthly tasks on 31st)
- Manual QA before production

### Risk 5: RLS Policy Misconfiguration
**Probability**: Medium
**Impact**: Critical (data leak)
**Mitigation**:
- Test with multiple user accounts
- Audit RLS policies with Supabase CLI
- Add integration tests that verify user isolation

---

## 10. Testing Strategy

### Unit Tests
```typescript
// Example: lib/supabase-adapter.test.ts
describe('supabase-adapter', () => {
    it('buildTaskHierarchy should reconstruct nested tasks', () => {
        const flatTasks = [
            { id: '1', parent_id: null, content: 'Parent' },
            { id: '2', parent_id: '1', content: 'Child' },
        ];
        const hierarchy = buildTaskHierarchy(flatTasks);
        expect(hierarchy[0].subtasks).toHaveLength(1);
    });

    it('calculateLineNumbers should assign sequential numbers', () => {
        const tasks = [/* nested task structure */];
        calculateLineNumbers(tasks);
        expect(tasks[0].lineNumber).toBe(1);
        expect(tasks[0].subtasks[0].lineNumber).toBe(2);
    });
});
```

### Integration Tests
```typescript
// Example: app/api/projects/route.test.ts
describe('POST /api/projects', () => {
    it('should add task and return updated projects', async () => {
        const response = await fetch('/api/projects', {
            method: 'POST',
            body: JSON.stringify({
                action: 'add',
                projectId: 'test-project',
                content: 'New task',
                status: 'todo',
            }),
        });

        const projects = await response.json();
        expect(projects[0].tasks).toContainEqual(
            expect.objectContaining({ content: 'New task' })
        );
    });
});
```

### Visual Regression Tests
Use Percy or Chromatic to ensure UI remains pixel-perfect:
```bash
npm run test:visual
```

### Manual QA Checklist
- [ ] Create new task in Tree View
- [ ] Edit task content inline
- [ ] Drag task to reorder
- [ ] Add subtask
- [ ] Delete task with subtasks
- [ ] Toggle task status (Todo → Doing → Done)
- [ ] Set due date
- [ ] Create recurring task (daily, weekly, monthly)
- [ ] Complete recurring task (verify new task created)
- [ ] View tasks in Calendar View
- [ ] Drag task to different date in Calendar
- [ ] Verify task appears on correct date
- [ ] Test with multiple projects
- [ ] Verify RLS (login as different user, can't see other's tasks)

---

## 11. Environment Variables

### Development (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NextAuth (existing)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Feature Flags (optional)
USE_SUPABASE=true  # Toggle between file-based and DB storage
```

### Production (Vercel Environment Variables)
Same as above, but with production Supabase URLs.

---

## 12. Rollback Plan

If the migration causes critical issues:

### Immediate Rollback (< 5 minutes)
1. Set environment variable: `USE_SUPABASE=false`
2. Redeploy previous commit
3. Restore original data directory from backup

### Data Recovery
Keep original `.md` files in a backup S3 bucket for 30 days:
```bash
aws s3 sync data/ s3://todo-app-backup/$(date +%Y-%m-%d)/
```

To restore:
```bash
aws s3 sync s3://todo-app-backup/2025-11-20/ data/
```

---

## 13. Success Metrics

### Technical Metrics
- ✅ All existing tests pass
- ✅ API response time < 500ms (same as file-based)
- ✅ Zero data loss during migration
- ✅ 100% UI compatibility (visual regression tests pass)

### User Metrics
- ✅ Zero user-reported bugs related to data storage
- ✅ No increase in task completion/edit errors
- ✅ Deploy successfully to Vercel

---

## 14. Next Steps

**If approved**, the implementation will proceed in this order:

1. **You approve this design** ✋ (We're here!)
2. Create Supabase project and run schema migration
3. Implement `lib/supabase-adapter.ts` and `lib/markdown-renderer.ts`
4. Update existing modules to use new adapter
5. Write and run data migration script
6. Test thoroughly
7. Deploy to Vercel staging
8. Deploy to production

**Estimated total time: 10-15 days of development**

---

## Questions for You

Before proceeding, please confirm:

1. ✅ **Approved**: This design preserves Markdown UI as required?
2. ⚠️ **Concern**: Any specific features you're worried about?
3. 💰 **Budget**: Supabase free tier (256MB storage, 500MB bandwidth/month) sufficient for now?
4. 🔐 **Users**: How many concurrent users do you expect? (affects connection pool sizing)
5. 📊 **Analytics**: Do you want to add any new queries enabled by DB? (e.g., "Most overdue tasks")

**Ready to proceed?** Let me know and I'll start with Phase 1! 🚀
