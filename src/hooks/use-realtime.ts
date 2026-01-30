'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  RealtimeClient, 
  RealtimeEvent, 
  createRealtimeClient,
  EventHandler,
  ConnectionHealth 
} from '@/lib/realtime/realtime-client';

export interface UseRealtimeOptions {
  userId?: string;
  autoConnect?: boolean;
  sseEndpoint?: string;
  pollingEndpoint?: string;
  pollingInterval?: number;
}

export interface UseRealtimeReturn {
  client: RealtimeClient | null;
  isConnected: boolean;
  connectionHealth: ConnectionHealth | null;
  strategy: 'sse' | 'polling' | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
  emit: (eventType: string, data: any) => void;
  error: Error | null;
}

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    userId,
    autoConnect = true,
    sseEndpoint = '/api/realtime/sse',
    pollingEndpoint = '/api/realtime/poll',
    pollingInterval = 5000,
  } = options;

  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth | null>(null);
  const [strategy, setStrategy] = useState<'sse' | 'polling' | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Initialize client
  useEffect(() => {
    const realtimeClient = createRealtimeClient({
      sseEndpoint,
      pollingEndpoint,
      pollingInterval,
      maxRetries: 3,
      userId,
    });

    // Set up connection handler
    const unsubscribeConnection = realtimeClient.onConnection((connected) => {
      setIsConnected(connected);
      if (connected) {
        setError(null);
      }
    });

    // Set up error handler
    const unsubscribeError = realtimeClient.onError((err) => {
      setError(err);
    });

    // Monitor connection health
    const healthMonitor = setInterval(() => {
      const health = realtimeClient.getConnectionHealth();
      setConnectionHealth(health);
      setStrategy(realtimeClient.getCurrentStrategy());
    }, 1000);

    setClient(realtimeClient);

    // Auto-connect if enabled
    if (autoConnect) {
      realtimeClient.connect().catch(setError);
    }

    return () => {
      clearInterval(healthMonitor);
      unsubscribeConnection();
      unsubscribeError();
      
      // Clean up all subscriptions
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current.clear();
      
      realtimeClient.disconnect();
    };
  }, [userId, sseEndpoint, pollingEndpoint, pollingInterval, autoConnect]);

  const connect = useCallback(async () => {
    if (client) {
      try {
        await client.connect();
        setError(null);
      } catch (err) {
        setError(err as Error);
      }
    }
  }, [client]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
      setIsConnected(false);
    }
  }, [client]);

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    if (!client) {
      return () => {};
    }

    const unsubscribe = client.on(eventType, handler);
    const key = `${eventType}_${Date.now()}_${Math.random()}`;
    subscriptionsRef.current.set(key, unsubscribe);

    return () => {
      unsubscribe();
      subscriptionsRef.current.delete(key);
    };
  }, [client]);

  const emit = useCallback((eventType: string, data: any) => {
    // For emitting events, we would typically send them to a server endpoint
    // This is a placeholder for the emit functionality
    if (client && isConnected) {
      // In a real implementation, this would send the event to the server
      console.log('Emitting event:', { eventType, data });
    }
  }, [client, isConnected]);

  return {
    client,
    isConnected,
    connectionHealth,
    strategy,
    connect,
    disconnect,
    subscribe,
    emit,
    error,
  };
}

// Specialized hooks for different event types
export function useTransactionUpdates(userId?: string) {
  const { subscribe, isConnected } = useRealtime({ userId });
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('transaction_update', (event: RealtimeEvent) => {
      setTransactions(prev => {
        const updated = [...prev];
        const index = updated.findIndex(tx => tx.id === event.data.id);
        
        if (index >= 0) {
          updated[index] = { ...updated[index], ...event.data };
        } else {
          updated.push(event.data);
        }
        
        return updated;
      });
    });

    return unsubscribe;
  }, [subscribe]);

  return { transactions, isConnected };
}

export function useStakingUpdates(userId?: string) {
  const { subscribe, isConnected } = useRealtime({ userId });
  const [stakingEvents, setStakingEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('staking_update', (event: RealtimeEvent) => {
      setStakingEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events
    });

    return unsubscribe;
  }, [subscribe]);

  return { stakingEvents, isConnected };
}

export function useLendingUpdates(userId?: string) {
  const { subscribe, isConnected } = useRealtime({ userId });
  const [lendingEvents, setLendingEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('lending_update', (event: RealtimeEvent) => {
      setLendingEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events
    });

    return unsubscribe;
  }, [subscribe]);

  return { lendingEvents, isConnected };
}