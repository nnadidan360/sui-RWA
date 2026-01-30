import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
// In production, this would be stored in a database
const subscriptions = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, keys, userId } = body;

    if (!endpoint || !keys) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store subscription
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    subscriptions.set(subscriptionId, {
      id: subscriptionId,
      endpoint,
      keys,
      userId: userId || 'anonymous',
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: { subscriptionId },
    });
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}