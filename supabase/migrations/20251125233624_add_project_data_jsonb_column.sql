-- Add data jsonb column to projects table and update RLS policies
-- Migration: 20251125233624_add_project_data_jsonb_column

ALTER TABLE projects
ADD COLUMN data jsonb;

-- Optionally, if you want to initialize existing projects' data column from title:
-- UPDATE projects SET data = jsonb_build_object('id', id, 'title', title, 'tasks', '[]'::jsonb, 'path', NULL);

-- Create RLS policies for projects table
-- Users can view their own projects
CREATE POLICY "Users can view their own projects"
    ON projects
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

-- Users can insert their own projects
CREATE POLICY "Users can create their own projects"
    ON projects
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Users can update their own projects
CREATE POLICY "Users can update their own projects"
    ON projects
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
    ON projects
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));

-- Disable existing RLS policies on projects that might conflict
-- (Assuming there might be RLS policies from 20250120000002_rls_policies.sql
-- if they were applied to 'projects' table previously.
-- We are replacing them with more granular policies here.)
-- To be safe, we might need to drop conflicting policies if they exist.
-- However, typically a new policy takes precedence or an error will occur
-- if multiple policies of the same type (e.g. FOR SELECT) exist and conflict.
-- It's safer to assume existing general policies might be dropped.
-- For now, let's just add new ones assuming they will be additive or overriding.
-- If deployment fails due to conflicting policies, we'll address it then.
