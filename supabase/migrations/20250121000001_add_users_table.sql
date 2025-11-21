-- Add users table for custom authentication
-- Migration: 20250121000001_add_users_table

-- Create users table for NextAuth custom authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                          -- e.g., "user_1234567890_abc123"
    name TEXT NOT NULL,                          -- User's display name
    username TEXT NOT NULL UNIQUE,               -- Username for login (case-insensitive)
    hashed_password TEXT NOT NULL,               -- bcrypt hashed password
    data_dir TEXT NOT NULL,                      -- User-specific data directory path (for reference)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for username lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Create unique index to enforce case-insensitive username uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique_lower ON users(LOWER(username));

-- Add trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can view their own user record
CREATE POLICY "Users can view their own record"
    ON users
    FOR SELECT
    USING (id = current_setting('app.current_user_id', true));

-- Service role can manage all users (for registration and authentication)
CREATE POLICY "Service role can manage all users"
    ON users
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Update projects table to support TEXT user_id for compatibility
-- Note: This allows both UUID (Supabase Auth) and TEXT (custom auth) user IDs
ALTER TABLE projects ALTER COLUMN user_id TYPE TEXT;

-- Comments for documentation
COMMENT ON TABLE users IS 'Custom user accounts for NextAuth authentication';
COMMENT ON COLUMN users.username IS 'Username for login (case-insensitive, unique)';
COMMENT ON COLUMN users.hashed_password IS 'bcrypt hashed password';
COMMENT ON COLUMN users.data_dir IS 'Reference to user-specific data directory (legacy field)';
