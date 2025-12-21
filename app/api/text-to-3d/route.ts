/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { TextTo3DWorkflow } from '@/lib/workflows/textTo3D';
import { ValidationError } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/text-to-3d
 * 
 * Generate a 3D model from text prompt or image
 */
import { z } from 'zod';

const generateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000, "Prompt is too long").optional(),
  // Allow Data URIs or URLs
  image_url: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await requireAuth(request);

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate body
    const result = generateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      );
    }

    const { prompt, image_url } = result.data;

    if (!prompt && !image_url) {
      return NextResponse.json(
        { error: 'Either prompt or image_url is required' },
        { status: 400 }
      );
    }

    // Execute workflow
    const workflow = new TextTo3DWorkflow();
    const { generationId, projectId } = await workflow.execute(userId, {
      prompt,
      imagePath: image_url,
      has_image: !!image_url
    });

    return NextResponse.json({
      status: 'success',
      generationId,
      projectId
    });

  } catch (error: any) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Handle auth errors
    if (error.message === 'Unauthorized' || error.code === 'auth/id-token-expired') {
      return createAuthErrorResponse(error);
    }

    console.error('Text-to-3D API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
