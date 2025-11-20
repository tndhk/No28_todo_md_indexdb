import NextAuth, { User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { securityLogger } from './logger';
import { authConfig } from './auth.config';

/**
 * User interface for the application
 */
export interface AppUser {
    id: string;
    name: string;
    email: string;
    hashedPassword: string;
    dataDir: string; // User-specific data directory
    createdAt: string;
}

/**
 * Users storage file path
 */
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

/**
 * Load users from the users file
 */
export function loadUsers(): AppUser[] {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            return [];
        }
        const content = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        securityLogger.error({ error }, 'Failed to load users');
        return [];
    }
}

/**
 * Save users to the users file
 */
export function saveUsers(users: AppUser[]): void {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Find a user by email
 */
export function findUserByEmail(email: string): AppUser | undefined {
    const users = loadUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/**
 * Find a user by ID
 */
export function findUserById(id: string): AppUser | undefined {
    const users = loadUsers();
    return users.find(u => u.id === id);
}

/**
 * Create a new user
 */
export async function createUser(
    name: string,
    email: string,
    password: string
): Promise<AppUser> {
    const users = loadUsers();

    // Check if user already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('User with this email already exists');
    }

    // Generate unique ID and hash password
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user-specific data directory
    const userDataDir = path.join(process.cwd(), 'data', 'users', id);
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
        email: email.toLowerCase(),
        hashedPassword,
        dataDir: userDataDir,
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    securityLogger.info({ userId: id, email }, 'New user created');

    return newUser;
}

/**
 * Verify user credentials
 */
export async function verifyCredentials(
    email: string,
    password: string
): Promise<AppUser | null> {
    const user = findUserByEmail(email);

    if (!user) {
        securityLogger.warn({ email }, 'Login attempt for non-existent user');
        return null;
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isValid) {
        securityLogger.warn({ email, userId: user.id }, 'Invalid password attempt');
        return null;
    }

    securityLogger.info({ userId: user.id, email }, 'User authenticated successfully');
    return user;
}

/**
 * Get the data directory for a user
 * Falls back to default data directory if user not found
 */
export function getUserDataDir(userId: string | undefined | null): string {
    if (!userId) {
        return path.join(process.cwd(), 'data');
    }

    const user = findUserById(userId);
    if (user && user.dataDir) {
        // Ensure directory exists
        if (!fs.existsSync(user.dataDir)) {
            fs.mkdirSync(user.dataDir, { recursive: true });
        }
        return user.dataDir;
    }

    return path.join(process.cwd(), 'data');
}

/**
 * Check if a user has access to a project
 */
export function userHasProjectAccess(userId: string, projectPath: string): boolean {
    const user = findUserById(userId);

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
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials): Promise<User | null> {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await verifyCredentials(
                    credentials.email as string,
                    credentials.password as string
                );

                if (!user) {
                    return null;
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
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
