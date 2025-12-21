import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getUserCredits } from '@/lib/server/billing';

export const dynamic = 'force-dynamic';
import { withCache, getCacheKey } from '@/lib/server/cache';

/**
 * GET /api/credits
 * Get user's current credit balance
 * Cached for 30 seconds to reduce database load
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Cache credits for 30 seconds
    const cacheKey = getCacheKey('credits', userId);
    const credits = await withCache(
      cacheKey,
      () => getUserCredits(userId),
      30000 // 30 seconds TTL
    );

    const response = NextResponse.json({
      success: true,
      user_id: userId,
      credits,
    });

    // Add cache headers for client-side caching
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching credits:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch credits',
        detail: error.message
      },
      { status: 500 }
    );
  }
}
