'use server';

import { generateTrellis3D } from '@/lib/server/replicate';
import { verifyToken } from '@/lib/server/auth';
import { deductCredits, refundCredits } from '@/lib/server/credits';
import { createGeneration, updateGeneration } from '@/lib/server/firestore';
import { cookies } from 'next/headers';

const COST_PER_GENERATION = 125;

export async function generateFloorplan3DAction(projectId: string, imageUrl: string) {
    let userId: string | null = null;
    let generationId: string | null = null;

    try {
        // 1. Verify Auth
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) throw new Error('Unauthorized');
        userId = await verifyToken(token);

        // 2. Deduct Credits (Atomic)
        await deductCredits(userId, COST_PER_GENERATION);

        // 3. Create Generation Record
        const generationNumber = Date.now();

        const generation = await createGeneration(
            userId,
            projectId,
            'floorplan-3d',
            {
                image_path: imageUrl,
                has_image: true
            },
            generationNumber
        );
        generationId = generation.id;

        // 4. Call Replicate (Trellis) with Webhook
        // We need the base URL for the webhook
        // In production, this should be the actual domain. In dev, we might need a tunnel or just rely on polling if webhook fails.
        // For now, let's assume we have a public URL or we handle it gracefully.
        // If running locally without tunnel, webhooks won't reach localhost.
        // We can pass a dummy URL or check env.

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vi3w-webapp.vercel.app'; // Fallback to prod or env
        const webhookUrl = `${baseUrl}/api/webhooks/replicate?generationId=${generationId}`;

        const prediction = await generateTrellis3D(imageUrl, webhookUrl);

        // 5. Update Generation with Prediction ID
        await updateGeneration(generationId, {
            status: 'generating',
            output_data: { replicate_prediction_id: prediction.id }
        });

        return { success: true, generationId };

    } catch (error: any) {
        console.error('Generate Floorplan 3D Action Error:', error);

        // 6. Refund logic on failure
        if (userId && error.message !== 'Insufficient credits') {
            try {
                await refundCredits(userId, COST_PER_GENERATION);
                console.log(`Refunded ${COST_PER_GENERATION} credits to ${userId}`);
            } catch (refundError) {
                console.error('CRITICAL: Failed to refund credits:', refundError);
            }
        }

        if (generationId) {
            try {
                await updateGeneration(generationId, {
                    status: 'failed',
                    error_message: error.message
                });
            } catch (updateError) {
                console.error('Failed to update generation status:', updateError);
            }
        }

        return { success: false, error: error.message };
    }
}
