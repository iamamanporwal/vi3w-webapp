import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getProject } from '@/lib/server/firestore';
import { TextTo3DWorkflow } from '@/lib/workflows/textTo3D';
import { FloorplanTo3DWorkflow } from '@/lib/workflows/floorplan3D';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/generate
 * 
 * Generate a new version of an existing project
 * 
 * Request body:
 * {
 *   prompt?: string;        // Optional: override prompt
 *   imagePath?: string;     // Optional: override image
 * }
 * 
 * Response:
 * {
 *   generationId: string;
 *   projectId: string;
 *   status: 'pending' | 'generating';
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const userId = await requireAuth(request);

    const projectId = (await params).id;

    // Get project and verify ownership
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Project does not belong to user' },
        { status: 403 }
      );
    }

    // Parse request body (optional overrides)
    const body = await request.json().catch(() => ({}));
    const { prompt, imagePath } = body;

    // Use project's input data if not overridden
    const finalPrompt = prompt || project.input_data?.prompt;
    const finalImagePath = imagePath || project.input_data?.image_path;

    // Validate input
    if (!finalPrompt && !finalImagePath) {
      return NextResponse.json(
        { error: 'Either prompt or imagePath must be provided (or exist in project)' },
        { status: 400 }
      );
    }

    // Create appropriate workflow based on project type
    let workflow: TextTo3DWorkflow | FloorplanTo3DWorkflow;
    if (project.workflow_type === 'text-to-3d') {
      workflow = new TextTo3DWorkflow();
    } else if (project.workflow_type === 'floorplan-3d') {
      workflow = new FloorplanTo3DWorkflow();
    } else {
      return NextResponse.json(
        { error: `Unsupported workflow type: ${project.workflow_type}` },
        { status: 400 }
      );
    }

    // Create generation event
    const generationId = await workflow.createGenerationEvent(
      userId,
      project.workflow_type,
      {
        prompt: finalPrompt,
        has_image: !!finalImagePath,
      },
      projectId
    );

    // Assign generation number
    try {
      await workflow.assignGenerationNumber(projectId, generationId);
    } catch (error: any) {
      console.error('Error assigning generation number:', error);
      // Continue even if this fails
    }

    // Run workflow asynchronously (don't await)
    workflow
      .run(userId, {
        prompt: finalPrompt,
        imagePath: finalImagePath,
        projectId,
        generationId,
      })
      .then(async (result) => {
        // Link generation to project
        try {
          await workflow.linkGenerationToProject(result.generationId, projectId);
        } catch (error: any) {
          console.error('Error linking generation to project:', error);
        }
      })
      .catch((error) => {
        console.error('Workflow execution error:', error);
        // Error is already handled in workflow.updateGenerationStatus
      });

    // Return immediately with generation ID
    return NextResponse.json({
      generationId,
      projectId,
      status: 'pending',
      message: 'Generation started. Poll /api/generations/[id] for status.',
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error.name === 'AuthError' || error.code === 'AUTH_ERROR') {
      return createAuthErrorResponse(error.message, 401);
    }

    // Handle other errors
    console.error('Error in project generate API:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
      },
      { status: error.status || 500 }
    );
  }
}
