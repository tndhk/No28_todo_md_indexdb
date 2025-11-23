# Markdown Todo

A modern task management application with **IndexedDB browser storage** and **Markdown format support**. This app provides an intuitive interface for managing tasks and subtasks with multiple views for different workflows.

**Features:**
- 🗄️ IndexedDB backend - client-side persistent storage, no server required
- 📝 Markdown-based editing - view and edit tasks as human-readable Markdown
- 🌳 Tree View - hierarchical task organization with drag-and-drop reordering
- 📅 Calendar View - tasks organized by due date for weekly planning
- ✅ Inline task editing - double-click to edit, auto-save on blur
- 🏷️ Due date support - plan tasks with deadline tracking
- 🔁 Recurring tasks - automatically recreate daily, weekly, or monthly tasks
- 📦 Subtask support - organize complex tasks into nested subtasks
- 🎨 Clean, modern UI - built with React and Next.js
- 💾 Offline-first - all data stored locally in your browser

## Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/tndhk/No28_todo_md_indexdb.git
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
│   ├── api/
│   │   └── v1/
│   │       ├── projects/
│   │       │   ├── route.ts                           # GET all projects
│   │       │   └── [projectId]/
│   │       │       ├── route.ts                       # GET/POST project
│   │       │       ├── raw/route.ts                   # GET/PUT Markdown content
│   │       │       └── tasks/
│   │       │           ├── route.ts                   # POST add task
│   │       │           ├── [lineNumber]/route.ts      # PUT/DELETE task
│   │       │           └── reorder/route.ts           # PUT reorder tasks
│   ├── page.tsx                    # Main application container
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   └── page.module.css            # Page-specific styles
├── components/
│   ├── TreeView.tsx               # Hierarchical task view with drag-and-drop
│   ├── WeeklyView.tsx             # Calendar/weekly task view
│   ├── MDView.tsx                 # Markdown editor view
│   ├── Sidebar.tsx                # Navigation sidebar
│   ├── AddTaskModal.tsx           # Task creation modal
│   └── *.module.css               # Component-specific styles
├── lib/
│   ├── types.ts                   # TypeScript type definitions
│   ├── indexeddb.ts               # IndexedDB operations (CRUD, recurring tasks)
│   ├── api-indexeddb.ts           # IndexedDB-based API client
│   ├── markdown.ts                # Markdown parsing logic
│   ├── markdown-renderer.ts       # Markdown rendering from DB objects
│   ├── security.ts                # Input validation and security
│   ├── config.ts                  # Application configuration
│   ├── logger.ts                  # Logging utilities
│   ├── monitoring.ts              # Performance monitoring
│   └── confetti.ts                # Celebration effect
├── middleware.ts                  # NextAuth middleware
├── .env.local                      # Environment variables (see Configuration section)
└── package.json
```

## Storage Architecture

### IndexedDB Browser Storage
All tasks are stored in **IndexedDB**, a client-side database built into modern web browsers:

**Data Model:**
- **Projects store** - Stores project objects with embedded task hierarchies
- Each project contains: `id`, `title`, `tasks[]`, and `path` (empty string)
- Tasks are stored as nested objects within their parent project

**Benefits:**
- **Offline-first** - Works completely offline, no server required
- **Fast** - Direct browser storage with instant read/write
- **Private** - All data stays on your device
- **Persistent** - Data survives page refreshes and browser restarts
- **No setup** - No database configuration or API keys needed

**Technical Details:**
- Database name: `MarkdownTodoDB`
- Object store: `projects` (keyPath: `id`)
- Tasks use generated IDs: `{projectId}-{timestamp}-{random}`
- Markdown format is preserved for import/export compatibility

## Data Format

Tasks can be viewed and edited as Markdown:

```markdown
# My Project Title

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

**Format Rules:**
- Tasks use checkboxes: `[ ]` (incomplete) or `[x]` (complete)
- Due dates: `#due:YYYY-MM-DD` (inline tag)
- Repeat frequency: `#repeat:daily`, `#repeat:weekly`, or `#repeat:monthly` (inline tag)
- Nesting: 4 spaces per indentation level
- Status sections are optional and auto-created

### Markdown View
The Markdown View allows you to edit the entire project as raw Markdown text. Changes are automatically parsed and synced to the database:
1. Click the "Markdown" tab to open the Markdown editor
2. Edit tasks in Markdown format
3. Changes auto-save (with debounce) to the database
4. Markdown is re-rendered and synced to the tree structure

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
4. Optionally select repeat frequency (None, Daily, Weekly, Monthly)
5. Click "Add" to save

### Recurring Tasks
- Set repeat frequency when creating or editing tasks
- When a recurring task is marked complete:
  - Current task is checked off as done
  - New task is automatically created with next due date
  - Daily: +1 day, Weekly: +7 days, Monthly: +1 month
- Recurring tasks display 🔁 badge with frequency

## Technology Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **dnd-kit** - Drag-and-drop functionality
- **Lucide React** - Icon library
- **CSS Modules** - Component scoping

## Configuration

### Environment Variables

IndexedDB mode requires **no environment variables** for basic operation. All data is stored locally in your browser.

