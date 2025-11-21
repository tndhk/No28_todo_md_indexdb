-- Initial Schema for Markdown Todo App
-- Migration: 20250120000001_initial_schema

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,

    -- Content
    content TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
    completed BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    due_date DATE,
    repeat_frequency TEXT CHECK (repeat_frequency IN ('daily', 'weekly', 'monthly')),

    -- Hierarchy & Ordering
    indent_level INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL,
    line_number INTEGER NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign Keys
    CONSTRAINT tasks_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT tasks_parent_id_fkey
        FOREIGN KEY (parent_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_display_order ON tasks(project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE projects IS 'User projects containing tasks';
COMMENT ON TABLE tasks IS 'Tasks with hierarchy support and Markdown metadata';
COMMENT ON COLUMN tasks.line_number IS 'Virtual line number for Markdown rendering';
COMMENT ON COLUMN tasks.display_order IS 'Order within parent for sorting and drag-drop';
COMMENT ON COLUMN tasks.indent_level IS 'Nesting depth (0 = top-level, 1 = first child, etc.)';
