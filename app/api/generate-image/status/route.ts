import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import Replicate from 'replicate';

export const dynamic = 'force-dynamic';

// Initialize Replicate client
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

export async function GET(req: NextRequest) {
    try {
        // Authenticate user
        await requireAuth(req);

        const { searchParams } = new URL(req.url);
        const predictionId = searchParams.get('id');

        if (!predictionId) {
            return NextResponse.json(
                { error: 'Prediction ID is required' },
                { status: 400 }
            );
        }

        // Check prediction status
        const prediction = await replicate.predictions.get(predictionId);

        // If succeeded, get the output URL
        let imageUrl = null;
        if (prediction.status === 'succeeded' && prediction.output) {
            // Replicate output can be a string or array of strings depending on model
            if (Array.isArray(prediction.output)) {
                imageUrl = prediction.output[0];
            } else {
                imageUrl = prediction.output;
            }
        }

        return NextResponse.json({
            id: prediction.id,
            status: prediction.status,
            output: imageUrl,
            error: prediction.error
        });

    } catch (error: any) {
        console.error('Error checking generation status:', error);

        if (error.message?.includes('Authorization') || error.message?.includes('token')) {
            return createAuthErrorResponse(error.message, 401);
        }

        return NextResponse.json(
            { error: 'Failed to check status', detail: error.message },
            { status: 500 }
        );
    }
}
