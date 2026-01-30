import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Lazy load web-push to avoid build-time issues
let webpush: any = null;

// Configure web-push with VAPID keys only if they exist
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

// Initialize web-push only when needed
async function initWebPush() {
  if (!webpush && vapidPublicKey && vapidPrivateKey) {
    webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      'mailto:admin@rwa-platform.com',
      vapidPublicKey,
      vapidPrivateKey
    );
  }
  return webpush;
}

// In-memory storage for demo purposes
const subscriptions = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    // Check if VAPID keys are configured
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'Push notifications not configured. VAPID keys missing.' },
        { status: 503 }
      );
    }

    // Initialize web-push
    const webpushInstance = await initWebPush();
    if (!webpushInstance) {
      return NextResponse.json(
        { success: false, error: 'Push notifications not available' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { userId, notification, targetAll = false } = body;

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification data required' },
        { status: 400 }
      );
    }

    const results = [];
    const targetSubscriptions = targetAll 
      ? Array.from(subscriptions.values())
      : Array.from(subscriptions.values()).filter(sub => sub.userId === userId);

    for (const subscription of targetSubscriptions) {
      try {
        await webpushInstance.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify(notification)
        );
        
        results.push({
          subscriptionId: subscription.id,
          status: 'sent',
        });
      } catch (error) {
        console.error(`Failed to send notification to ${subscription.id}:`, error);
        
        // Remove invalid subscriptions
        if (error instanceof Error && error.message.includes('410')) {
          subscriptions.delete(subscription.id);
        }
        
        results.push({
          subscriptionId: subscription.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        results,
      },
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}