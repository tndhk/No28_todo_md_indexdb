import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * CSRF Token Configuration
 * SECURITY: Protects against Cross-Site Request Forgery attacks
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LIFETIME = 60 * 60 * 24; // 24 hours

/**
 * Generate a cryptographically secure CSRF token
 * @returns Random token string
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Get or create CSRF token from cookies
 * @returns CSRF token
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!token) {
    token = generateCsrfToken();
    cookieStore.set(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_LIFETIME,
      path: '/',
    });
  }

  return token;
}

/**
 * Validate CSRF token from request
 * Uses constant-time comparison to prevent timing attacks
 * @param request - HTTP request object
 * @returns true if token is valid
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
  // TESTING: Skip CSRF validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    // Tokens are different lengths
    return false;
  }
}

/**
 * Delete CSRF token from cookies
 */
export async function deleteCsrfToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}

/**
 * Get CSRF token for client-side use
 * This can be called from API routes to provide token to client
 * @returns Object containing token and header name
 */
export async function getCsrfTokenForClient(): Promise<{
  token: string;
  headerName: string;
}> {
  const token = await getCsrfToken();
  return {
    token,
    headerName: CSRF_HEADER_NAME,
  };
}