Optional configuration (create `.env.local` if needed):

```env
# Optional: NextAuth configuration (if authentication is enabled)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Optional: Application settings
DATA_DIR=./data
FILE_ENCODING=utf-8
INDENT_SPACES=4
MAX_CONTENT_LENGTH=500
MAX_PROJECT_ID_LENGTH=100
```

**Note:** The `DATA_DIR` setting is not used in IndexedDB mode but may be referenced by legacy code.

## API Endpoints

All API endpoints use the v1 routing structure.

### Projects

#### GET /api/v1/projects
Returns all projects with their tasks.

```bash
curl http://localhost:3000/api/v1/projects
```

#### POST /api/v1/projects
Create a new project.

```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Project"
  }'
```

### Markdown View

#### GET /api/v1/projects/[projectId]/raw
Returns the project as rendered Markdown content.

```bash
curl http://localhost:3000/api/v1/projects/sample_project_1/raw
```

#### PUT /api/v1/projects/[projectId]/raw
Updates the project by parsing Markdown content. All tasks are synced from the provided Markdown.

```bash
curl -X PUT http://localhost:3000/api/v1/projects/sample_project_1/raw \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# My Project\n\n## Todo\n- [ ] Task 1\n"
  }'
```

### Tasks

#### POST /api/v1/projects/[projectId]/tasks
Add a new task to a project.

```bash
curl -X POST http://localhost:3000/api/v1/projects/sample_project_1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "content": "New task",
    "status": "todo",
    "dueDate": "2025-12-31",
    "parentLineNumber": 2,
    "repeatFrequency": "weekly"
  }'
```

**Parameters:**
- `content` (string, required) - Task content
- `status` (string) - 'todo', 'doing', or 'done' (default: 'todo')
- `dueDate` (string) - Due date in YYYY-MM-DD format
- `parentLineNumber` (number) - Line number of parent task for subtasks
- `repeatFrequency` (string) - 'daily', 'weekly', or 'monthly'

#### PUT /api/v1/projects/[projectId]/tasks/[lineNumber]
Update a task.

```bash
curl -X PUT http://localhost:3000/api/v1/projects/sample_project_1/tasks/2 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated task",
    "status": "done",
    "dueDate": "2025-12-31",
    "repeatFrequency": "daily"
  }'
```

#### DELETE /api/v1/projects/[projectId]/tasks/[lineNumber]
Delete a task and all its subtasks.

```bash
curl -X DELETE http://localhost:3000/api/v1/projects/sample_project_1/tasks/2
```

#### PUT /api/v1/projects/[projectId]/tasks/reorder
Reorder tasks (drag-and-drop).

```bash
curl -X PUT http://localhost:3000/api/v1/projects/sample_project_1/tasks/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {"id": "task-1", "subtasks": []},
      {"id": "task-2", "subtasks": []}
    ]
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

## Deployment

### Static Site Deployment

This application uses **IndexedDB** for client-side storage, making it perfect for static site deployment:

**Deployment Platforms:**
- ✅ **Vercel** - Zero configuration, automatic deployments
- ✅ **Netlify** - Static hosting with instant cache invalidation
- ✅ **GitHub Pages** - Free hosting for public repositories
- ✅ **Cloudflare Pages** - Fast global CDN deployment
- ✅ **Any static host** - No server-side requirements

**Deployment Steps:**

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy the `out/` or `.next/` directory** to your hosting platform

3. **No environment variables required** - IndexedDB works entirely client-side

**Benefits of IndexedDB deployment:**
- 📦 No database setup or API keys needed
- 🚀 Deploy anywhere that serves static files
- 💰 Free hosting on most platforms
- 🌍 Works offline after first load
- 🔒 User data stays private on their device

### Local Development

```bash
# No configuration needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start using the app immediately.

## Troubleshooting

### Tasks not saving?
- **Check browser console** for IndexedDB errors
- **Verify browser support** - IndexedDB is supported in all modern browsers
- **Check storage quota** - Browser may block IndexedDB if storage is full
- **Try incognito mode** - Extensions or privacy settings may block IndexedDB
- **Clear browser data** - Corrupted IndexedDB can be reset via browser settings

### Markdown View showing errors?
- Ensure task IDs are properly formatted
- Check that parent-child relationships are valid
- Verify markdown syntax before saving

### View not updating?
- Try refreshing the page
- Check that due dates are in `YYYY-MM-DD` format
- Ensure proper markdown indentation (4 spaces per level)
- Open browser DevTools and check for JavaScript errors

### Data not persisting across sessions?
- **Check browser settings** - Ensure cookies/storage is not set to clear on exit
- **Private browsing** - IndexedDB data is cleared when private windows close
- **Storage quota** - Browser may evict data if storage is full
- **Browser compatibility** - Use a modern browser (Chrome, Firefox, Safari, Edge)

### How to backup/export data?
- Use the **Markdown View** to copy all project data as text
- Save the markdown content to a `.md` file for backup
- Import by pasting markdown content back into the Markdown View

## Contributing

Feel free to submit issues and pull requests to improve the application.

## License

This project is open source and available under the MIT License.
