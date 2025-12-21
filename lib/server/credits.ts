import admin from './firebase-admin';
import { FirestoreError } from './firestore';

export class InsufficientCreditsError extends Error {
    constructor(message: string = 'Insufficient credits') {
        super(message);
        this.name = 'InsufficientCreditsError';
    }
}

/**
 * Check if user has enough credits (read-only)
 */
export async function checkCredits(userId: string, amount: number): Promise<boolean> {
    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return false;
        const balance = userDoc.data()?.credits || 0;
        return balance >= amount;
    } catch (error) {
        console.error('Error checking credits:', error);
        return false;
    }
}

/**
 * Deduct credits atomically using a transaction
 * Throws InsufficientCreditsError if balance is too low
 */
export async function deductCredits(userId: string, amount: number): Promise<number> {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    try {
        return await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new FirestoreError('User not found', 'USER_NOT_FOUND');
            }

            const currentCredits = userDoc.data()?.credits || 0;
            if (currentCredits < amount) {
                throw new InsufficientCreditsError();
            }

            const newBalance = currentCredits - amount;
            transaction.update(userRef, { credits: newBalance });
            return newBalance;
        });
    } catch (error: any) {
        if (error instanceof InsufficientCreditsError) {
            throw error;
        }
        throw new FirestoreError(`Failed to deduct credits: ${error.message}`, 'DEDUCT_CREDITS_ERROR', error);
    }
}

/**
 * Refund credits atomically using a transaction
 */
export async function refundCredits(userId: string, amount: number): Promise<number> {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    try {
        return await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new FirestoreError('User not found', 'USER_NOT_FOUND');
            }

            const currentCredits = userDoc.data()?.credits || 0;
            const newBalance = currentCredits + amount;
            transaction.update(userRef, { credits: newBalance });
            return newBalance;
        });
    } catch (error: any) {
        throw new FirestoreError(`Failed to refund credits: ${error.message}`, 'REFUND_CREDITS_ERROR', error);
    }
}
