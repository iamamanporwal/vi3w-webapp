import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import crypto from 'crypto';
import { getPaymentOrder, updatePaymentOrder } from '@/lib/server/firestore';
import { grantCredits } from '@/lib/server/billing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/verify
 * Verify Razorpay payment and add credits
 * Body: { payment_id, order_id, signature }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeySecret) {
      console.error('[Payment] RAZORPAY_KEY_SECRET is missing in environment variables');
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { payment_id, order_id, signature } = body;

    if (!payment_id || !order_id || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_id, order_id, signature' },
        { status: 400 }
      );
    }

    // Verify signature
    const message = `${order_id}|${payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(message)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error(`[Payment] Signature mismatch. Expected: ${expectedSignature}, Received: ${signature}`);
      console.error(`[Payment] Message: ${message}`);
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Get order from Firestore
    const order = await getPaymentOrder(order_id);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user owns the order
    if (order.user_id !== userId) {
      return NextResponse.json(
        { error: 'Order does not belong to user' },
        { status: 403 }
      );
    }

    // Check if already processed
    if (order.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
      });
    }

    const creditsToAdd = order.credits;

    // Add credits to user account
    await grantCredits(userId, creditsToAdd, {
      orderId: order_id,
      paymentId: payment_id,
      type: 'purchase',
    });

    // Update order status
    await updatePaymentOrder(order_id, {
      status: 'completed',
      payment_id: payment_id,
    });

    console.log(`Payment verified and credits added: ${creditsToAdd} credits for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Added ${creditsToAdd} credits`,
    });
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed', detail: error.message },
      { status: 500 }
    );
  }
}
