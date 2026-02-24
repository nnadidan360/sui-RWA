/**
 * Property-Based Test: Price Feed Validation
 * **Feature: credit-os, Property 6: Price Feed Validation**
 * 
 * Tests that for any price update, the system validates off-chain aggregation 
 * on-chain before executing any liquidation logic.
 * 
 * Validates: Requirements 3.5, 8.3
 */

import fc from 'fast-check';
import { PriceFeedService } from '../../src/services/crypto/price-feed-service';
import { LiquidationService } from '../../src/services/crypto/liquidation-service';
import { CryptoVault } from '../../src/models/CryptoVault';
import { connectTestDB, disconnectTestDB } from '../helpers/test-db';

describe('Property 6: Price Feed Validation', () => {
  let priceFeedService: PriceFeedService;
  let liquidationService: LiquidationService;

  beforeAll(async () => {
    await connectTestDB();
    priceFeedService = new PriceFeedService();
    liquidationService = new LiquidationService(priceFeedService);
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await CryptoVault.deleteMany({});
  });

  // Generator for crypto assets
  const cryptoAssetArbitrary = fc.constantFrom(
    'SUI', 'BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'AVAX'
  );

  // Generator for price data
  const priceDataArbitrary = fc.record({
    asset: cryptoAssetArbitrary,
    price: fc.double({ min: 0.01, max: 100000, noNaN: true }),
    timestamp: fc.date({ min: new Date(Date.now() - 3600000), max: new Date() }),
    sources: fc.array(
      fc.record({
        name: fc.constantFrom('Binance', 'Coinbase', 'Kraken', 'Pyth', 'Chainlink'),
        price: fc.double({ min: 0.01, max: 100000, noNaN: true }),
        timestamp: fc.date({ min: new Date(Date.now() - 3600000), max: new Date() })
      }),
      { minLength: 3, maxLength: 5 }
    )
  });

  // Generator for vault data
  const vaultDataArbitrary = fc.record({
    vaultId: fc.uuid(),
    userId: fc.uuid(),
    assetType: cryptoAssetArbitrary,
    depositedAmount: fc.double({ min: 1, max: 1000, noNaN: true }),
    borrowedAmount: fc.double({ min: 0, max: 300, noNaN: true })
  });

  it('Property 6.1: Price updates should validate against multiple sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceDataArbitrary,
        async (priceData) => {
          // Act: Submit price update
          const validationResult = await priceFeedService.validatePriceUpdate(priceData);

          // Assert: Validation should check multiple sources
          expect(validationResult).toBeDefined();
          expect(validationResult.isValid).toBeDefined();
          expect(validationResult.sourcesChecked).toBeGreaterThanOrEqual(3);
          expect(validationResult.aggregatedPrice).toBeDefined();
          
          // Verify aggregation logic
          if (validationResult.isValid) {
            const prices = priceData.sources.map(s => s.price);
            const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
            const deviation = Math.abs(validationResult.aggregatedPrice - median) / median;
            expect(deviation).toBeLessThan(0.1); // Within 10% of median
          }
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.2: Liquidation should not execute without validated price', async () => {
    await fc.assert(
      fc.asyncProperty(
        vaultDataArbitrary,
        priceDataArbitrary,
        async (vaultData, priceData) => {
          // Arrange: Create vault
          const vault = await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * priceData.price
          });

          // Act: Attempt liquidation without price validation
          const liquidationAttempt = await liquidationService.attemptLiquidation(
            vaultData.vaultId,
            { price: priceData.price, validated: false }
          );

          // Assert: Liquidation should be rejected without validation
          expect(liquidationAttempt.executed).toBe(false);
          expect(liquidationAttempt.reason).toContain('price not validated');
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.3: Price validation should reject outlier sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        cryptoAssetArbitrary,
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (asset, basePrice) => {
          // Arrange: Create price data with one outlier
          const priceData = {
            asset,
            price: basePrice,
            timestamp: new Date(),
            sources: [
              { name: 'Binance', price: basePrice, timestamp: new Date() },
              { name: 'Coinbase', price: basePrice * 1.02, timestamp: new Date() },
              { name: 'Kraken', price: basePrice * 0.98, timestamp: new Date() },
              { name: 'Outlier', price: basePrice * 2.5, timestamp: new Date() } // 150% deviation
            ]
          };

          // Act: Validate price
          const validationResult = await priceFeedService.validatePriceUpdate(priceData);

          // Assert: Outlier should be rejected
          expect(validationResult.outlierSources).toBeDefined();
          expect(validationResult.outlierSources.length).toBeGreaterThan(0);
          expect(validationResult.outlierSources).toContain('Outlier');
          
          // Aggregated price should not include outlier
          const validPrices = priceData.sources
            .filter(s => !validationResult.outlierSources.includes(s.name))
            .map(s => s.price);
          const median = validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)];
          expect(Math.abs(validationResult.aggregatedPrice - median)).toBeLessThan(basePrice * 0.05);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.4: Stale prices should be rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceDataArbitrary,
        fc.integer({ min: 3600, max: 86400 }), // 1 hour to 1 day old
        async (priceData, ageInSeconds) => {
          // Arrange: Create stale price data
          const stalePriceData = {
            ...priceData,
            timestamp: new Date(Date.now() - ageInSeconds * 1000),
            sources: priceData.sources.map(s => ({
              ...s,
              timestamp: new Date(Date.now() - ageInSeconds * 1000)
            }))
          };

          // Act: Validate stale price
          const validationResult = await priceFeedService.validatePriceUpdate(stalePriceData);

          // Assert: Stale prices should be rejected
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.reason).toContain('stale');
          expect(validationResult.ageInSeconds).toBeGreaterThanOrEqual(ageInSeconds);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.5: Price validation should require minimum source count', async () => {
    await fc.assert(
      fc.asyncProperty(
        cryptoAssetArbitrary,
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.integer({ min: 1, max: 2 }),
        async (asset, price, sourceCount) => {
          // Arrange: Create price data with insufficient sources
          const priceData = {
            asset,
            price,
            timestamp: new Date(),
            sources: Array.from({ length: sourceCount }, (_, i) => ({
              name: `Source${i}`,
              price: price * (1 + (Math.random() - 0.5) * 0.02),
              timestamp: new Date()
            }))
          };

          // Act: Validate price
          const validationResult = await priceFeedService.validatePriceUpdate(priceData);

          // Assert: Should reject insufficient sources
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.reason).toContain('insufficient sources');
          expect(validationResult.sourcesChecked).toBeLessThan(3);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.6: On-chain validation should match off-chain aggregation', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceDataArbitrary,
        async (priceData) => {
          // Act: Perform off-chain aggregation
          const offChainResult = await priceFeedService.aggregatePrices(priceData);

          // Simulate on-chain validation
          const onChainResult = await priceFeedService.validateOnChain(
            priceData.asset,
            offChainResult.aggregatedPrice,
            offChainResult.sources
          );

          // Assert: On-chain and off-chain should match
          expect(onChainResult.validated).toBe(true);
          expect(Math.abs(onChainResult.price - offChainResult.aggregatedPrice))
            .toBeLessThan(0.01);
          expect(onChainResult.timestamp).toBeDefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.7: Price deviation threshold should prevent manipulation', async () => {
    await fc.assert(
      fc.asyncProperty(
        cryptoAssetArbitrary,
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.15, max: 0.5 }), // 15% to 50% deviation
        async (asset, basePrice, deviationFactor) => {
          // Arrange: Create price data with high deviation
          const priceData = {
            asset,
            price: basePrice,
            timestamp: new Date(),
            sources: [
              { name: 'Source1', price: basePrice, timestamp: new Date() },
              { name: 'Source2', price: basePrice * (1 + deviationFactor), timestamp: new Date() },
              { name: 'Source3', price: basePrice * (1 - deviationFactor), timestamp: new Date() },
              { name: 'Source4', price: basePrice * 1.02, timestamp: new Date() }
            ]
          };

          // Act: Validate price
          const validationResult = await priceFeedService.validatePriceUpdate(priceData);

          // Assert: High deviation should trigger warning or rejection
          if (deviationFactor > 0.2) {
            expect(validationResult.warning || !validationResult.isValid).toBe(true);
            expect(validationResult.maxDeviation).toBeGreaterThan(0.2);
          }
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 6.8: Validated prices should be cached with expiry', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceDataArbitrary,
        async (priceData) => {
          // Act: Validate and cache price
          const validationResult = await priceFeedService.validatePriceUpdate(priceData);

          if (validationResult.isValid) {
            // Retrieve cached price
            const cachedPrice = await priceFeedService.getCachedPrice(priceData.asset);

            // Assert: Cached price should match validated price
            expect(cachedPrice).toBeDefined();
            expect(cachedPrice!.price).toBe(validationResult.aggregatedPrice);
            expect(cachedPrice!.expiresAt).toBeInstanceOf(Date);
            expect(cachedPrice!.expiresAt.getTime()).toBeGreaterThan(Date.now());
          }
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});
