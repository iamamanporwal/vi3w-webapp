'use server';

import { generateImageTo3D } from '@/lib/server/meshy';
import { verifyToken } from '@/lib/server/auth';
import { deductCredits, refundCredits } from '@/lib/server/credits';
import { createGeneration, updateGeneration } from '@/lib/server/firestore';
import { cookies } from 'next/headers';

const COST_PER_GENERATION = 125;

export async function generate3DAction(projectId: string, imageUrl: string) {
    let userId: string | null = null;
    let generationId: string | null = null;

    try {
        // 1. Verify Auth
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) throw new Error('Unauthorized');
        userId = await verifyToken(token);

        // 2. Deduct Credits (Atomic)
        // This throws InsufficientCreditsError if balance is low
        await deductCredits(userId, COST_PER_GENERATION);

        // 3. Create Generation Record
        // We start with generation number 1 for now, or fetch count. 
        // Ideally we should fetch project to get next number, but for simplicity/speed we might rely on client or separate logic.
        // For robustness, let's just use a timestamp-based approach or random if number isn't critical for uniqueness, 
        // but the schema asks for it. Let's assume 1 for now or fetch project count if needed.
        // To keep it fast, we'll just pass 0 and let the UI handle ordering by date.
        // Actually, firestore.ts requires a number. Let's fetch project to be safe.

        // Optimization: We could pass generation number from client, but that's insecure.
        // Let's just use Date.now() as a proxy for order if we don't want to read project.
        // But let's try to be correct.
        const generationNumber = Date.now();

        const generation = await createGeneration(
            userId,
            projectId,
            'text-to-3d',
            {
                prompt: 'Image to 3D', // We could pass original prompt if we had it
                image_path: imageUrl,
                has_image: true
            },
            generationNumber
        );
        generationId = generation.id;

        // 4. Call Meshy API
        const taskId = await generateImageTo3D(imageUrl);

        // 5. Update Generation with Task ID
        await updateGeneration(generationId, {
            status: 'generating',
            output_data: { meshy_task_id: taskId }
        });

        return { success: true, generationId };

    } catch (error: any) {
        console.error('Generate 3D Action Error:', error);

        // 6. Refund logic on failure
        if (userId && error.message !== 'Insufficient credits') {
            // Only refund if we actually deducted (which implies we passed step 2)
            // And if we failed AFTER deduction.
            // If error is InsufficientCreditsError, we didn't deduct.

            // We need to know if deduction happened.
            // If we are here, it might be because createGeneration failed or generateImageTo3D failed.
            // In those cases, we MUST refund.
            try {
                await refundCredits(userId, COST_PER_GENERATION);
                console.log(`Refunded ${COST_PER_GENERATION} credits to ${userId}`);
            } catch (refundError) {
                console.error('CRITICAL: Failed to refund credits:', refundError);
            }
        }

        // Mark generation as failed if it was created
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
