import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getProject, getGenerationsByProjectId } from '@/lib/server/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/generations
 * Get all generations for a project (thread history)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const projectId = (await params).id;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists and user owns it
    const project = await getProject(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all generations for this project
    const generations = await getGenerationsByProjectId(projectId);

    return NextResponse.json(generations);
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching project generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project generations', detail: error.message },
      { status: 500 }
    );
  }
}
