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

## Architecture

### Data Storage & Format

Tasks are persisted in **IndexedDB**, a client-side database built into modern browsers. Data is stored as structured objects but can be exported/imported as Markdown:

**IndexedDB Structure:**
- Database: `MarkdownTodoDB`
- Object Store: `projects` (keyPath: `id`)
- Each project contains: `id`, `title`, `tasks[]`, `path`
- Tasks are nested objects with generated IDs: `{projectId}-{timestamp}-{random}`

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

**Key Points:**
- Tasks use checkboxes: `[ ]` (incomplete) or `[x]` (complete)
- Due dates are stored as inline tags: `#due:YYYY-MM-DD`
- Repeat frequencies are stored as inline tags: `#repeat:daily`, `#repeat:weekly`, or `#repeat:monthly`
- Nesting is determined by indentation (4 spaces per level) in Markdown
- Status sections (`## Todo`, `## Doing`, `## Done`) are used for Markdown serialization

### Core Modules

**[lib/types.ts](lib/types.ts)** - Type definitions:
- `Task` - Represents individual tasks with:
  - `id`: Unique identifier (generated: `{projectId}-{timestamp}-{random}`)
  - `content`: Task text
  - `status`: 'todo' | 'doing' | 'done'
  - `dueDate`: Optional date string (YYYY-MM-DD)
  - `repeatFrequency`: Optional repeat frequency ('daily' | 'weekly' | 'monthly')
  - `subtasks`: Array of nested Task objects
  - `parentId`: Reference to parent task (if nested)
  - `parentContent`: Parent task content for display in views
  - `lineNumber`: Legacy field (not used in IndexedDB mode)
  - `rawLine`: Legacy field (not used in IndexedDB mode)
- `Project` - Contains all tasks and metadata
- `TaskStatus` - Union type: 'todo' | 'doing' | 'done'
- `RepeatFrequency` - Union type: 'daily' | 'weekly' | 'monthly'

**[lib/indexeddb.ts](lib/indexeddb.ts)** - IndexedDB operations:
- `openDatabase()` - Initializes IndexedDB with `MarkdownTodoDB` database
- `getAllProjects()` - Retrieves all projects from IndexedDB
- `getProjectById()` - Fetches a single project by ID
- `addProject()` - Creates a new project in IndexedDB
- `updateProject()` - Updates an existing project
- `deleteProject()` - Removes a project from IndexedDB
- `addTask()` - Adds a task to a project (handles nesting)
- `updateTask()` - Modifies task properties (content, status, due date, repeat)
- `deleteTask()` - Removes a task and all its subtasks
- `handleRecurringTask()` - Handles recurring task completion (mark done + create new)
- `calculateNextDueDate()` - Calculates next due date based on repeat frequency
- `reorderTasks()` - Updates task order within a project
- `initializeSampleData()` - Creates sample project on first run

**[lib/api-indexeddb.ts](lib/api-indexeddb.ts)** - IndexedDB API client:
- Provides the same interface as `lib/api.ts` but uses IndexedDB instead of HTTP
- `fetchProjects()` - Loads all projects from IndexedDB
- `createProject()` - Creates a new project
- `addTask()` - Adds a task (uses `parentId` instead of `parentLineNumber`)
- `updateTask()` - Updates a task (requires `taskId` parameter)
- `deleteTask()` - Deletes a task (requires `taskId` parameter)
- `reorderTasks()` - Reorders tasks via drag-and-drop
- `fetchRawMarkdown()` - Serializes project to Markdown format
- `saveRawMarkdown()` - Parses Markdown and updates project
- `serializeProjectToMarkdown()` - Converts project object to Markdown string
- `parseMarkdownToProject()` - Converts Markdown string to project object

**[lib/markdown.ts](lib/markdown.ts)** - Markdown parsing (used for import/export):
- `parseMarkdown()` - Parses Markdown text into Task/Project structures
- Used by `api-indexeddb.ts` for Markdown View import functionality

### API Layer

**Note:** In IndexedDB mode, the application uses **client-side API functions** instead of HTTP endpoints.

**[lib/api-indexeddb.ts](lib/api-indexeddb.ts)** - Client-side API:
- All operations are performed directly in the browser via IndexedDB
- No HTTP requests or server-side routes needed
- Functions mirror the interface of traditional REST APIs for compatibility
- Used by `app/page.tsx` and `components/MDView.tsx`

### UI Components

**[app/page.tsx](app/page.tsx)** - Main container:
- Manages projects and current view state
- Orchestrates task mutations (toggle, delete, add, update)
- Routes view rendering based on `currentView` state

**[components/Sidebar.tsx](components/Sidebar.tsx)** - Navigation:
- Project selection and view switching
- Currently selected project highlighting

**[components/TreeView.tsx](components/TreeView.tsx)** - Tree/outline view:
- Displays all tasks in hierarchical tree structure
- Supports task toggling, deletion, addition, and inline editing
- Auto-save on blur when editing tasks
- Drag-and-drop task reordering with dnd-kit
- Double-click to edit inline, Escape to cancel, blur to save
- Drag handle (GripVertical icon) for reordering
- Displays repeat frequency badge (🔁) for recurring tasks
- Edit repeat frequency in edit mode via dropdown

