import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getGenerationsByUserId } from '@/lib/server/firestore';
import { withCache, getCacheKey } from '@/lib/server/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/generations
 * Get user's generation history
 * Query params: status (optional), workflow_type (optional)
 * Cached for 30 seconds
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const workflowType = searchParams.get('workflow_type');

    // Cache generations for 30 seconds
    const cacheKey = getCacheKey('generations', userId, status || 'all', workflowType || 'all');
    const generations = await withCache(
      cacheKey,
      () => getGenerationsByUserId(userId, (status as any) || undefined, (workflowType as any) || undefined),
      30000 // 30 seconds TTL
    );

    const response = NextResponse.json(generations);

    // Add cache headers
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');

    return response;
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generations', detail: error.message },
      { status: 500 }
    );
  }
}
