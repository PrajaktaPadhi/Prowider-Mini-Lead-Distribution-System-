import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Provider from '@/lib/models/Provider';
import WebhookEvent from '@/lib/models/WebhookEvent';
import { DEFAULT_MONTHLY_QUOTA } from '@/lib/config';

export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { idempotencyKey } = body;

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'idempotencyKey is required' },
        { status: 400 }
      );
    }

    // Check if this webhook was already processed (idempotency)
    const existingEvent = await WebhookEvent.findOne({ idempotencyKey });
    if (existingEvent) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'This webhook was already processed. No action taken.',
        processedAt: existingEvent.processedAt,
        result: existingEvent.result,
      });
    }

    // Process the quota reset
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const updateResult = await Provider.updateMany(
      {},
      {
        $set: {
          leadsReceived: 0,
          monthlyQuota: DEFAULT_MONTHLY_QUOTA,
          quotaResetMonth: currentMonth,
        },
      }
    );

    const result = {
      providersReset: updateResult.modifiedCount,
      resetMonth: currentMonth,
      newQuota: DEFAULT_MONTHLY_QUOTA,
    };

    // Record the webhook event for idempotency
    try {
      await WebhookEvent.create({
        idempotencyKey,
        action: 'reset_quota',
        processedAt: now,
        result,
      });
    } catch (err) {
      // If duplicate key error, another concurrent request processed it
      if (err.code === 11000) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          message: 'This webhook was already processed by a concurrent request.',
        });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      message: 'All provider quotas have been reset.',
      result,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
