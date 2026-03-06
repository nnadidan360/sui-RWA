// PHASE 2: Property-Based Tests for Trading Fraud Detection
// **Feature: credit-os, Property 19: Trading Fraud Detection**
// **Validates: Requirements 14.5**

import fc from 'fast-check';

interface Trade {
  userId: string;
  tokenId: string;
  orderType: 'buy' | 'sell';
  price: number;
  amount: number;
  timestamp: number;
}

// Helper to detect wash trading pattern
function detectWashTradingPattern(trades: Trade[]): number {
  let roundTrips = 0;
  const userTrades = new Map<string, Trade[]>();

  for (const trade of trades) {
    if (!userTrades.has(trade.userId)) {
      userTrades.set(trade.userId, []);
    }
    userTrades.get(trade.userId)!.push(trade);
  }

  for (const [userId, userTradeList] of userTrades) {
    for (let i = 0; i < userTradeList.length - 1; i++) {
      const trade1 = userTradeList[i];
      const trade2 = userTradeList[i + 1];

      if (trade1.orderType !== trade2.orderType) {
        if (Math.abs(trade2.timestamp - trade1.timestamp) <= 300) {
          roundTrips++;
        }
      }
    }
  }

  return roundTrips;
}

// Helper to detect velocity manipulation
function detectVelocityManipulation(trades: Trade[], timeWindowSeconds: number = 3600): boolean {
  const VELOCITY_THRESHOLD = 20;
  
  if (trades.length === 0) return false;

  const latestTimestamp = Math.max(...trades.map(t => t.timestamp));
  const windowStart = latestTimestamp - timeWindowSeconds;
  
  const tradesInWindow = trades.filter(t => t.timestamp >= windowStart).length;
  
  return tradesInWindow > VELOCITY_THRESHOLD;
}

// Helper to detect price manipulation
function detectPriceManipulation(previousPrice: number, newPrice: number): boolean {
  const MIN_PRICE_MANIPULATION = 10;
  
  if (previousPrice === 0) return false;
  
  const priceChange = Math.abs((newPrice - previousPrice) / previousPrice) * 100;
  
  return priceChange > MIN_PRICE_MANIPULATION;
}

// Helper to detect coordinated trading
function detectCoordinatedTrading(trades: Trade[]): boolean {
  if (trades.length < 2) return false;

  const timeBuckets = new Map<number, Trade[]>();
  
  for (const trade of trades) {
    const bucket = Math.floor(trade.timestamp / 10) * 10;
    if (!timeBuckets.has(bucket)) {
      timeBuckets.set(bucket, []);
    }
    timeBuckets.get(bucket)!.push(trade);
  }

  for (const [bucket, bucketTrades] of timeBuckets) {
    const uniqueUsers = new Set(bucketTrades.map(t => t.userId));
    
    if (uniqueUsers.size >= 3 && bucketTrades.length >= 5) {
      return true;
    }
  }

  return false;
}

