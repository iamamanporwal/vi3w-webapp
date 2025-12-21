import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import Replicate from 'replicate';

export const dynamic = 'force-dynamic';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const userId = await requireAuth(req);

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Call Replicate API for image generation (Async)
    // Using Google's Nano Banana model
    // We need to fetch the model version first as predictions.create requires a version ID
    const model = await replicate.models.get("google", "nano-banana");
    const version = model.latest_version?.id;

    if (!version) {
      throw new Error("Model version not found for google/nano-banana");
    }

    const prediction = await replicate.predictions.create({
      version: version,
      input: {
        prompt: prompt,
        output_format: "png"
      }
    });

    return NextResponse.json({
      success: true,
      predictionId: prediction.id,
      status: prediction.status
    });
  } catch (error: any) {
    console.error('Error starting image generation:', error);

    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    return NextResponse.json(
      { error: 'Failed to start image generation', detail: error.message },
      { status: 500 }
    );
  }
}
