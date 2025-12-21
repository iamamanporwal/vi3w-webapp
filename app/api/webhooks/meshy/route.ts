import { NextRequest, NextResponse } from 'next/server';
import { updateGeneration, getGeneration } from '@/lib/server/firestore';
import admin from '@/lib/server/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, payload } = body;

        console.log('[MeshyWebhook] Received event:', type, payload);

        // Meshy sends 'model.succeeded', 'model.failed', etc.
        // Payload contains task_id, status, model_urls, etc.

        if (!payload || !payload.task_id) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const taskId = payload.task_id;

        // Find generation by task ID
        // Since we don't have a direct index on meshy_task_id in 'generations' (yet),
        // we might need to query. 
        // Ideally, we should add an index or store generationId in Meshy metadata if possible.
        // But for now, let's assume we can query by 'output_data.meshy_task_id'.
        // If that's slow/missing index, we rely on client polling or sync.

        const db = admin.firestore();
        const snapshot = await db.collection('generations')
            .where('output_data.meshy_task_id', '==', taskId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.warn(`[MeshyWebhook] No generation found for task ${taskId}`);
            return NextResponse.json({ message: 'Generation not found' }, { status: 404 });
        }

        const generationDoc = snapshot.docs[0];
        const generationId = generationDoc.id;
        const generationData = generationDoc.data();

        const updates: any = {
            updated_at: admin.firestore.Timestamp.now(),
        };

        if (type === 'model.succeeded') {
            updates.status = 'completed';
            updates.progress_percentage = 100;
            updates.output_data = {
                ...generationData.output_data,
                model_url: payload.model_urls?.glb,
                thumbnail_url: payload.thumbnail_url,
            };
        } else if (type === 'model.failed' || type === 'model.canceled') {
            updates.status = 'failed';
            updates.error_message = payload.message || 'Generation failed';
        } else if (type === 'model.progress') {
            // payload.progress is 0-100
            updates.progress_percentage = payload.progress;
        }

        await updateGeneration(generationId, updates);
        console.log(`[MeshyWebhook] Updated generation ${generationId} status to ${updates.status}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[MeshyWebhook] Error processing webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
