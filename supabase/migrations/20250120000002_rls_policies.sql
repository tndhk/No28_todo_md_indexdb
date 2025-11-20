-- Row Level Security Policies
-- Migration: 20250120000002_rls_policies

-- Enable RLS on both tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
-- Users can only view their own projects
CREATE POLICY "Users can view their own projects"
    ON projects
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert their own projects"
    ON projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update their own projects"
    ON projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
    ON projects
    FOR DELETE
    USING (auth.uid() = user_id);

-- Tasks RLS Policies
-- Users can view tasks in their own projects
CREATE POLICY "Users can view tasks in their projects"
    ON tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can insert tasks in their own projects
CREATE POLICY "Users can insert tasks in their projects"
    ON tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can update tasks in their own projects
CREATE POLICY "Users can update tasks in their projects"
    ON tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can delete tasks in their own projects
CREATE POLICY "Users can delete tasks in their projects"
    ON tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON POLICY "Users can view their own projects" ON projects IS 'RLS: Users can only view their own projects';
COMMENT ON POLICY "Users can view tasks in their projects" ON tasks IS 'RLS: Users can only view tasks in projects they own';
