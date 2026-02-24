/**
 * Property-Based Test: Automated Liquidation Execution
 * **Feature: credit-os, Property 5: Automated Liquidation Execution**
 * 
 * Tests that for any crypto vault where health factor drops below 1.0, liquidation 
 * should execute automatically without human intervention and return excess funds.
 * 
 * Validates: Requirements 3.4, 8.1, 8.2
 */

import fc from 'fast-check';
import { LiquidationService } from '../../src/services/crypto/liquidation-service';
import { PriceFeedService } from '../../src/services/crypto/price-feed-service';
import { CryptoVault } from '../../src/models/CryptoVault';
import { LiquidationEvent } from '../../src/models/LiquidationEvent';
import { connectTestDB, disconnectTestDB } from '../helpers/test-db';

describe('Property 5: Automated Liquidation Execution', () => {
  let liquidationService: LiquidationService;
  let priceFeedService: PriceFeedService;

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
    await LiquidationEvent.deleteMany({});
  });

  // Generator for crypto assets
  const cryptoAssetArbitrary = fc.constantFrom('SUI', 'BTC', 'ETH', 'USDC', 'SOL');

  // Generator for vault with unhealthy position
  const unhealthyVaultArbitrary = fc.record({
    vaultId: fc.uuid(),
    userId: fc.uuid(),
    assetType: cryptoAssetArbitrary,
    depositedAmount: fc.double({ min: 1, max: 100, noNaN: true }),
    initialPrice: fc.double({ min: 10, max: 1000, noNaN: true })
  }).chain(vault => {
    // Calculate borrowed amount that will trigger liquidation
    const maxLTV = 0.30; // 30% LTV
    const liquidationLTV = 0.60; // 60% triggers liquidation
    const initialValue = vault.depositedAmount * vault.initialPrice;
    const borrowedAmount = initialValue * maxLTV;
    
    // Price drop that triggers liquidation (health factor < 1.0)
    const priceDropFactor = fc.double({ min: 0.4, max: 0.6, noNaN: true });
    
    return fc.constant({
      ...vault,
      borrowedAmount,
      currentPrice: vault.initialPrice * priceDropFactor,
      initialValue,
      maxLTV,
      liquidationLTV
    });
  });

  it('Property 5.1: Liquidation should execute automatically when health factor < 1.0', async () => {
    await fc.assert(
      fc.asyncProperty(
        unhealthyVaultArbitrary,
        async (vaultData) => {
          // Arrange: Create vault with unhealthy position
          const vault = await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * vaultData.currentPrice,
            maxLTV: vaultData.maxLTV,
            liquidationLTV: vaultData.liquidationLTV
          });

          // Calculate health factor
          const currentValue = vaultData.depositedAmount * vaultData.currentPrice;
          const healthFactor = (currentValue * vaultData.liquidationLTV) / vaultData.borrowedAmount;

          // Ensure health factor is below 1.0
          fc.pre(healthFactor < 1.0);

          // Act: Trigger liquidation check
          const liquidationResult = await liquidationService.checkAndExecuteLiquidation(
            vaultData.vaultId,
            { price: vaultData.currentPrice, validated: true }
          );

          // Assert: Liquidation should execute automatically
          expect(liquidationResult.executed).toBe(true);
          expect(liquidationResult.healthFactor).toBeLessThan(1.0);
          expect(liquidationResult.liquidationId).toBeDefined();
          expect(liquidationResult.humanInterventionRequired).toBe(false);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});

  it('Property 5.2: Excess funds should be returned to borrower after liquidation', async () => {
    await fc.assert(
      fc.asyncProperty(
        unhealthyVaultArbitrary,
        async (vaultData) => {
          // Arrange: Create vault
          const vault = await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * vaultData.currentPrice,
            maxLTV: vaultData.maxLTV,
            liquidationLTV: vaultData.liquidationLTV
          });

          const currentValue = vaultData.depositedAmount * vaultData.currentPrice;
          const healthFactor = (currentValue * vaultData.liquidationLTV) / vaultData.borrowedAmount;
          fc.pre(healthFactor < 1.0);

          // Act: Execute liquidation
          const liquidationResult = await liquidationService.executeLiquidation(
            vaultData.vaultId,
            { price: vaultData.currentPrice, validated: true }
          );

          // Assert: Excess funds should be calculated and returned
          expect(liquidationResult.executed).toBe(true);
          expect(liquidationResult.collateralSeized).toBeDefined();
          expect(liquidationResult.debtRepaid).toBe(vaultData.borrowedAmount);
          
          if (currentValue > vaultData.borrowedAmount) {
            expect(liquidationResult.excessReturned).toBeGreaterThan(0);
            expect(liquidationResult.excessReturned).toBe(
              currentValue - vaultData.borrowedAmount
            );
          } else {
            expect(liquidationResult.excessReturned).toBe(0);
          }
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 5.3: Liquidation event should be recorded on-chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        unhealthyVaultArbitrary,
        async (vaultData) => {
          // Arrange: Create vault
          await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * vaultData.currentPrice,
            maxLTV: vaultData.maxLTV,
            liquidationLTV: vaultData.liquidationLTV
          });

          const currentValue = vaultData.depositedAmount * vaultData.currentPrice;
          const healthFactor = (currentValue * vaultData.liquidationLTV) / vaultData.borrowedAmount;
          fc.pre(healthFactor < 1.0);

          // Act: Execute liquidation
          const liquidationResult = await liquidationService.executeLiquidation(
            vaultData.vaultId,
            { price: vaultData.currentPrice, validated: true }
          );

          // Assert: Event should be recorded
          expect(liquidationResult.executed).toBe(true);
          
          const liquidationEvent = await LiquidationEvent.findOne({
            vaultId: vaultData.vaultId
          });
          
          expect(liquidationEvent).toBeDefined();
          expect(liquidationEvent!.liquidationId).toBe(liquidationResult.liquidationId);
          expect(liquidationEvent!.eventHash).toBeDefined();
          expect(liquidationEvent!.eventHash).toMatch(/^0x[a-f0-9]{64}$/i);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 5.4: Collateral should be seized completely during liquidation', async () => {
    await fc.assert(
      fc.asyncProperty(
        unhealthyVaultArbitrary,
        async (vaultData) => {
          // Arrange: Create vault
          await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * vaultData.currentPrice,
            maxLTV: vaultData.maxLTV,
            liquidationLTV: vaultData.liquidationLTV
          });

          const currentValue = vaultData.depositedAmount * vaultData.currentPrice;
          const healthFactor = (currentValue * vaultData.liquidationLTV) / vaultData.borrowedAmount;
          fc.pre(healthFactor < 1.0);

          // Act: Execute liquidation
          const liquidationResult = await liquidationService.executeLiquidation(
            vaultData.vaultId,
            { price: vaultData.currentPrice, validated: true }
          );

          // Assert: All collateral should be seized
          expect(liquidationResult.executed).toBe(true);
          expect(liquidationResult.collateralSeized).toBe(vaultData.depositedAmount);
          
          // Verify vault is liquidated
          const updatedVault = await CryptoVault.findOne({ vaultId: vaultData.vaultId });
          expect(updatedVault!.status).toBe('liquidated');
          expect(updatedVault!.depositedAmount).toBe(0);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 5.5: Liquidation should work without human intervention', async () => {
    await fc.assert(
      fc.asyncProperty(
        unhealthyVaultArbitrary,
        async (vaultData) => {
          // Arrange: Create vault
          await CryptoVault.create({
            vaultId: vaultData.vaultId,
            userId: vaultData.userId,
            assetType: vaultData.assetType,
            depositedAmount: vaultData.depositedAmount,
            borrowedAmount: vaultData.borrowedAmount,
            currentValue: vaultData.depositedAmount * vaultData.currentPrice,
            maxLTV: vaultData.maxLTV,
            liquidationLTV: vaultData.liquidationLTV
          });

          const currentValue = vaultData.depositedAmount * vaultData.currentPrice;
          const healthFactor = (currentValue * vaultData.liquidationLTV) / vaultData.borrowedAmount;
          fc.pre(healthFactor < 1.0);

          // Act: Execute liquidation (automated)
          const startTime = Date.now();
          const liquidationResult = await liquidationService.executeLiquidation(
            vaultData.vaultId,
            { price: vaultData.currentPrice, validated: true }
          );
          const executionTime = Date.now() - startTime;

          // Assert: Should execute quickly without human intervention
          expect(liquidationResult.executed).toBe(true);
          expect(liquidationResult.humanInterventionRequired).toBe(false);
          expect(liquidationResult.approvalRequired).toBe(false);
          expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});
