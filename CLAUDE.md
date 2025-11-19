# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 task management application called "Markdown Todo" that stores all data as Markdown files. The app provides multiple views (tree, weekly, kanban) for managing tasks and subtasks organized by status (todo, doing, done).

**Key Technology Stack:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- dnd-kit (drag and drop)
- Remark (Markdown parsing and serialization)

## Architecture

### Data Storage & Format

Tasks are persisted as Markdown files in the `data/` directory. Each `.md` file represents a project with the following structure:

```markdown
# Project Title

## Todo
- [ ] Task 1 #due:2024-12-31
    - [ ] Subtask 1.1

## Doing
- [ ] Task 2

## Done
- [x] Task 3
```

**Key Points:**
- Tasks use checkboxes: `[ ]` (incomplete) or `[x]` (complete)
- Due dates are stored as inline tags: `#due:YYYY-MM-DD`
- Nesting is determined by indentation (4 spaces per level)
- Status sections (`## Todo`, `## Doing`, `## Done`) are optional and automatically created

### Core Modules

**[lib/types.ts](lib/types.ts)** - Type definitions:
- `Task` - Represents individual tasks with id, content, status, dueDate, subtasks, lineNumber (for file updates)
- `Project` - Contains all tasks and metadata
- `TaskStatus` - Union type: 'todo' | 'doing' | 'done'

**[lib/markdown.ts](lib/markdown.ts)** - Markdown parsing:
- `parseMarkdown()` - Parses Markdown files into Task/Project structures. Handles nesting via indentation stack, status sections, and due date extraction
- `getAllProjects()` - Reads all `.md` files from `data/` directory and returns parsed projects

**[lib/markdown-updater.ts](lib/markdown-updater.ts)** - File mutations:
- `updateMarkdown()` - Updates task checkbox/content/due date at specific line numbers
- `addTask()` - Inserts new tasks, handling section auto-creation and correct indentation
- `updateTask()` - Modifies content/status/due date of existing tasks
- `deleteTask()` - Removes task and all its subtasks (nested children)

### API Layer

**[app/api/projects/route.ts](app/api/projects/route.ts)**:
- `GET /api/projects` - Returns all projects
- `POST /api/projects` - Handles mutations with action-based routing:
  - `action: 'add'` - Add new task (with optional parent)
  - `action: 'update'` - Update task statuses (used for bulk updates)
  - `action: 'updateTask'` - Modify content/status/due date
  - `action: 'delete'` - Remove task and children

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
- Uses dnd-kit for drag-and-drop (currently parsed but may not be fully implemented)

**[components/WeeklyView.tsx](components/WeeklyView.tsx)** - Calendar view:
- Tasks organized by week based on due dates
- Focuses on tasks with due dates assigned

**[components/KanbanView.tsx](components/KanbanView.tsx)** - Kanban view:
- Tasks organized into columns: Todo, Doing, Done
- Supports drag-and-drop between columns
- Uses dnd-kit for column management

**[components/AddTaskModal.tsx](components/AddTaskModal.tsx)** - Task creation:
- Modal for adding new tasks or subtasks
- Optional parent task support for nesting
- Due date picker integration

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
     onTaskUpdate: (task: Task, updates: Partial<Task>) => Promise<void>;
   }
   ```
2. Add the view type to `ViewType` union in [app/page.tsx:12](app/page.tsx#L12)
3. Render the component in the conditional at [app/page.tsx:189-210](app/page.tsx#L189-L210)

### Modifying Task Persistence

When changing how tasks are saved to Markdown:
1. Update parsing logic in [lib/markdown.ts](lib/markdown.ts) if changing format
2. Update writing logic in [lib/markdown-updater.ts](lib/markdown-updater.ts) to match
3. Keep line numbers accurate - they're used as task IDs for updates

### Working with Task Hierarchies

The markdown format stores nesting via indentation. When operating on nested tasks:
- `deleteTask()` recursively removes all children by indentation level
- `addTask()` with `parentLineNumber` inserts at the correct indentation
- The Task tree structure is built during parsing via `taskStack` for tracking depth

## Important Implementation Details

- **Line Numbers:** Tasks store `lineNumber` (1-indexed) which is essential for mutations. This must stay synchronized with the file.
- **Status vs Checkbox:** A task's status is determined by: its checkbox state (`[x]` = done, `[ ]` = todo) AND the section it's under (## Todo, ## Doing, ## Done). When a task is unchecked in a section, its status may not match the section name.
- **Indentation:** 4 spaces per nesting level. This is hardcoded in [lib/markdown-updater.ts:94](lib/markdown-updater.ts#L94).
- **Due Dates:** Stored inline as `#due:YYYY-MM-DD` and stripped during display. Must be preserved during updates.
- **Auto-section Creation:** If a task is added to a non-existent status section, that section is automatically created at the end of the file.