# Markdown Todo

A modern task management application that stores all data as Markdown files. This app provides an intuitive interface for managing tasks and subtasks with multiple views for different workflows.

**Features:**
- 📝 Markdown-based task storage - all data saved as simple markdown files
- 🌳 Tree View - hierarchical task organization with drag-and-drop reordering
- 📅 Calendar View - tasks organized by due date for weekly planning
- ✅ Inline task editing - double-click to edit, auto-save on blur
- 🏷️ Due date support - plan tasks with deadline tracking
- 📦 Subtask support - organize complex tasks into nested subtasks
- 🎨 Clean, modern UI - built with React and Next.js

## Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/tndhk/No26_todo_md.git
cd No26_todo_md

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── api/projects/route.ts      # API endpoints for task operations
│   ├── page.tsx                    # Main application container
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   └── page.module.css            # Page-specific styles
├── components/
│   ├── TreeView.tsx               # Hierarchical task view with drag-and-drop
│   ├── WeeklyView.tsx             # Calendar/weekly task view
│   ├── Sidebar.tsx                # Navigation sidebar
│   ├── AddTaskModal.tsx           # Task creation modal
│   └── *.module.css               # Component-specific styles
├── lib/
│   ├── types.ts                   # TypeScript type definitions
│   ├── markdown.ts                # Markdown parsing logic
│   ├── markdown-updater.ts        # Markdown file mutations
│   └── confetti.ts                # Celebration effect
├── data/
│   └── *.md                       # Task markdown files
└── package.json
```

## Data Format

Tasks are stored as Markdown files in the `data/` directory:

```markdown
# My Project Title

## Todo
- [ ] Buy groceries #due:2025-11-23
- [ ] Read a book
    - [ ] Chapter 1 #due:2025-11-20
    - [ ] Chapter 2 #due:2025-11-21

## Doing
- [ ] Implement feature

## Done
- [x] Setup project #due:2025-11-19
```

**Format Rules:**
- Tasks use checkboxes: `[ ]` (incomplete) or `[x]` (complete)
- Due dates: `#due:YYYY-MM-DD` (inline tag)
- Nesting: 4 spaces per indentation level
- Status sections are optional and auto-created

## Usage

### Tree View
- **Double-click** task content to edit
- **Click checkbox** to toggle completion
- **Drag handle** (⋮⋮) to reorder tasks
- **Edit button** (✏️) to open edit mode
- **Plus button** (+) to add subtasks
- **Trash button** (🗑️) to delete tasks

### Calendar View
- View tasks organized by due date
- **Drag tasks** between dates to reschedule
- Parent task name displayed above subtasks
- Navigate weeks with arrow buttons

### Adding Tasks
1. Click "Add Task" button in Tree View
2. Or right-click a task and select "Add Subtask"
3. Fill in task name and optional due date
4. Click "Add" to save

## Technology Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **dnd-kit** - Drag-and-drop functionality
- **Lucide React** - Icon library
- **CSS Modules** - Component scoping

## API Endpoints

### GET /api/projects
Returns all projects with their tasks.

```bash
curl http://localhost:3000/api/projects
```

### POST /api/projects
Handles task mutations with action-based routing.

**Actions:**
- `add` - Add new task
- `updateTask` - Modify task content, status, or due date
- `delete` - Remove task and subtasks
- `reorder` - Reorder tasks

Example:
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "projectId": "sample",
    "content": "New task",
    "dueDate": "2025-12-31"
  }'
```

## Development

### Code Style
- TypeScript for type safety
- CSS Modules for style isolation
- Component-based architecture
- Functional components with hooks

### Building
```bash
npm run build
npm run lint
```

### File Conventions
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Styles: `*.module.css`
- Types: `types.ts`

## Troubleshooting

### Tasks not saving?
- Ensure `data/` directory exists and is writable
- Check browser console for API errors
- Verify markdown syntax in the `.md` files

### View not updating?
- Try refreshing the page
- Check that due dates are in `YYYY-MM-DD` format
- Ensure proper markdown indentation (4 spaces)

## Contributing

Feel free to submit issues and pull requests to improve the application.

## License

This project is open source and available under the MIT License.
