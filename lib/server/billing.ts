import admin from './firebase-admin';
import { getFirestore, getUser, createUserWithStarterCredits, createTransaction } from './firestore';
import type { TransactionDocument, UserDocument } from '@/types/firestore';
import crypto from 'crypto';

const STARTER_CREDITS = 1250;
const GENERATION_COST = 125;
const MAX_CREDITS = 1000000; // Safety limit
const MAX_TRANSACTION_AMOUNT = 100000; // Safety limit

/**
 * Custom error classes
 */
export class BillingError extends Error {
  constructor(message: string, public code?: string, public originalError?: any) {
    super(message);
    this.name = 'BillingError';
  }
}

export class InsufficientCreditsError extends BillingError {
  constructor(available: number, required: number) {
    super(`Insufficient credits: have ${available}, need ${required}`, 'INSUFFICIENT_CREDITS');
  }
}

/**
 * Secure constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  
  // Use crypto.timingSafeEqual if available, otherwise fallback
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    // Fallback for environments without crypto.timingSafeEqual
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * Validate user ID
 */
function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new BillingError('Invalid user ID: must be a non-empty string', 'INVALID_USER_ID');
  }
  if (userId.length > 128) {
    throw new BillingError('Invalid user ID: too long', 'INVALID_USER_ID');
  }
}

/**
 * Validate credit amount
 */
function validateCreditAmount(amount: number, allowNegative: boolean = false): void {
  if (!Number.isFinite(amount)) {
    throw new BillingError('Invalid credit amount: must be a finite number', 'INVALID_AMOUNT');
  }
  if (!allowNegative && amount < 0) {
    throw new BillingError('Invalid credit amount: cannot be negative', 'INVALID_AMOUNT');
  }
  if (Math.abs(amount) > MAX_TRANSACTION_AMOUNT) {
    throw new BillingError(`Invalid credit amount: exceeds maximum of ${MAX_TRANSACTION_AMOUNT}`, 'INVALID_AMOUNT');
  }
}

/**
 * Get user's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    validateUserId(userId);
    
    const user = await getUser(userId);
    if (!user) {
      // User doesn't exist, create with starter credits
      const newUser = await createUserWithStarterCredits(userId, '', STARTER_CREDITS);
      return newUser.credits;
    }
    
    // Ensure credits is a valid number
    const credits = typeof user.credits === 'number' ? user.credits : 0;
    return Math.max(0, Math.floor(credits)); // Ensure non-negative integer
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to get user credits: ${error.message}`, 'GET_CREDITS_ERROR', error);
  }
}

/**
 * Check if user has enough credits
 */
