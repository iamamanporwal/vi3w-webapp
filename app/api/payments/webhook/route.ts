import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPaymentOrder, updatePaymentOrder, getFirestore } from '@/lib/server/firestore';
import { grantCredits, BillingError } from '@/lib/server/billing';
import admin from '@/lib/server/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Webhook event types from Razorpay
 */
type RazorpayEvent = 'payment.captured' | 'payment.failed' | 'payment.authorized' | 'order.paid';

/**
 * Payment status types
 */
type PaymentStatus = 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';

/**
 * Webhook payload structure
 */
interface RazorpayWebhookPayload {
  event: RazorpayEvent;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        status: PaymentStatus;
        amount: number;
        currency: string;
        method?: string;
        description?: string;
        created_at?: number;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
      };
    };
  };
  created_at: number;
}

/**
 * Secure constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

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
 * Validate webhook payload structure
 */
function validateWebhookPayload(payload: any): payload is RazorpayWebhookPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (!payload.event || typeof payload.event !== 'string') {
    return false;
  }

  if (!payload.payload || typeof payload.payload !== 'object') {
    return false;
  }

  if (!payload.payload.payment || typeof payload.payload.payment !== 'object') {
    return false;
  }

  if (!payload.payload.payment.entity || typeof payload.payload.payment.entity !== 'object') {
    return false;
  }

  const payment = payload.payload.payment.entity;

  if (!payment.id || typeof payment.id !== 'string') {
    return false;
  }

  if (!payment.order_id || typeof payment.order_id !== 'string') {
    return false;
  }

  if (!payment.status || typeof payment.status !== 'string') {
    return false;
  }

  return true;
}

/**
 * Log webhook event with structured logging
 */
function logWebhookEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, any>
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'webhook',
    ...metadata,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * POST /api/payments/webhook
 * Razorpay webhook handler for payment events
 * 
 * Handles:
 * - payment.captured: Payment successful, add credits
 * - payment.failed: Payment failed, update order status
 * - payment.authorized: Payment authorized (optional handling)
 * 
 * Features:
 * - Signature verification with timing-safe comparison
 * - Idempotent processing (prevents duplicate credit grants)
 * - Comprehensive error handling
 * - Structured logging
 * - Input validation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let orderId: string | null = null;
  let paymentId: string | null = null;

  try {
    // 1. Validate environment configuration
    const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!razorpayWebhookSecret || razorpayWebhookSecret.trim().length === 0) {
      logWebhookEvent('error', 'RAZORPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // 2. Get and validate webhook signature
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature || signature.trim().length === 0) {
      logWebhookEvent('warn', 'Missing webhook signature', {
        headers: Object.fromEntries(request.headers.entries()),
      });
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 400 }
      );
    }

    // 3. Get raw body for signature verification
    // Note: Must read as text, not JSON, for signature verification
    let body: string;
    try {
      body = await request.text();

      if (!body || body.trim().length === 0) {
        logWebhookEvent('warn', 'Empty webhook body');
        return NextResponse.json(
          { error: 'Empty webhook body' },
          { status: 400 }
        );
      }
    } catch (error: any) {
      logWebhookEvent('error', 'Failed to read webhook body', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to read webhook body' },
        { status: 400 }
      );
    }

    // 4. Verify webhook signature with timing-safe comparison
    const expectedSignature = crypto
      .createHmac('sha256', razorpayWebhookSecret)
      .update(body)
      .digest('hex');

    if (!secureCompare(signature, expectedSignature)) {
      logWebhookEvent('error', 'Invalid webhook signature', {
        receivedLength: signature.length,
        expectedLength: expectedSignature.length,
        bodyLength: body.length,
      });
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // 5. Parse and validate webhook payload
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(body);
    } catch (error: any) {
      logWebhookEvent('error', 'Failed to parse webhook payload', { error: error.message });
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (!validateWebhookPayload(parsedPayload)) {
      logWebhookEvent('error', 'Invalid webhook payload structure', {
        hasEvent: !!parsedPayload?.event,
        hasPayload: !!parsedPayload?.payload,
        hasPayment: !!parsedPayload?.payload?.payment,
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload structure' },
        { status: 400 }
      );
    }

    // TypeScript now knows parsedPayload is RazorpayWebhookPayload
    const payload: RazorpayWebhookPayload = parsedPayload;
    const event = payload.event;
    const payment = payload.payload.payment.entity;
    orderId = payment.order_id;
    paymentId = payment.id;
    const status = payment.status;
    const amount = payment.amount;
    const currency = payment.currency;

    // 6. Validate required fields
    if (!orderId || orderId.trim().length === 0) {
      logWebhookEvent('error', 'Missing order_id in webhook payload', { paymentId });
      return NextResponse.json(
        { error: 'Missing order_id in webhook payload' },
        { status: 400 }
      );
    }

    if (!paymentId || paymentId.trim().length === 0) {
      logWebhookEvent('error', 'Missing payment_id in webhook payload', { orderId });
      return NextResponse.json(
        { error: 'Missing payment_id in webhook payload' },
        { status: 400 }
      );
    }

    // 7. Get order from Firestore
    const order = await getPaymentOrder(orderId);

    if (!order) {
      logWebhookEvent('warn', 'Order not found for webhook', {
        orderId,
        paymentId,
        event,
      });
      // Return 200 to prevent Razorpay from retrying
      // The order might have been created elsewhere or deleted
      return NextResponse.json({
        success: true,
        message: 'Order not found (may have been processed elsewhere)',
      });
    }

    // 8. Validate order amount matches payment amount (security check)
    if (order.amount !== amount) {
      logWebhookEvent('error', 'Order amount mismatch', {
        orderId,
        paymentId,
        orderAmount: order.amount,
        paymentAmount: amount,
      });
      return NextResponse.json(
        { error: 'Order amount mismatch' },
        { status: 400 }
      );
    }

    if (order.currency !== currency) {
      logWebhookEvent('error', 'Order currency mismatch', {
        orderId,
        paymentId,
        orderCurrency: order.currency,
        paymentCurrency: currency,
      });
      return NextResponse.json(
        { error: 'Order currency mismatch' },
        { status: 400 }
      );
    }

    // 9. Handle different webhook events
    logWebhookEvent('info', 'Processing webhook event', {
      event,
      orderId,
      paymentId,
      currentOrderStatus: order.status,
      paymentStatus: status,
    });

    if (event === 'payment.captured' && status === 'captured') {
      // Payment successful - add credits (idempotent)
      if (order.status === 'completed') {
        // Already processed - idempotent response
        logWebhookEvent('info', 'Order already completed (idempotent)', {
          orderId,
          paymentId,
        });
        return NextResponse.json({
          success: true,
          message: 'Order already processed',
        });
      }

      if (order.status === 'failed') {
        logWebhookEvent('warn', 'Attempting to complete a failed order', {
          orderId,
          paymentId,
        });
        // This shouldn't happen, but handle gracefully
        return NextResponse.json(
          { error: 'Cannot complete a failed order' },
          { status: 400 }
        );
      }

      // Process payment capture
      try {
        const creditsToAdd = order.credits;

        if (!creditsToAdd || creditsToAdd <= 0) {
          logWebhookEvent('error', 'Invalid credits amount in order', {
            orderId,
            credits: creditsToAdd,
          });
          return NextResponse.json(
            { error: 'Invalid credits amount in order' },
            { status: 400 }
          );
        }

        // Use Firestore transaction for atomicity
        // First, get the order document ID (we need it for the transaction)
        const db = getFirestore();
        const orderQuery = await db
          .collection('payment_orders')
          .where('order_id', '==', orderId)
          .limit(1)
          .get();

        if (orderQuery.empty) {
          throw new Error('Order not found for transaction');
        }

        const orderDocRef = orderQuery.docs[0].ref;

        await db.runTransaction(async (transaction) => {
          // Re-read order in transaction to prevent race conditions
          const orderDoc = await transaction.get(orderDocRef);

          if (!orderDoc.exists) {
            throw new Error('Order not found in transaction');
          }

          const orderData = orderDoc.data();

          if (!orderData) {
            throw new Error('Order data is empty');
          }

          // Double-check status hasn't changed
          if (orderData.status === 'completed') {
            logWebhookEvent('info', 'Order already completed in transaction (race condition handled)', {
              orderId,
            });
            return; // Idempotent - already processed
          }

          // Add credits to user account
          const userRef = db.collection('users').doc(order.user_id);
          const userDoc = await transaction.get(userRef);

          let currentCredits = 0;
          if (userDoc.exists) {
            currentCredits = userDoc.data()?.credits || 0;
          }

          const newCredits = currentCredits + creditsToAdd;

          // Update user credits
          if (userDoc.exists) {
            transaction.update(userRef, {
              credits: newCredits,
              updated_at: admin.firestore.Timestamp.now(),
            });
          } else {
            transaction.set(userRef, {
              credits: creditsToAdd,
              email: '',
              created_at: admin.firestore.Timestamp.now(),
              updated_at: admin.firestore.Timestamp.now(),
            });
          }

          // Update order status
          transaction.update(orderDocRef, {
            status: 'completed',
            payment_id: paymentId,
            completed_at: admin.firestore.Timestamp.now(),
            updated_at: admin.firestore.Timestamp.now(),
          });

          // Create transaction record
          const transactionRef = db.collection('transactions').doc();
          transaction.set(transactionRef, {
            user_id: order.user_id,
            type: 'purchase',
            amount: creditsToAdd,
            status: 'completed',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            created_at: admin.firestore.Timestamp.now(),
          });
        });

        const processingTime = Date.now() - startTime;
        logWebhookEvent('info', 'Payment captured and credits added successfully', {
          orderId,
          paymentId,
          userId: order.user_id,
          creditsAdded: creditsToAdd,
          processingTimeMs: processingTime,
        });

        return NextResponse.json({
          success: true,
          message: `Added ${creditsToAdd} credits`,
          orderId,
          paymentId,
        });
      } catch (error: any) {
        // Handle billing errors specifically
        if (error instanceof BillingError) {
          logWebhookEvent('error', 'Billing error during credit grant', {
            orderId,
            paymentId,
            error: error.message,
            code: error.code,
          });
          return NextResponse.json(
            { error: 'Failed to grant credits', detail: error.message },
            { status: 500 }
          );
        }

        // Handle transaction conflicts (retry might be needed)
        if (error.code === 10 || error.message?.includes('transaction')) {
          logWebhookEvent('warn', 'Transaction conflict during webhook processing', {
            orderId,
            paymentId,
            error: error.message,
          });
          // Return 500 so Razorpay will retry
          return NextResponse.json(
            { error: 'Transaction conflict, please retry' },
            { status: 500 }
          );
        }

        throw error; // Re-throw for general error handling
      }
    } else if (event === 'payment.failed') {
      // Payment failed - update order status (idempotent)
      if (order.status === 'failed') {
        logWebhookEvent('info', 'Order already marked as failed (idempotent)', {
          orderId,
          paymentId,
        });
        return NextResponse.json({
          success: true,
          message: 'Order already marked as failed',
        });
      }

      if (order.status === 'completed') {
        logWebhookEvent('warn', 'Attempting to fail a completed order', {
          orderId,
          paymentId,
        });
        // This shouldn't happen, but handle gracefully
        return NextResponse.json(
          { error: 'Cannot fail a completed order' },
          { status: 400 }
        );
      }

      // Update order status to failed
      await updatePaymentOrder(orderId, {
        status: 'failed',
        payment_id: paymentId,
      });

      logWebhookEvent('info', 'Payment failed, order status updated', {
        orderId,
        paymentId,
        userId: order.user_id,
      });

      return NextResponse.json({
        success: true,
        message: 'Order marked as failed',
        orderId,
        paymentId,
      });
    } else if (event === 'payment.authorized') {
      // Payment authorized but not yet captured
      // We can log this but don't need to do anything yet
      logWebhookEvent('info', 'Payment authorized (waiting for capture)', {
        orderId,
        paymentId,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment authorized, waiting for capture',
      });
    } else {
      // Unhandled event type
      logWebhookEvent('info', 'Unhandled webhook event type', {
        event,
        orderId,
        paymentId,
      });

      // Return success for unhandled events to prevent retries
      return NextResponse.json({
        success: true,
        message: `Event ${event} received but not processed`,
      });
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logWebhookEvent('error', 'Webhook processing error', {
      orderId: orderId || 'unknown',
      paymentId: paymentId || 'unknown',
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime,
    });

    // Return 500 for unexpected errors so Razorpay can retry
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        detail: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
