/**
 * Event Store for Real-time Updates - Backend Implementation
 * 
 * Manages real-time events with persistence and efficient querying
 */

import { logger } from '../../utils/logger';

export interface RealtimeEvent {
  id: string;
  userId: string;
  type: string;
  data: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EventFilter {
  userId?: string;
  type?: string;
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  recentEvents: number;
}

export class EventStore {
  private events: RealtimeEvent[] = [];
  private eventsByUser: Map<string, RealtimeEvent[]> = new Map();
  private eventsByType: Map<string, RealtimeEvent[]> = new Map();
  private maxEvents: number = 10000; // Maximum events to keep in memory

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
    logger.info('Event Store initialized', { maxEvents });
  }

  /**
   * Add a new event to the store
   */
  async addEvent(event: Omit<RealtimeEvent, 'id' | 'timestamp'>): Promise<RealtimeEvent> {
    try {
      const newEvent: RealtimeEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
      };
      
      // Add to main events array
      this.events.push(newEvent);
      
      // Add to user index
      if (!this.eventsByUser.has(event.userId)) {
        this.eventsByUser.set(event.userId, []);
      }
      this.eventsByUser.get(event.userId)!.push(newEvent);
      
      // Add to type index
      if (!this.eventsByType.has(event.type)) {
        this.eventsByType.set(event.type, []);
      }
      this.eventsByType.get(event.type)!.push(newEvent);
      
      // Cleanup old events if necessary
      this.cleanupOldEvents();
      
      logger.debug('Event added to store', { 
        eventId: newEvent.id, 
        userId: event.userId, 
        type: event.type 
      });
      
      return newEvent;
    } catch (error) {
      logger.error('Failed to add event to store', { 
        error: (error as Error).message, 
        userId: event.userId, 
        type: event.type 
      });
      throw error;
    }
  }

  /**
   * Get events since a specific timestamp
   */
  async getEventsSince(userId: string, since: number): Promise<RealtimeEvent[]> {
    try {
      const userEvents = this.eventsByUser.get(userId) || [];
      const filteredEvents = userEvents.filter(event => event.timestamp > since);
      
      logger.debug('Retrieved events since timestamp', { 
        userId, 
        since, 
        eventCount: filteredEvents.length 
      });
      
      return filteredEvents;
    } catch (error) {
      logger.error('Failed to get events since timestamp', { 
        error: (error as Error).message, 
        userId, 
        since 
      });
      throw error;
    }
  }

  /**
   * Get latest events for a user
   */
  async getLatestEvents(userId: string, limit: number = 50): Promise<RealtimeEvent[]> {
    try {
      const userEvents = this.eventsByUser.get(userId) || [];
      const latestEvents = userEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      
      logger.debug('Retrieved latest events', { 
        userId, 
        limit, 
        eventCount: latestEvents.length 
      });
      
      return latestEvents;
    } catch (error) {
      logger.error('Failed to get latest events', { 
        error: (error as Error).message, 
        userId, 
        limit 
      });
      throw error;
    }
  }

  /**
   * Get events with advanced filtering
   */
  async getEvents(filter: EventFilter): Promise<RealtimeEvent[]> {
    try {
      let filteredEvents = this.events;

      // Filter by user
      if (filter.userId) {
        filteredEvents = this.eventsByUser.get(filter.userId) || [];
      }

      // Filter by type
      if (filter.type) {
        if (filter.userId) {
          // If already filtered by user, filter the user events by type
          filteredEvents = filteredEvents.filter(event => event.type === filter.type);
        } else {
          // If not filtered by user, use type index
          filteredEvents = this.eventsByType.get(filter.type) || [];
        }
      }

      // Filter by timestamp range
      if (filter.since) {
        filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.since!);
      }
      if (filter.until) {
        filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.until!);
      }

      // Sort by timestamp (newest first)
      filteredEvents = filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const offset = filter.offset || 0;
      const limit = filter.limit || 50;
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);

      logger.debug('Retrieved events with filter', { 
        filter, 
        totalMatched: filteredEvents.length,
        returned: paginatedEvents.length 
      });

      return paginatedEvents;
    } catch (error) {
      logger.error('Failed to get events with filter', { 
        error: (error as Error).message, 
        filter 
      });
      throw error;
    }
  }

  /**
   * Get events by type
   */
  async getEventsByType(type: string, limit: number = 100): Promise<RealtimeEvent[]> {
    try {
      const typeEvents = this.eventsByType.get(type) || [];
      const limitedEvents = typeEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      logger.debug('Retrieved events by type', { 
        type, 
        limit, 
        eventCount: limitedEvents.length 
      });

      return limitedEvents;
    } catch (error) {
      logger.error('Failed to get events by type', { 
        error: (error as Error).message, 
        type, 
        limit 
      });
      throw error;
    }
  }

  /**
   * Clear events for a specific user
   */
  async clearEvents(userId: string): Promise<void> {
    try {
      // Remove from user index
      const userEvents = this.eventsByUser.get(userId) || [];
      this.eventsByUser.delete(userId);

      // Remove from main events array
      this.events = this.events.filter(event => event.userId !== userId);

      // Remove from type indexes
      for (const event of userEvents) {
        const typeEvents = this.eventsByType.get(event.type);
        if (typeEvents) {
          const filteredTypeEvents = typeEvents.filter(e => e.id !== event.id);
          if (filteredTypeEvents.length === 0) {
            this.eventsByType.delete(event.type);
          } else {
            this.eventsByType.set(event.type, filteredTypeEvents);
          }
        }
      }

      logger.info('Cleared events for user', { 
        userId, 
        clearedCount: userEvents.length 
      });
    } catch (error) {
      logger.error('Failed to clear events for user', { 
        error: (error as Error).message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Clear all events
   */
  async clearAllEvents(): Promise<void> {
    try {
      const eventCount = this.events.length;
      
      this.events = [];
      this.eventsByUser.clear();
      this.eventsByType.clear();

      logger.info('Cleared all events', { clearedCount: eventCount });
    } catch (error) {
      logger.error('Failed to clear all events', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<EventStats> {
    try {
      const eventsByType: Record<string, number> = {};
      const eventsByUser: Record<string, number> = {};
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      for (const event of this.events) {
        // Count by type
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        
        // Count by user
        eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1;
      }

      const recentEvents = this.events.filter(event => event.timestamp > oneHourAgo).length;

      const stats: EventStats = {
        totalEvents: this.events.length,
        eventsByType,
        eventsByUser,
        recentEvents,
      };

      logger.debug('Generated event statistics', { stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get event statistics', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<RealtimeEvent | null> {
    try {
      const event = this.events.find(e => e.id === eventId);
      
      if (event) {
        logger.debug('Retrieved event by ID', { eventId });
      } else {
        logger.debug('Event not found by ID', { eventId });
      }

      return event || null;
    } catch (error) {
      logger.error('Failed to get event by ID', { 
        error: (error as Error).message, 
        eventId 
      });
      throw error;
    }
  }

  /**
   * Remove specific event
   */
  async removeEvent(eventId: string): Promise<boolean> {
    try {
      const eventIndex = this.events.findIndex(e => e.id === eventId);
      
      if (eventIndex === -1) {
        logger.debug('Event not found for removal', { eventId });
        return false;
      }

      const event = this.events[eventIndex];
      
      // Remove from main array
      this.events.splice(eventIndex, 1);
      
      // Remove from user index
      const userEvents = this.eventsByUser.get(event.userId);
      if (userEvents) {
        const userEventIndex = userEvents.findIndex(e => e.id === eventId);
        if (userEventIndex !== -1) {
          userEvents.splice(userEventIndex, 1);
          if (userEvents.length === 0) {
            this.eventsByUser.delete(event.userId);
          }
        }
      }
      
      // Remove from type index
      const typeEvents = this.eventsByType.get(event.type);
      if (typeEvents) {
        const typeEventIndex = typeEvents.findIndex(e => e.id === eventId);
        if (typeEventIndex !== -1) {
          typeEvents.splice(typeEventIndex, 1);
          if (typeEvents.length === 0) {
            this.eventsByType.delete(event.type);
          }
        }
      }

      logger.debug('Event removed', { eventId, userId: event.userId, type: event.type });
      return true;
    } catch (error) {
      logger.error('Failed to remove event', { 
        error: (error as Error).message, 
        eventId 
      });
      throw error;
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private cleanupOldEvents(): void {
    if (this.events.length <= this.maxEvents) {
      return;
    }

    // Sort events by timestamp and keep only the most recent ones
    this.events.sort((a, b) => b.timestamp - a.timestamp);
    const eventsToRemove = this.events.splice(this.maxEvents);

    // Clean up indexes
    for (const event of eventsToRemove) {
      // Remove from user index
      const userEvents = this.eventsByUser.get(event.userId);
      if (userEvents) {
        const filteredUserEvents = userEvents.filter(e => e.id !== event.id);
        if (filteredUserEvents.length === 0) {
          this.eventsByUser.delete(event.userId);
        } else {
          this.eventsByUser.set(event.userId, filteredUserEvents);
        }
      }

      // Remove from type index
      const typeEvents = this.eventsByType.get(event.type);
      if (typeEvents) {
        const filteredTypeEvents = typeEvents.filter(e => e.id !== event.id);
        if (filteredTypeEvents.length === 0) {
          this.eventsByType.delete(event.type);
        } else {
          this.eventsByType.set(event.type, filteredTypeEvents);
        }
      }
    }

    logger.info('Cleaned up old events', { 
      removedCount: eventsToRemove.length, 
      remainingCount: this.events.length 
    });
  }
}

let eventStoreInstance: EventStore | null = null;

export function getEventStore(): EventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new EventStore();
  }
  return eventStoreInstance;
}