export async function checkCredits(userId: string, cost: number = GENERATION_COST): Promise<boolean> {
  try {
    validateUserId(userId);
    validateCreditAmount(cost);
    
    const credits = await getUserCredits(userId);
    return credits >= cost;
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to check credits: ${error.message}`, 'CHECK_CREDITS_ERROR', error);
  }
}

/**
 * Deduct credits from user account (atomic operation)
 * Returns the new balance after deduction
 * 
 * IMPORTANT: This function uses Firestore transactions to ensure atomicity
 */
export async function deductCredits(
  userId: string,
  cost: number = GENERATION_COST,
  metadata?: {
    projectId?: string;
    generationId?: string;
    type?: 'usage';
  }
): Promise<number> {
  try {
    validateUserId(userId);
    validateCreditAmount(cost);
    
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    
    // Use transaction to ensure atomic operation with retry logic
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const newBalance = await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          
          let currentCredits: number;
          
          if (!userDoc.exists) {
            // Create user with starter credits if doesn't exist
            currentCredits = STARTER_CREDITS;
            const userData = {
              credits: STARTER_CREDITS,
              email: '',
              created_at: admin.firestore.Timestamp.now(),
            };
            transaction.set(userRef, userData);
          } else {
            const userData = userDoc.data();
            currentCredits = typeof userData?.credits === 'number' ? userData.credits : 0;
          }
          
          // Check if user has enough credits
          if (currentCredits < cost) {
            throw new InsufficientCreditsError(currentCredits, cost);
          }
          
          // Calculate new balance
          const newCredits = Math.max(0, currentCredits - cost);
          
          // Safety check: ensure credits don't exceed maximum
          if (newCredits > MAX_CREDITS) {
            throw new BillingError(`Credit balance exceeds maximum of ${MAX_CREDITS}`, 'CREDIT_LIMIT_EXCEEDED');
          }
          
          transaction.update(userRef, {
            credits: newCredits,
            updated_at: admin.firestore.Timestamp.now(),
          });
          
          return newCredits;
        });
        
        // Create transaction record (outside transaction to avoid conflicts)
        // Use try-catch to ensure credit deduction succeeds even if transaction record fails
        try {
          await createTransaction({
            user_id: userId,
            type: metadata?.type || 'usage',
            amount: -cost,
            status: 'completed',
            project_id: metadata?.projectId,
            generation_id: metadata?.generationId,
          } as TransactionDocument);
        } catch (transactionError: any) {
          // Log error but don't fail the credit deduction
          console.error('Failed to create transaction record:', transactionError);
          // In production, you might want to queue this for retry
        }
        
        return newBalance;
      } catch (error: any) {
        // If it's a validation or business logic error, don't retry
        if (error instanceof InsufficientCreditsError || error instanceof BillingError) {
          throw error;
        }
        
        // If it's a transaction conflict, retry
        if (error.code === 10 || error.message?.includes('transaction')) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new BillingError('Failed to deduct credits: transaction conflict after multiple retries', 'TRANSACTION_CONFLICT', error);
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 5000)));
          continue;
        }
        
        // Other errors, throw immediately
        throw error;
      }
    }
    
    throw new BillingError('Failed to deduct credits: max attempts reached', 'MAX_ATTEMPTS_REACHED');
  } catch (error: any) {
    if (error instanceof BillingError || error instanceof InsufficientCreditsError) {
      throw error;
    }
    throw new BillingError(`Failed to deduct credits: ${error.message}`, 'DEDUCT_CREDITS_ERROR', error);
  }
}

/**
 * Grant credits to user (atomic operation)
 */
export async function grantCredits(
  userId: string,
  amount: number,
  metadata?: {
    orderId?: string;
    paymentId?: string;
    type?: 'purchase';
  }
): Promise<number> {
  try {
    validateUserId(userId);
    validateCreditAmount(amount);
    
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const newBalance = await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          
          let currentCredits: number;
          
          if (!userDoc.exists) {
            // Create user if doesn't exist
            currentCredits = 0;
            const userData = {
              credits: amount,
              email: '',
              created_at: admin.firestore.Timestamp.now(),
            };
            transaction.set(userRef, userData);
            return amount;
          }
          
          const userData = userDoc.data();
          currentCredits = typeof userData?.credits === 'number' ? userData.credits : 0;
          const newCredits = currentCredits + amount;
          
          // Safety check: ensure credits don't exceed maximum
          if (newCredits > MAX_CREDITS) {
            throw new BillingError(`Credit balance would exceed maximum of ${MAX_CREDITS}`, 'CREDIT_LIMIT_EXCEEDED');
          }
          
          transaction.update(userRef, {
            credits: newCredits,
            updated_at: admin.firestore.Timestamp.now(),
          });
          
          return newCredits;
        });
        
        // Create transaction record (outside transaction)
        try {
          await createTransaction({
            user_id: userId,
            type: metadata?.type || 'purchase',
            amount,
            status: 'completed',
            razorpay_order_id: metadata?.orderId,
            razorpay_payment_id: metadata?.paymentId,
          } as TransactionDocument);
        } catch (transactionError: any) {
          console.error('Failed to create transaction record:', transactionError);
        }
        
        return newBalance;
      } catch (error: any) {
        if (error instanceof BillingError) {
          throw error;
        }
        
        if (error.code === 10 || error.message?.includes('transaction')) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new BillingError('Failed to grant credits: transaction conflict after multiple retries', 'TRANSACTION_CONFLICT', error);
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 5000)));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new BillingError('Failed to grant credits: max attempts reached', 'MAX_ATTEMPTS_REACHED');
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to grant credits: ${error.message}`, 'GRANT_CREDITS_ERROR', error);
  }
}

