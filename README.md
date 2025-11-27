# Momentum

A modern task management application with **IndexedDB browser storage** and **Markdown format support**. This app provides an intuitive interface for managing tasks and subtasks with multiple views for different workflows.

**Features:**
- 🗄️ IndexedDB backend - client-side persistent storage, no server required
- 📝 Markdown-based editing - view and edit tasks as human-readable Markdown
- 🌳 Tree View - hierarchical task organization with drag-and-drop reordering
- 📅 Calendar View - tasks organized by due date for weekly planning
- ✅ Inline task editing - double-click to edit, auto-save on blur
- 🏷️ Due date support - plan tasks with deadline tracking
- 🔔 Scheduled dates - distinguish between when to work on a task vs. its deadline
- 🔁 Recurring tasks - automatically recreate daily, weekly, or monthly tasks
- ⏱️ Pomodoro Timer - integrated work/break cycles with notifications
- 📦 Subtask support - organize complex tasks into nested subtasks
- 🎨 Clean, modern UI - built with React and Next.js
- 💾 Offline-first - all data stored locally in your browser
- ☁️ Cloud Sync - optional synchronization across devices using Supabase

## Quick Start

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/tndhk/No28_todo_md_indexdb.git
cd No28_todo_md_indexdb

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

## Storage Architecture

### IndexedDB Browser Storage
All tasks are stored in **IndexedDB**, a client-side database built into modern web browsers:

**Data Model:**
- **Projects store** - Stores project objects with embedded task hierarchies
- Each project contains: `id`, `title`, `tasks[]`, and `path`
- Tasks are stored as nested objects within their parent project

### Cloud Synchronization (Optional)
The application supports optional cloud synchronization using **Supabase**:

- **Authentication** - Secure user authentication via Google OAuth (Supabase Auth)
- **Database** - Data is stored in the `projects` table
- **Format** - Entire project structures are stored as JSONB
- **Security** - Row Level Security (RLS) ensures users can only access their own projects

**Sync Architecture:**
- Local changes are debounced (2s) and pushed to Supabase
- On load, newer remote data automatically updates local IndexedDB
- **Note:** The synchronization logic relies on the `useSync` hook in `lib/hooks.ts`

## Security Features

- **Input Validation:** Markdown imports are strictly validated to prevent XSS.
- **Sanitization:** Links in tasks are sanitized (blocking `javascript:` schemes).
- **DoS Protection:** Task nesting is limited to 10 levels to prevent stack overflow attacks.
- **Access Control:** Supabase RLS ensures data isolation between users.

## Data Format

Tasks can be viewed and edited as Markdown:

```markdown
# My Project Title

## Todo
- [ ] Buy groceries #due:2025-11-23
- [ ] Take vitamins #due:2025-11-20 #repeat:daily
- [ ] Work on project #do:2025-11-22 #due:2025-11-30
- [ ] Read a book
    - [ ] Chapter 1 #due:2025-11-20
    - [ ] Chapter 2 #due:2025-11-21
```

**Format Rules:**
- Tasks use checkboxes: `[ ]` (incomplete) or `[x]` (complete)
- Due dates: `#due:YYYY-MM-DD` (deadline/target completion date)
- Scheduled date: `#do:YYYY-MM-DD` (when to start working on the task)
- Repeat frequency: `#repeat:daily`, `#repeat:weekly`, or `#repeat:monthly` (inline tag)
- Nesting: 4 spaces per indentation level (Max 10 levels)

## Configuration

IndexedDB mode requires **no environment variables** for basic operation.

Optional configuration for Cloud Sync (`.env.local`):

```env
# Supabase Configuration (Required for Sync)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## API Endpoints (Legacy)

*Note: The following HTTP endpoints exist in the codebase but are **not used** in the default IndexedDB/Client-side mode. All data operations are handled directly in the browser via `lib/api-indexeddb.ts`.*

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- ... (see source code for full list)

## Deployment

This application is designed for static deployment (Vercel, Netlify, etc.).
IndexedDB works entirely client-side, so no server-side database is required for core functionality.

## License

This project is open source and available under the MIT License.