describe('Trading Fraud Detection Properties', () => {
  /**
   * Property 19: Trading Fraud Detection
   * The system should detect wash trading, velocity manipulation, price manipulation,
   * and coordinated trading patterns to prevent market manipulation.
   */

  describe('Property 19.1: Wash trading detection', () => {
    it('should detect round-trip trades within short time windows', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              orderType: fc.constantFrom('buy' as const, 'sell' as const),
              price: fc.integer({ min: 1000, max: 10000 }),
              amount: fc.integer({ min: 1, max: 100 }),
              timeDelta: fc.integer({ min: 0, max: 600 })
            }),
            { minLength: 2, maxLength: 20 }
          ),
          async (tradeData) => {
            const userId = 'test-user';
            const tokenId = 'test-token';
            let currentTime = 1000000;

            const trades: Trade[] = tradeData.map(data => {
              currentTime += data.timeDelta;
              return {
                userId,
                tokenId,
                orderType: data.orderType,
                price: data.price,
                amount: data.amount,
                timestamp: currentTime
              };
            });

            const roundTrips = detectWashTradingPattern(trades);

            if (roundTrips > 0) {
              let hasOppositePair = false;
              for (let i = 0; i < trades.length - 1; i++) {
                if (trades[i].orderType !== trades[i + 1].orderType) {
                  hasOppositePair = true;
                  break;
                }
              }
              expect(hasOppositePair).toBe(true);
            }

            expect(roundTrips).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19.2: Velocity manipulation detection', () => {
    it('should detect excessive trading frequency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 60, max: 7200 }),
          async (tradeCount, timeWindow) => {
            const trades: Trade[] = [];
            const baseTime = 1000000;

            for (let i = 0; i < tradeCount; i++) {
              trades.push({
                userId: 'test-user',
                tokenId: 'test-token',
                orderType: i % 2 === 0 ? 'buy' : 'sell',
                price: 1000,
                amount: 10,
                timestamp: baseTime + Math.floor((i / tradeCount) * timeWindow)
              });
            }

            const isManipulation = detectVelocityManipulation(trades, timeWindow);

            if (isManipulation) {
              expect(tradeCount).toBeGreaterThan(20);
            }

            if (tradeCount > 25) {
              expect(isManipulation).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19.3: Price manipulation detection', () => {
    it('should detect significant price changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }),
          fc.float({ min: 0.5, max: 2.0 }),
          async (previousPrice, multiplier) => {
            const newPrice = Math.floor(previousPrice * multiplier);
            
            const isManipulation = detectPriceManipulation(previousPrice, newPrice);

            const priceChange = Math.abs((newPrice - previousPrice) / previousPrice) * 100;

            if (priceChange > 10) {
              expect(isManipulation).toBe(true);
            }

            if (priceChange <= 10) {
              expect(isManipulation).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19.4: No false positives for legitimate trading', () => {
    it('should not flag normal trading patterns as fraudulent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 3600, max: 86400 }),
          async (tradeCount, timeSpread) => {
            const trades: Trade[] = [];
            const baseTime = 1000000;

            for (let i = 0; i < tradeCount; i++) {
              trades.push({
                userId: 'legitimate-user',
                tokenId: 'test-token',
                orderType: i % 2 === 0 ? 'buy' : 'sell',
                price: 1000 + (i * 10),
                amount: 10,
                timestamp: baseTime + (i * Math.floor(timeSpread / tradeCount))
              });
            }

            const isVelocityManipulation = detectVelocityManipulation(trades, 3600);
            
            if (tradeCount <= 10 && timeSpread >= 3600) {
              expect(isVelocityManipulation).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19.5: Detection is deterministic', () => {
    it('should produce consistent results for same input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              orderType: fc.constantFrom('buy' as const, 'sell' as const),
              price: fc.integer({ min: 1000, max: 10000 }),
              amount: fc.integer({ min: 1, max: 100 }),
              timestamp: fc.integer({ min: 1000000, max: 2000000 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (tradeData) => {
            const trades: Trade[] = tradeData.map(data => ({
              userId: 'test-user',
              tokenId: 'test-token',
              ...data
            }));

            const result1 = detectWashTradingPattern(trades);
            const result2 = detectWashTradingPattern(trades);

            expect(result1).toBe(result2);

            const velocity1 = detectVelocityManipulation(trades);
            const velocity2 = detectVelocityManipulation(trades);

            expect(velocity1).toBe(velocity2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19.6: Empty trade history has no fraud signals', () => {
    it('should not detect fraud in empty trade history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const emptyTrades: Trade[] = [];

            const washTrading = detectWashTradingPattern(emptyTrades);
            const velocityManipulation = detectVelocityManipulation(emptyTrades);
            const coordinated = detectCoordinatedTrading(emptyTrades);

            expect(washTrading).toBe(0);
            expect(velocityManipulation).toBe(false);
            expect(coordinated).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 19.7: Single trade cannot be wash trading', () => {
    it('should not detect wash trading with only one trade', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderType: fc.constantFrom('buy' as const, 'sell' as const),
            price: fc.integer({ min: 1000, max: 10000 }),
            amount: fc.integer({ min: 1, max: 100 })
          }),
          async (tradeData) => {
            const trade: Trade = {
              userId: 'test-user',
              tokenId: 'test-token',
              timestamp: 1000000,
              ...tradeData
            };

            const washTrading = detectWashTradingPattern([trade]);

            expect(washTrading).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