/**
 * Create user with starter credits (if doesn't exist)
 */
export async function createUserWithStarterCreditsIfNeeded(
  userId: string,
  email: string
): Promise<UserDocument> {
  try {
    validateUserId(userId);
    
    if (typeof email !== 'string') {
      throw new BillingError('Invalid email: must be a string', 'INVALID_EMAIL');
    }
    
    const user = await getUser(userId);
    if (user) {
      return user;
    }
    
    return await createUserWithStarterCredits(userId, email, STARTER_CREDITS);
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to create user: ${error.message}`, 'CREATE_USER_ERROR', error);
  }
}

/**
 * Grant credits by email (Admin function)
 * Uses secure comparison to prevent timing attacks
 */
export async function grantCreditsByEmail(
  email: string,
  credits: number,
  adminKey: string
): Promise<number> {
  try {
    // Validate inputs
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new BillingError('Invalid email: must be a non-empty string', 'INVALID_EMAIL');
    }
    
    validateCreditAmount(credits);
    
    if (!adminKey || typeof adminKey !== 'string') {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    // Verify admin key using secure comparison
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      throw new BillingError('Admin API key not configured', 'ADMIN_KEY_NOT_CONFIGURED');
    }
    
    if (!secureCompare(adminKey, expectedAdminKey)) {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    // Get user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email.trim());
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new BillingError(`User not found with email: ${email}`, 'USER_NOT_FOUND');
      }
      throw new BillingError(`Failed to get user by email: ${error.message}`, 'GET_USER_ERROR', error);
    }
    
    return await grantCredits(userRecord.uid, credits);
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to grant credits by email: ${error.message}`, 'GRANT_CREDITS_BY_EMAIL_ERROR', error);
  }
}

/**
 * Grant credits by user ID (Admin function)
 */
export async function grantCreditsByUserId(
  userId: string,
  credits: number,
  adminKey: string
): Promise<number> {
  try {
    validateUserId(userId);
    validateCreditAmount(credits);
    
    if (!adminKey || typeof adminKey !== 'string') {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    // Verify admin key using secure comparison
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      throw new BillingError('Admin API key not configured', 'ADMIN_KEY_NOT_CONFIGURED');
    }
    
    if (!secureCompare(adminKey, expectedAdminKey)) {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    return await grantCredits(userId, credits);
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to grant credits by user ID: ${error.message}`, 'GRANT_CREDITS_BY_USER_ID_ERROR', error);
  }
}

/**
 * Get user credits by email (Admin function)
 */
export async function getUserCreditsByEmail(
  email: string,
  adminKey: string
): Promise<number> {
  try {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new BillingError('Invalid email: must be a non-empty string', 'INVALID_EMAIL');
    }
    
    if (!adminKey || typeof adminKey !== 'string') {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    // Verify admin key using secure comparison
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      throw new BillingError('Admin API key not configured', 'ADMIN_KEY_NOT_CONFIGURED');
    }
    
    if (!secureCompare(adminKey, expectedAdminKey)) {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }
    
    // Get user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email.trim());
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new BillingError(`User not found with email: ${email}`, 'USER_NOT_FOUND');
      }
      throw new BillingError(`Failed to get user by email: ${error.message}`, 'GET_USER_ERROR', error);
    }
    
    return await getUserCredits(userRecord.uid);
  } catch (error: any) {
    if (error instanceof BillingError) {
      throw error;
    }
    throw new BillingError(`Failed to get user credits by email: ${error.message}`, 'GET_CREDITS_BY_EMAIL_ERROR', error);
  }
}

// Re-export for convenience
export { createUserWithStarterCredits } from './firestore';
export type { UserDocument } from '@/types/firestore';
