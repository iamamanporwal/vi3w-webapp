'use server';

import { convertFloorplanToIsometric } from '@/lib/server/replicate';
import { verifyToken } from '@/lib/server/auth';
import { cookies } from 'next/headers';

export async function convertFloorplanAction(imageUrl: string) {
    try {
        // 1. Verify Auth
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            throw new Error('Unauthorized');
        }

        await verifyToken(token);

        // 2. Call Replicate (ControlNet)
        // Cost is 0 credits
        const isometricUrl = await convertFloorplanToIsometric(imageUrl);

        return { success: true, isometricUrl };
    } catch (error: any) {
        console.error('Convert Floorplan Action Error:', error);
        return { success: false, error: error.message };
    }
}