**[components/WeeklyView.tsx](components/WeeklyView.tsx)** - Calendar view:
- Tasks organized by week based on due dates
- Displays parent task name above subtasks for context
- Drag-and-drop to reschedule tasks to different dates
- Local timezone date handling (fixes UTC offset issues)

**[components/AddTaskModal.tsx](components/AddTaskModal.tsx)** - Task creation:
- Modal for adding new tasks or subtasks
- Optional parent task support for nesting
- Due date picker integration
- Repeat frequency selector for recurring tasks

## Common Development Tasks

### Running the Application

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Create production build
npm start        # Run production build
npm run lint     # Run ESLint
```

### Adding New Views

1. Create a new component in `components/` with the signature:
   ```tsx
   interface ViewProps {
     tasks: Task[];
     onTaskUpdate: (task: Task, updates: Partial<Task>) => void;
   }
   ```
2. Add the view type to `ViewType` union in [app/page.tsx:12](app/page.tsx#L12)
3. Add handler in [app/page.tsx](app/page.tsx) if needed (e.g., `handleTaskReorder`)
4. Render the component in the conditional at [app/page.tsx:175-190](app/page.tsx#L175-L190)

### Modifying Task Persistence

When changing how tasks are saved to Markdown:
1. Update parsing logic in [lib/markdown.ts](lib/markdown.ts) if changing format
2. Update writing logic in [lib/markdown-updater.ts](lib/markdown-updater.ts) to match
3. Keep line numbers accurate - they're used as task IDs for updates
4. If adding new fields, update [lib/types.ts](lib/types.ts) Task interface

### Working with Task Hierarchies

The markdown format stores nesting via indentation:
- Parent tasks are at base indentation
- Child tasks indented 4 spaces deeper
- Building hierarchy during parsing:
  ```typescript
  const taskStack: { task: Task; indent: number }[] = [];
  // Pop stack when indent decreases
  // Add to current parent's subtasks
  // Push new task onto stack
  ```
- `deleteTask()` recursively removes all children by indentation level
- `addTask()` with `parentLineNumber` inserts at correct indentation
- `parentContent` field captures parent text for display in Calendar View

### Editing Task Content

TreeView implements auto-save on blur:
1. Double-click task or click edit button to enter edit mode
2. Change content or due date
3. Click outside or Tab to another field - auto-saves
4. Press Escape to cancel without saving
5. Enter key saves and exits edit mode

For Calendar View dragging:
1. Click and hold drag handle on task card
2. Drag to target date column
3. Release to update due date via `onTaskUpdate`

### Adding Task Features

To add new inline features (like priority tags `#priority:high`):
1. Add to markdown parsing in [lib/markdown.ts](lib/markdown.ts) - extract and strip from content
2. Add field to [lib/types.ts](lib/types.ts) Task interface
3. Update [lib/markdown-updater.ts](lib/markdown-updater.ts) to preserve during updates
4. Update components to display/edit the feature
5. Update [app/api/projects/route.ts](app/api/projects/route.ts) to handle in updateTask action

## Important Implementation Details

- **Task IDs:** Tasks use generated IDs: `{projectId}-{timestamp}-{random}`. These are stable and unique, unlike line numbers. The `lineNumber` and `rawLine` fields exist for legacy compatibility but are not used in IndexedDB mode.

- **Parent Content Tracking:** When tasks are parsed, parent task content is captured in `parentContent` field. This is used in Calendar View to display context for nested tasks without traversing the tree.

- **Auto-save in Tree View:** Edit containers use `onBlur` handler that triggers save when focus leaves the container. Escape key cancels edits. Save/Cancel buttons were removed in favor of auto-save UX.

- **Timezone Handling:** Calendar View uses local timezone for date formatting:
  ```typescript
  const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  ```
  This prevents UTC offset issues where tasks appeared on wrong dates.

- **IndexedDB Storage:** All data is stored in the browser's IndexedDB. Data persists across sessions but is tied to the browser/device. Users should export Markdown backups for portability.

- **Markdown Serialization:** The Markdown View serializes projects to Markdown format on-the-fly using `serializeProjectToMarkdown()`. When saving, it parses the Markdown back into the project structure.

- **Recurring Tasks:** When a recurring task is marked as done:
  - The current task is marked as complete (status = 'done')
  - A new uncompleted task is automatically created with the same content and repeat frequency
  - Due date is recalculated: daily (+1 day), weekly (+7 days), monthly (+1 month)
  - New task is added at the same level (root or subtask)
  - Handled by `handleRecurringTask()` in [lib/indexeddb.ts](lib/indexeddb.ts)

- **Drag-and-Drop:**
  - Tree View: Tasks reordered within same parent level using dnd-kit with SortableContext
  - Calendar View: Tasks moved between date columns to reschedule
  - Both use `onTaskReorder` or `onTaskUpdate` callbacks respectively
  - Reordering updates the task array order in IndexedDB