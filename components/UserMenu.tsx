'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';

export default function UserMenu() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return (
            <div className="flex items-center space-x-2 px-3 py-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex items-center space-x-2">
                <Link
                    href="/auth/signin"
                    className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                    Sign In
                </Link>
                <Link
                    href="/auth/register"
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    Register
                </Link>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                    {session.user?.name || session.user?.email}
                </span>
            </div>
            <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 rounded-md hover:bg-gray-100"
            >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
            </button>
        </div>
    );
}
