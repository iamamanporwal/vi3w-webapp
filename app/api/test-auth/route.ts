/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Test authentication endpoint
 * GET /api/test-auth
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok' });
  /*
  try {
    const userId = await requireAuth(request);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      userId,
    });
  } catch (error: any) {
    return createAuthErrorResponse(error.message, 401);
  }
  */
}
