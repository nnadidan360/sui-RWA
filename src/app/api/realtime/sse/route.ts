import { NextRequest } from 'next/server';
import { getEventStore } from '@/lib/realtime/event-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'anonymous';
  const since = searchParams.get('since');
  
  // Create SSE response
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectionEvent = `data: ${JSON.stringify({
        id: `conn_${Date.now()}`,
        type: 'connection',
        data: { status: 'connected', userId },
        timestamp: Date.now(),
      })}\n\n`;
      
      controller.enqueue(encoder.encode(connectionEvent));
      
      // Send any missed events if 'since' parameter is provided
      if (since) {
        sendMissedEvents(controller, encoder, userId, parseInt(since));
      }
      
      // Set up heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
            timestamp: Date.now(),
          })}\n\n`;
          
          controller.enqueue(encoder.encode(heartbeat));
        } catch (error) {
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }, 30000); // 30 second heartbeat
      
      // Set up event listener for new events
      const eventListener = setInterval(async () => {
        try {
          await sendRecentEvents(controller, encoder, userId);
        } catch (error) {
          clearInterval(eventListener);
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }, 1000); // Check for new events every second
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearInterval(eventListener);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

async function sendMissedEvents(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  userId: string,
  since: number
) {
  try {
    const eventStore = getEventStore();
    const missedEvents = await eventStore.getEventsSince(userId, since);
    
    for (const event of missedEvents) {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(encoder.encode(eventData));
    }
  } catch (error) {
    console.error('Error sending missed events:', error);
  }
}

async function sendRecentEvents(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  userId: string
) {
  try {
    const eventStore = getEventStore();
    const recentEvents = await eventStore.getLatestEvents(userId, 5);
    
    // Only send events from the last few seconds to avoid duplicates
    const cutoff = Date.now() - 5000; // 5 seconds ago
    const newEvents = recentEvents.filter(event => event.timestamp > cutoff);
    
    for (const event of newEvents) {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(encoder.encode(eventData));
    }
  } catch (error) {
    console.error('Error sending recent events:', error);
  }
}

export const runtime = 'nodejs';