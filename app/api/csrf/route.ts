import { NextResponse } from 'next/server';
import { getCsrfTokenForClient } from '@/lib/csrf';

/**
 * GET /api/csrf
 * Returns CSRF token for client-side use
 * SECURITY: Provides CSRF token to be included in subsequent requests
 */
export async function GET() {
  const csrfData = await getCsrfTokenForClient();

  return NextResponse.json({
    csrfToken: csrfData.token,
    headerName: csrfData.headerName,
  });
}
