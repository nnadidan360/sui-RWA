/**
 * Event Store for Real-time Updates
 * Stub implementation for build compatibility
 */

export interface RealtimeEvent {
  id: string;
  userId: string;
  type: string;
  data: any;
  timestamp: number;
}

class EventStore {
  private events: RealtimeEvent[] = [];

  async getEventsSince(userId: string, since: number): Promise<RealtimeEvent[]> {
    return this.events.filter(
      event => event.userId === userId && event.timestamp > since
    );
  }

  async getLatestEvents(userId: string, limit: number = 50): Promise<RealtimeEvent[]> {
    return this.events
      .filter(event => event.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async addEvent(event: Omit<RealtimeEvent, 'id' | 'timestamp'>): Promise<void> {
    const newEvent: RealtimeEvent = {
      ...event,
      id: Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };
    
    this.events.push(newEvent);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  async clearEvents(userId: string): Promise<void> {
    this.events = this.events.filter(event => event.userId !== userId);
  }
}

let eventStoreInstance: EventStore | null = null;

export function getEventStore(): EventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new EventStore();
  }
  return eventStoreInstance;
}