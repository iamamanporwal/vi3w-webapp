import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getGeneration, updateGeneration } from '@/lib/server/firestore';
import { syncGenerationWithMeshy } from '@/lib/server/meshy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/generations/[id]
 * Get a specific generation by ID
 * Syncs with Meshy if necessary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const generationId = (await params).id;

    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      );
    }

    // Get generation
    let generation = await getGeneration(generationId);

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (generation.user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if we need to sync with Meshy
    // Only sync if status is generating/pending and we have a task ID
    if (
      (generation.status === 'generating' || generation.status === 'pending') &&
      generation.output_data?.meshy_task_id
    ) {
      try {
        const syncedGeneration = await syncGenerationWithMeshy(generation);
        if (syncedGeneration) {
          generation = syncedGeneration;
        }
      } catch (syncError) {
        console.error('Error syncing with Meshy:', syncError);
        // Continue with existing data if sync fails
      }
    }

    return NextResponse.json(generation);
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching generation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation', detail: error.message },
      { status: 500 }
    );
  }
}
