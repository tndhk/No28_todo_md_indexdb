import { createClient } from '@supabase/supabase-js';

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase client for server-side operations with service role key
 * This bypasses Row Level Security and should only be used in API routes
 * where we've already verified user authentication
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Supabase client for client-side operations with anonymous key
 * This respects Row Level Security policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
});

/**
 * Database types for type-safe queries
 */
export interface DbProject {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface DbTask {
    id: string;
    project_id: string;
    parent_id: string | null;
    content: string;
    status: 'todo' | 'doing' | 'done';
    completed: boolean;
    due_date: string | null;
    repeat_frequency: 'daily' | 'weekly' | 'monthly' | null;
    indent_level: number;
    display_order: number;
    line_number: number;
    created_at: string;
    updated_at: string;
}
