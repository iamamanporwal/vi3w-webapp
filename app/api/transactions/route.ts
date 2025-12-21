import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import { getTransactionsByUserId } from '@/lib/server/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions
 * Get user's transaction history
 * Query params: limit (optional, default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

    const transactions = await getTransactionsByUserId(userId, limit);

    return NextResponse.json(transactions);
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', detail: error.message },
      { status: 500 }
    );
  }
}
