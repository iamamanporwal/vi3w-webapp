import { NextRequest, NextResponse } from 'next/server';
import { grantCreditsByEmail, grantCreditsByUserId } from '@/lib/server/billing';
import { BillingError } from '@/lib/server/billing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/grant-credits
 * Admin endpoint to grant credits to a user
 * Body: { email?: string, user_id?: string, credits: number, admin_key: string }
 * Either email or user_id must be provided
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, user_id, credits, admin_key } = body;

    // Validate inputs
    if (!admin_key) {
      return NextResponse.json(
        { success: false, error: 'Admin key is required' },
        { status: 400 }
      );
    }

    if (!credits || typeof credits !== 'number' || credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'Credits must be a positive number' },
        { status: 400 }
      );
    }

    if (!email && !user_id) {
      return NextResponse.json(
        { success: false, error: 'Either email or user_id must be provided' },
        { status: 400 }
      );
    }

    let newBalance: number;
    let userId: string;

    // Grant credits by email or user_id
    if (email) {
      newBalance = await grantCreditsByEmail(email, credits, admin_key);
      // Get user_id from email (we need to fetch it)
      const admin = (await import('@/lib/server/firebase-admin')).default;
      const userRecord = await admin.auth().getUserByEmail(email);
      userId = userRecord.uid;
    } else {
      newBalance = await grantCreditsByUserId(user_id, credits, admin_key);
      userId = user_id;
    }

    return NextResponse.json({
      success: true,
      message: `Granted ${credits} credits`,
      user_id: userId,
      new_balance: newBalance,
    });
  } catch (error: any) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Admin grant credits error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
