// PHASE 2: Property-Based Tests for Trading Settlement
// **Feature: credit-os, Property 18: Trading Settlement Integrity**
// **Validates: Requirements 14.2, 14.3**

import fc from 'fast-check';

// Trading fee in basis points (0.25%)
const TRADING_FEE_BPS = 25;

interface Order {
  orderId: string;
  trader: string;
  orderType: 'buy' | 'sell';
  price: number;
  amount: number;
  filled: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
}

interface Trade {
  buyOrderId: string;
  sellOrderId: string;
  buyer: string;
  seller: string;
  price: number;
  amount: number;
  fee: number;
}

// Calculate trading fee
function calculateTradingFee(tradeValue: number): number {
  return Math.floor((tradeValue * TRADING_FEE_BPS) / 10000);
}

// Execute a trade between buy and sell orders
function executeTrade(
  buyOrder: Order,
  sellOrder: Order,
  tradeAmount: number
): { trade: Trade; updatedBuyOrder: Order; updatedSellOrder: Order } {
  // Validate trade amount
  if (tradeAmount > buyOrder.amount - buyOrder.filled) {
    throw new Error('Trade amount exceeds buy order remaining');
  }
  if (tradeAmount > sellOrder.amount - sellOrder.filled) {
    throw new Error('Trade amount exceeds sell order remaining');
  }

  // Prevent self-trading
  if (buyOrder.trader === sellOrder.trader) {
    throw new Error('Self-trading not allowed');
  }

  // Use sell order price (price improvement for buyer if buy price is higher)
  const tradePrice = sellOrder.price;
  const tradeValue = tradePrice * tradeAmount;
  const fee = calculateTradingFee(tradeValue);

  // Update orders
  const updatedBuyOrder: Order = {
    ...buyOrder,
    filled: buyOrder.filled + tradeAmount,
    status: buyOrder.filled + tradeAmount === buyOrder.amount ? 'filled' : 'partial'
  };

  const updatedSellOrder: Order = {
    ...sellOrder,
    filled: sellOrder.filled + tradeAmount,
    status: sellOrder.filled + tradeAmount === sellOrder.amount ? 'filled' : 'partial'
  };

  const trade: Trade = {
    buyOrderId: buyOrder.orderId,
    sellOrderId: sellOrder.orderId,
    buyer: buyOrder.trader,
    seller: sellOrder.trader,
    price: tradePrice,
    amount: tradeAmount,
    fee
  };

  return { trade, updatedBuyOrder, updatedSellOrder };
}

