import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug logging for Supabase initialization
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('[Supabase Init] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ set' : '✗ NOT SET');
    console.log('[Supabase Init] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ set' : '✗ NOT SET');
    console.log('[Supabase Init] USE_SUPABASE:', process.env.USE_SUPABASE);
}

/**
 * Supabase client for server-side operations with service role key
 * This bypasses Row Level Security and should only be used in API routes
 * where we've already verified user authentication
 * Returns null if Supabase is not configured
 */
export const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
}) : null;

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.log('[Supabase Init] supabaseAdmin initialized:', supabaseAdmin ? '✓ success' : '✗ FAILED');
}

/**
 * Supabase client for client-side operations with anonymous key
 * This respects Row Level Security policies
 * Returns null if Supabase is not configured
 */
export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
}) : null;

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
