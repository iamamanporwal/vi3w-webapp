import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/server/middleware/auth';
import Razorpay from 'razorpay';
import { createPaymentOrder } from '@/lib/server/firestore';
import type { PaymentOrderDocument } from '@/types/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create-order
 * Create a Razorpay order for credit purchase
 * Returns: order_id, amount, currency, key_id
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Initialize Razorpay client
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // Create order: ₹4000 = 1,250 credits
    const amount = 4000 * 100; // Amount in paise
    const currency = 'INR';
    const credits = 1250;

    const orderData = {
      amount,
      currency,
      receipt: `order_${userId}_${Date.now()}`,
      notes: {
        user_id: userId,
        credits: credits.toString(),
        description: 'Vi3W Credits Purchase',
      },
    };

    // Create order with Razorpay
    const order = await razorpay.orders.create(orderData);

    // Store order in Firestore for verification later
    await createPaymentOrder({
      user_id: userId,
      order_id: order.id,
      amount,
      currency,
      credits,
      status: 'created',
    } as PaymentOrderDocument);

    console.log(`Payment order created: ${order.id} for user ${userId}`);

    return NextResponse.json({
      order_id: order.id,
      amount,
      currency,
      key_id: razorpayKeyId, // Frontend needs this for Razorpay checkout
    });
  } catch (error: any) {
    if (error.message?.includes('Authorization') || error.message?.includes('token')) {
      return createAuthErrorResponse(error.message, 401);
    }

    console.error('Payment order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order', detail: error.message },
      { status: 500 }
    );
  }
}
