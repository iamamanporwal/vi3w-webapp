import axios from 'axios';
import { updateGeneration } from './firestore';
import admin from './firebase-admin';

const MESHY_API_BASE = 'https://api.meshy.ai/openapi/v1';

export async function syncGenerationWithMeshy(generation: any): Promise<any> {
    const taskId = generation.output_data?.meshy_task_id;
    if (!taskId) return generation;

    // Only sync if status is 'generating' or 'pending'
    if (generation.status !== 'generating' && generation.status !== 'pending') {
        return generation;
    }

    // Only sync if it hasn't been updated in the last 10 seconds to avoid rate limits
    const now = Date.now();
    const updatedAt = generation.updated_at?.toMillis?.() || 0;
    if (now - updatedAt < 10000) {
        return generation;
    }

    const meshyKey = process.env.MESHY_API_KEY;
    if (!meshyKey) {
        console.error('[MeshySync] MESHY_API_KEY is not set');
        return generation;
    }

    try {
        console.log(`[MeshySync] Syncing generation ${generation.id} with Meshy task ${taskId}...`);
        const response = await axios.get(`${MESHY_API_BASE}/image-to-3d/${taskId}`, {
            headers: {
                Authorization: `Bearer ${meshyKey}`,
            },
            timeout: 10000,
        });

        const { status, progress, model_urls, task_error } = response.data;
        console.log(`[MeshySync] Meshy status: ${status}, progress: ${progress}%`);

        const updates: any = {
            updated_at: admin.firestore.Timestamp.now(),
        };

        let finalStatus = generation.status;
        let finalProgress = progress || generation.progress_percentage;

        if (status === 'SUCCEEDED') {
            finalStatus = 'completed';
            finalProgress = 100;
            updates.status = 'completed';
            updates.progress_percentage = 100;
            updates.output_data = {
                ...(generation.output_data || {}),
                model_url: model_urls?.glb,
            };
        } else if (status === 'FAILED' || status === 'CANCELED') {
            finalStatus = 'failed';
            updates.status = 'failed';
            updates.error_message = task_error?.message || task_error || `Meshy task ${status.toLowerCase()}`;
        } else {
            // Still generating
            finalStatus = 'generating';
            updates.status = 'generating';
            // Map Meshy progress (0-100) to our 75-100 range if needed, 
            // but here we just use the raw progress if it's higher than current
            const mappedProgress = 75 + Math.floor((progress / 100) * 25);
            updates.progress_percentage = Math.max(generation.progress_percentage, mappedProgress);
            finalProgress = updates.progress_percentage;
        }

        // Update Firestore
        await updateGeneration(generation.id, updates);
        console.log(`[MeshySync] Updated generation ${generation.id} in Firestore`);

        // Return updated generation object
        return {
            ...generation,
            ...updates,
            status: finalStatus,
            progress_percentage: finalProgress,
        };
    } catch (error: any) {
        console.error(`[MeshySync] Error syncing with Meshy:`, error.message);
        return generation;
    }
}

export async function generateImageTo3D(imageUrl: string): Promise<string> {
    const meshyKey = process.env.MESHY_API_KEY;
    if (!meshyKey) {
        throw new Error('MESHY_API_KEY is not set');
    }

    try {
        console.log(`[Meshy] Starting Image-to-3D for URL: ${imageUrl}`);
        const response = await axios.post(
            `${MESHY_API_BASE}/image-to-3d`,
            {
                image_url: imageUrl,
                enable_pbr: true,
            },
            {
                headers: {
                    Authorization: `Bearer ${meshyKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const { result } = response.data;
        console.log(`[Meshy] Task started: ${result}`);
        return result; // This is the task ID
    } catch (error: any) {
        console.error('[Meshy] Error starting generation:', error.response?.data || error.message);
        throw new Error(`Failed to start Meshy generation: ${error.response?.data?.message || error.message}`);
    }
}
