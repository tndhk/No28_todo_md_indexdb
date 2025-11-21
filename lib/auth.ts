import NextAuth, { User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { securityLogger } from './logger';
import { authConfig } from './auth.config';
import { supabaseAdmin } from './supabase-client';

/**
 * User interface for the application
 */
export interface AppUser {
    id: string;
    name: string;
    username: string;
    hashedPassword: string;
    dataDir: string; // User-specific data directory
    createdAt: string;
}

/**
 * Users storage file path
 */
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

/**
 * Check if Supabase should be used for user storage
 * Returns true if Supabase is configured and enabled
 */
function shouldUseSupabase(): boolean {
    const hasSupabaseAdmin = !!supabaseAdmin;
    const isSupabaseEnabled = process.env.USE_SUPABASE === 'true';
    const result = hasSupabaseAdmin && isSupabaseEnabled;

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        securityLogger.info({
            hasSupabaseAdmin,
            isSupabaseEnabled,
            result,
            useSupabaseEnv: process.env.USE_SUPABASE,
        }, '[Auth] shouldUseSupabase check');
    }

    return result;
}

/**
 * Load users from storage (Supabase or file-based)
 */
export async function loadUsers(): Promise<AppUser[]> {
    if (shouldUseSupabase()) {
        try {
            const { data, error } = await supabaseAdmin!
                .from('users')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            return (data || []).map(row => ({
                id: row.id,
                name: row.name,
                username: row.username,
                hashedPassword: row.hashed_password,
                dataDir: row.data_dir,
                createdAt: row.created_at,
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            securityLogger.error(
                {
                    error: errorMessage,
                    stack: errorStack,
                    storage: 'supabase'
                },
                'Failed to load users from Supabase'
            );
            return [];
        }
    } else {
        // File-based storage (local development)
        try {
            if (!fs.existsSync(USERS_FILE)) {
                return [];
            }
            const content = fs.readFileSync(USERS_FILE, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            securityLogger.error(
                {
                    error: errorMessage,
                    stack: errorStack,
                    filePath: USERS_FILE
                },
                'Failed to load users from file'
            );
            return [];
        }
    }
}

/**
 * Save users to storage (file-based only, Supabase uses individual operations)
 */
export function saveUsers(users: AppUser[]): void {
    if (shouldUseSupabase()) {
        // Supabase uses individual insert/update operations, not bulk saves
        securityLogger.warn('saveUsers() called in Supabase mode - use individual operations instead');
        return;
    }

    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Find a user by username
 */
export async function findUserByUsername(username: string): Promise<AppUser | undefined> {
    if (shouldUseSupabase()) {
        try {
            const { data, error } = await supabaseAdmin!
                .from('users')
                .select('*')
                .ilike('username', username) // Case-insensitive match
                .limit(1)
                .single();

            if (error || !data) {
                return undefined;
            }

            return {
                id: data.id,
                name: data.name,
                username: data.username,
                hashedPassword: data.hashed_password,
                dataDir: data.data_dir,
                createdAt: data.created_at,
            };
        } catch (_error) {
            return undefined;
        }
    } else {
        const users = await loadUsers();
        const found = users.find(u => u && u.username && u.username.toLowerCase() === username.toLowerCase());
        return found || undefined;
    }
}

/**
 * Find a user by ID
 */
export async function findUserById(id: string): Promise<AppUser | undefined> {
    if (shouldUseSupabase()) {
        try {
            const { data, error } = await supabaseAdmin!
                .from('users')
                .select('*')
                .eq('id', id)
                .limit(1)
                .single();

            if (error || !data) {
                return undefined;
            }

            return {
                id: data.id,
                name: data.name,
                username: data.username,
                hashedPassword: data.hashed_password,
                dataDir: data.data_dir,
                createdAt: data.created_at,
            };
        } catch (_error) {
            return undefined;
        }
    } else {
        const users = await loadUsers();
        return users.find(u => u.id === id);
    }
}

/**
 * Create a new user
 */
export async function createUser(
    name: string,
    username: string,
    password: string
): Promise<AppUser> {
    // Generate unique ID and hash password
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const hashedPassword = await bcrypt.hash(password, 12);

    // User-specific data directory path (for reference)
    const userDataDir = path.join(process.cwd(), 'data', 'users', id);

    if (shouldUseSupabase()) {
        // Check if user already exists
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            throw new Error('User with this username already exists');
        }

        try {
            const { data, error } = await supabaseAdmin!
                .from('users')
                .insert({
                    id,
                    name,
                    username: username.toLowerCase(),
                    hashed_password: hashedPassword,
                    data_dir: userDataDir,
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            securityLogger.info({ userId: id, username }, 'New user created in Supabase');

            return {
                id: data.id,
                name: data.name,
                username: data.username,
                hashedPassword: data.hashed_password,
                dataDir: data.data_dir,
                createdAt: data.created_at,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            securityLogger.error({ error: errorMessage, username }, 'Failed to create user in Supabase');
            throw new Error('Failed to create user');
        }
    } else {
        // File-based storage
        const users = await loadUsers();

        // Check if user already exists
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('User with this username already exists');
        }

        // Create user-specific data directory
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        // Copy sample project to user's directory
        const sampleSource = path.join(process.cwd(), 'data', 'sample.md');
        const sampleDest = path.join(userDataDir, 'sample.md');
        if (fs.existsSync(sampleSource)) {
            fs.copyFileSync(sampleSource, sampleDest);
        }

        const newUser: AppUser = {
            id,
            name,
            username: username.toLowerCase(),
            hashedPassword,
            dataDir: userDataDir,
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        saveUsers(users);

        securityLogger.info({ userId: id, username }, 'New user created in file storage');

        return newUser;
    }
}

/**
 * Verify user credentials
 */
export async function verifyCredentials(
    username: string,
    password: string
): Promise<AppUser | null> {
    const user = await findUserByUsername(username);

    if (!user) {
        securityLogger.warn({ username }, 'Login attempt for non-existent user');
        return null;
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isValid) {
        securityLogger.warn({ username, userId: user.id }, 'Invalid password attempt');
        return null;
    }

    securityLogger.info({ userId: user.id, username }, 'User authenticated successfully');
    return user;
}

/**
 * Get the data directory for a user
 * Falls back to default data directory if user not found
 */
export async function getUserDataDir(userId: string | undefined | null): Promise<string> {
    if (!userId) {
        return path.join(process.cwd(), 'data');
    }

    const user = await findUserById(userId);
    if (user && user.dataDir) {
        // Ensure directory exists (only for file-based storage)
        if (!shouldUseSupabase() && !fs.existsSync(user.dataDir)) {
            fs.mkdirSync(user.dataDir, { recursive: true });
        }

        // In Supabase mode, if the dataDir doesn't exist in the file system,
        // fall back to the default data directory (which contains shared projects)
        if (shouldUseSupabase() && !fs.existsSync(user.dataDir)) {
            console.log('[getUserDataDir] User dataDir not found in file system, falling back to default:', path.join(process.cwd(), 'data'));
            return path.join(process.cwd(), 'data');
        }

        return user.dataDir;
    }

    return path.join(process.cwd(), 'data');
}

/**
 * Check if a user has access to a project
 */
export async function userHasProjectAccess(userId: string, projectPath: string): Promise<boolean> {
    const user = await findUserById(userId);

    if (!user) {
        return false;
    }

    // Check if the project path is within the user's data directory
    const normalizedProjectPath = path.normalize(projectPath);
    const normalizedUserDir = path.normalize(user.dataDir);

    return normalizedProjectPath.startsWith(normalizedUserDir);
}

/**
 * NextAuth.js configuration with providers (server-only)
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials): Promise<User | null> {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const user = await verifyCredentials(
                    credentials.username as string,
                    credentials.password as string
                );

                if (!user) {
                    return null;
                }

                return {
                    id: user.id,
                    name: user.name,
                };
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});
