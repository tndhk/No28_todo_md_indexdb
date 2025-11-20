import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth';
import { securityLogger } from '@/lib/logger';
import { z } from 'zod';

const registerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password is too long')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        ),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate input
        const result = registerSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message || 'Validation failed' },
                { status: 400 }
            );
        }

        const { name, email, password } = result.data;

        // Create user
        const user = await createUser(name, email, password);

        securityLogger.info({ userId: user.id, email }, 'User registered successfully');

        return NextResponse.json(
            {
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof Error && error.message === 'User with this email already exists') {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 409 }
            );
        }

        securityLogger.error({ error }, 'Registration failed');
        return NextResponse.json(
            { error: 'Registration failed' },
            { status: 500 }
        );
    }
}
