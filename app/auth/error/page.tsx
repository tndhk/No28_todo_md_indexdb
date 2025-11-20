'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams?.get('error');

    const errorMessages: Record<string, string> = {
        Configuration: 'There is a problem with the server configuration.',
        AccessDenied: 'You do not have access to this resource.',
        Verification: 'The verification token has expired or has already been used.',
        Default: 'An authentication error occurred.',
        CredentialsSignin: 'Invalid email or password.',
    };

    const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Authentication Error
                    </h2>
                    <div className="mt-4 rounded-md bg-red-50 p-4">
                        <div className="text-sm text-red-700 text-center">
                            {errorMessage}
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <Link
                        href="/auth/signin"
                        className="font-medium text-blue-600 hover:text-blue-500"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <ErrorContent />
        </Suspense>
    );
}
