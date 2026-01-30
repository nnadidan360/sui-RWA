import { NextRequest, NextResponse } from 'next/server';
import { getEventStore } from '@/lib/realtime/event-store';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'anonymous';
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const eventStore = getEventStore();
    
    let events;
    if (since) {
      // Get events since the specified timestamp
      events = await eventStore.getEventsSince(userId, parseInt(since));
    } else {
      // Get latest events
      events = await eventStore.getLatestEvents(userId, limit);
    }
    
    return NextResponse.json(events, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error) {
    console.error('Error in polling endpoint:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

export const runtime = 'nodejs';