describe('Trading Settlement Integrity Properties', () => {
  /**
   * Property 18: Trading Settlement Integrity
   * For any trade execution, token conservation must be maintained, fees must be
   * correctly calculated, and order fills must be accurate without exceeding limits.
   */

  describe('Property 18.1: Token conservation in trades', () => {
    it('should ensure tokens transferred equal tokens received', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 10000 }), // buyAmount
          fc.integer({ min: 100, max: 10000 }), // sellAmount
          fc.integer({ min: 1000, max: 100000 }), // price
          async (buyAmount, sellAmount, price) => {
            const tradeAmount = Math.min(buyAmount, sellAmount);

            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer-address',
              orderType: 'buy',
              price,
              amount: buyAmount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller-address',
              orderType: 'sell',
              price,
              amount: sellAmount,
              filled: 0,
              status: 'open'
            };

            const { trade, updatedBuyOrder, updatedSellOrder } = executeTrade(
              buyOrder,
              sellOrder,
              tradeAmount
            );

            // Token conservation: amount traded should match on both sides
            expect(trade.amount).toBe(tradeAmount);
            expect(updatedBuyOrder.filled).toBe(tradeAmount);
            expect(updatedSellOrder.filled).toBe(tradeAmount);

            // Buyer receives exactly what seller loses
            expect(updatedBuyOrder.filled - buyOrder.filled).toBe(
              updatedSellOrder.filled - sellOrder.filled
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.2: Fee calculation accuracy', () => {
    it('should calculate fees correctly as 0.25% of trade value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // amount
          fc.integer({ min: 100, max: 1000000 }), // price
          async (amount, price) => {
            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller',
              orderType: 'sell',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            const { trade } = executeTrade(buyOrder, sellOrder, amount);

            const tradeValue = price * amount;
            const expectedFee = Math.floor((tradeValue * TRADING_FEE_BPS) / 10000);

            // Fee should be exactly 0.25% of trade value
            expect(trade.fee).toBe(expectedFee);

            // Fee should be non-negative
            expect(trade.fee).toBeGreaterThanOrEqual(0);

            // Fee should be less than trade value
            expect(trade.fee).toBeLessThan(tradeValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.3: Order fill limits are respected', () => {
    it('should never fill more than the order amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }), // orderAmount
          fc.integer({ min: 0, max: 4000 }), // alreadyFilled
          fc.integer({ min: 1, max: 2000 }), // tradeAmount
          fc.integer({ min: 1000, max: 50000 }), // price
          async (orderAmount, alreadyFilled, tradeAmount, price) => {
            // Ensure alreadyFilled doesn't exceed orderAmount
            const filled = Math.min(alreadyFilled, orderAmount - 1);
            const remaining = orderAmount - filled;

            // Only attempt trade if there's remaining capacity
            if (remaining <= 0) return;

            const actualTradeAmount = Math.min(tradeAmount, remaining);

            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price,
              amount: orderAmount,
              filled,
              status: filled > 0 ? 'partial' : 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller',
              orderType: 'sell',
              price,
              amount: orderAmount,
              filled: 0,
              status: 'open'
            };

            const { updatedBuyOrder, updatedSellOrder } = executeTrade(
              buyOrder,
              sellOrder,
              actualTradeAmount
            );

            // Buy order filled should never exceed amount
            expect(updatedBuyOrder.filled).toBeLessThanOrEqual(updatedBuyOrder.amount);

            // Sell order filled should never exceed amount
            expect(updatedSellOrder.filled).toBeLessThanOrEqual(updatedSellOrder.amount);

            // Filled amount should increase by exactly trade amount
            expect(updatedBuyOrder.filled).toBe(filled + actualTradeAmount);
            expect(updatedSellOrder.filled).toBe(actualTradeAmount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.4: Self-trading prevention', () => {
    it('should reject trades where buyer and seller are the same', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }), // trader address
          fc.integer({ min: 1, max: 1000 }), // amount
          fc.integer({ min: 100, max: 10000 }), // price
          async (traderAddress, amount, price) => {
            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: traderAddress,
              orderType: 'buy',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: traderAddress, // Same trader
              orderType: 'sell',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            // Should throw error for self-trading
            expect(() => executeTrade(buyOrder, sellOrder, amount)).toThrow('Self-trading not allowed');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18.5: Price execution follows order book rules', () => {
    it('should use sell order price for execution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }), // buyPrice
          fc.integer({ min: 500, max: 9000 }), // sellPrice (can be lower)
          fc.integer({ min: 1, max: 1000 }), // amount
          async (buyPrice, sellPrice, amount) => {
            // Only test when buy price >= sell price (valid market condition)
            if (buyPrice < sellPrice) return;

            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price: buyPrice,
              amount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller',
              orderType: 'sell',
              price: sellPrice,
              amount,
              filled: 0,
              status: 'open'
            };

            const { trade } = executeTrade(buyOrder, sellOrder, amount);

            // Trade should execute at sell order price (price improvement for buyer)
            expect(trade.price).toBe(sellPrice);

            // Trade price should not exceed buy order price
            expect(trade.price).toBeLessThanOrEqual(buyPrice);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.6: Order status updates correctly', () => {
    it('should update order status based on fill completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }), // orderAmount
          fc.integer({ min: 1, max: 100 }), // tradeAmount
          fc.integer({ min: 1000, max: 50000 }), // price
          async (orderAmount, tradeAmount, price) => {
            const actualTradeAmount = Math.min(tradeAmount, orderAmount);

            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price,
              amount: orderAmount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller',
              orderType: 'sell',
              price,
              amount: orderAmount,
              filled: 0,
              status: 'open'
            };

            const { updatedBuyOrder, updatedSellOrder } = executeTrade(
              buyOrder,
              sellOrder,
              actualTradeAmount
            );

            // If fully filled, status should be 'filled'
            if (updatedBuyOrder.filled === updatedBuyOrder.amount) {
              expect(updatedBuyOrder.status).toBe('filled');
            } else {
              // Otherwise, should be 'partial'
              expect(updatedBuyOrder.status).toBe('partial');
            }

            if (updatedSellOrder.filled === updatedSellOrder.amount) {
              expect(updatedSellOrder.status).toBe('filled');
            } else {
              expect(updatedSellOrder.status).toBe('partial');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.7: Multiple trades preserve conservation', () => {
    it('should maintain token conservation across multiple sequential trades', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }), // totalAmount
          fc.array(fc.integer({ min: 10, max: 500 }), { minLength: 2, maxLength: 10 }), // trade amounts
          fc.integer({ min: 1000, max: 50000 }), // price
          async (totalAmount, tradeAmounts, price) => {
            let buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price,
              amount: totalAmount,
              filled: 0,
              status: 'open'
            };

            let totalFilled = 0;
            let totalFees = 0;

            // Execute multiple trades
            for (const tradeAmount of tradeAmounts) {
              const remaining = totalAmount - totalFilled;
              if (remaining <= 0) break;

              const actualTradeAmount = Math.min(tradeAmount, remaining);

              const sellOrder: Order = {
                orderId: `sell-${totalFilled}`,
                trader: `seller-${totalFilled}`,
                orderType: 'sell',
                price,
                amount: actualTradeAmount,
                filled: 0,
                status: 'open'
              };

              const { trade, updatedBuyOrder } = executeTrade(
                buyOrder,
                sellOrder,
                actualTradeAmount
              );

              totalFilled += trade.amount;
              totalFees += trade.fee;
              buyOrder = updatedBuyOrder;
            }

            // Total filled should equal sum of all trades
            expect(buyOrder.filled).toBe(totalFilled);

            // Total filled should never exceed order amount
            expect(totalFilled).toBeLessThanOrEqual(totalAmount);

            // All fees should be non-negative
            expect(totalFees).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18.8: Trade value calculation is consistent', () => {
    it('should calculate trade value consistently as price * amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // amount
          fc.integer({ min: 100, max: 1000000 }), // price
          async (amount, price) => {
            const buyOrder: Order = {
              orderId: 'buy-1',
              trader: 'buyer',
              orderType: 'buy',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            const sellOrder: Order = {
              orderId: 'sell-1',
              trader: 'seller',
              orderType: 'sell',
              price,
              amount,
              filled: 0,
              status: 'open'
            };

            const { trade } = executeTrade(buyOrder, sellOrder, amount);

            const expectedTradeValue = trade.price * trade.amount;
            const expectedFee = Math.floor((expectedTradeValue * TRADING_FEE_BPS) / 10000);

            // Fee should be calculated from consistent trade value
            expect(trade.fee).toBe(expectedFee);

            // Trade value should be deterministic
            const recalculatedValue = trade.price * trade.amount;
            expect(recalculatedValue).toBe(expectedTradeValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
