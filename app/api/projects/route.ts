import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getProjectsByUserId } from '@/lib/server/firestore';
import { withCache, getCacheKey } from '@/lib/server/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * Fetch user's project history
 * Query params: workflow_type (optional)
 * Cached for 60 seconds to reduce database load
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Get workflow_type from query params
    const { searchParams } = new URL(request.url);
    const workflowType = searchParams.get('workflow_type') as 'text-to-3d' | 'floorplan-3d' | null;

    // Validate workflow_type if provided
    if (workflowType && workflowType !== 'text-to-3d' && workflowType !== 'floorplan-3d') {
      return NextResponse.json(
        { error: 'Invalid workflow_type. Must be "text-to-3d" or "floorplan-3d"' },
        { status: 400 }
      );
    }

    // Cache projects for 60 seconds
    const cacheKey = getCacheKey('projects', userId, workflowType || 'all');
    const projects = await withCache(
      cacheKey,
      () => getProjectsByUserId(userId, workflowType || undefined),
      60000 // 60 seconds TTL
    );

    const response = NextResponse.json(projects);

    // Add cache headers for client-side caching
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');

    return response;
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', detail: error.message },
      { status: 500 }
    );
  }
}
