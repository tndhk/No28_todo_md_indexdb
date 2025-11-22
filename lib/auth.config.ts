import { NextAuthConfig } from 'next-auth';

/**
 * NextAuth.js configuration for Edge Runtime (middleware)
 * This file contains only Edge-compatible code
 */
export const authConfig: NextAuthConfig = {
    providers: [], // Providers will be added in auth.ts
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            const isOnApi = nextUrl.pathname.startsWith('/api');
            const isAuthApi = nextUrl.pathname.startsWith('/api/auth');
            const isRegisterApi = nextUrl.pathname.startsWith('/api/register');

            // Allow auth and register API routes without authentication
            if (isAuthApi || isRegisterApi) {
                return true;
            }

            // For API routes, allow the request to reach the handler
            // The handler will check authentication and return 401 if needed
            if (isOnApi) {
                return true;
            }

            // Protect dashboard
            if (isOnDashboard) {
                return isLoggedIn;
            }

            return true;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours - refresh token daily for security
    },
    trustHost: true,
};
