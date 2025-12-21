'use server';

import { generateTextToImage } from '@/lib/server/replicate';
import { verifyToken } from '@/lib/server/auth';
import { cookies } from 'next/headers';

export async function generateImageAction(prompt: string) {
    try {
        // 1. Verify Auth (Optional for free tier, but good practice)
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            throw new Error('Unauthorized');
        }

        await verifyToken(token);

        // 2. Call Replicate
        const imageUrl = await generateTextToImage(prompt);

        return { success: true, imageUrl };
    } catch (error: any) {
        console.error('Generate Image Action Error:', error);
        return { success: false, error: error.message };
    }
}
