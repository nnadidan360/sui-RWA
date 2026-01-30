import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
const subscriptions = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, endpoint } = body;

    if (subscriptionId) {
      subscriptions.delete(subscriptionId);
    } else if (endpoint) {
      // Find and remove by endpoint
      for (const [id, sub] of subscriptions.entries()) {
        if (sub.endpoint === endpoint) {
          subscriptions.delete(id);
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (error) {
    console.error('Error unsubscribing from notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}