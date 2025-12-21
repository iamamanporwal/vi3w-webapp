import { NextRequest, NextResponse } from 'next/server';
import { updateGeneration } from '@/lib/server/firestore';
import admin from '@/lib/server/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status, output, error } = body;
        const { searchParams } = new URL(req.url);
        const generationId = searchParams.get('generationId');

        console.log(`[ReplicateWebhook] Received event for generation ${generationId}: ${status}`);

        if (!generationId) {
            return NextResponse.json({ error: 'Missing generationId' }, { status: 400 });
        }

        const updates: any = {
            updated_at: admin.firestore.Timestamp.now(),
        };

        if (status === 'succeeded') {
            updates.status = 'completed';
            updates.progress_percentage = 100;

            // Trellis output format: usually an object with 'model_file' or similar, or just a URL
            // Let's inspect output structure if possible, but for now assume it returns a GLB URL or list
            // firtoz/trellis usually returns a list of files or a zip. 
            // If it returns a list, we look for .glb

            let modelUrl = null;
            if (typeof output === 'string') {
                modelUrl = output;
            } else if (Array.isArray(output)) {
                modelUrl = output.find((url: string) => url.endsWith('.glb')) || output[0];
            } else if (typeof output === 'object') {
                modelUrl = output.model_file || output.glb || output.model;
            }

            updates.output_data = {
                model_url: modelUrl,
                replicate_output: output
            };
        } else if (status === 'failed' || status === 'canceled') {
            updates.status = 'failed';
            updates.error_message = error || 'Generation failed';
        } else {
            // processing or starting
            updates.status = 'generating';
        }

        await updateGeneration(generationId, updates);
        console.log(`[ReplicateWebhook] Updated generation ${generationId} status to ${updates.status}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[ReplicateWebhook] Error processing webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
