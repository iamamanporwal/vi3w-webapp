import { NextRequest, NextResponse } from 'next/server';
import { getUserCreditsByEmail, getUserCredits } from '@/lib/server/billing';
import { BillingError } from '@/lib/server/billing';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/check-credits
 * Admin endpoint to check a user's credit balance
 * Body: { email?: string, user_id?: string, admin_key: string }
 * Either email or user_id must be provided
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, user_id, admin_key } = body;

    // Validate inputs
    if (!admin_key) {
      return NextResponse.json(
        { success: false, error: 'Admin key is required' },
        { status: 400 }
      );
    }

    if (!email && !user_id) {
      return NextResponse.json(
        { success: false, error: 'Either email or user_id must be provided' },
        { status: 400 }
      );
    }

    // Verify admin key first (for both email and user_id paths)
    const expectedAdminKey = process.env.ADMIN_API_KEY;
    if (!expectedAdminKey) {
      throw new BillingError('Admin API key not configured', 'ADMIN_KEY_NOT_CONFIGURED');
    }

    // Secure constant-time comparison
    function secureCompare(a: string, b: string): boolean {
      if (!a || !b || a.length !== b.length) {
        return false;
      }
      try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      } catch {
        let result = 0;
        for (let i = 0; i < a.length; i++) {
          result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
      }
    }

    if (!secureCompare(admin_key, expectedAdminKey)) {
      throw new BillingError('Invalid admin key', 'INVALID_ADMIN_KEY');
    }

    let credits: number;
    let userId: string;

    // Get credits by email or user_id
    if (email) {
      credits = await getUserCreditsByEmail(email, admin_key);
      // Get user_id from email
      const admin = (await import('@/lib/server/firebase-admin')).default;
      const userRecord = await admin.auth().getUserByEmail(email);
      userId = userRecord.uid;
    } else {
      // For user_id, admin key is already verified above
      credits = await getUserCredits(user_id);
      userId = user_id;
    }

    return NextResponse.json({
      success: true,
      email: email || undefined,
      user_id: userId,
      credits,
    });
  } catch (error: any) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Admin check credits error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
