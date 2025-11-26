-- Cleanup unused tables and policies
-- Migration: 20251126000002_cleanup_unused_tables

-- 1. Drop 'tasks' table as tasks are stored within 'projects' JSONB column
DROP TABLE IF EXISTS tasks;

-- 2. Drop 'users' table as we use Supabase Auth directly
DROP TABLE IF EXISTS users;

-- 3. Cleanup RLS policies for 'projects' (ensure only relevant ones exist)
--    Explicitly ensure we are using the correct policy for projects
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON tasks;

-- Documentation update
COMMENT ON TABLE projects IS 'Stores project data including nested tasks in JSONB format';
