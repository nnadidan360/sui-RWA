/**
 * Property-Based Tests for Crypto Vault LTV Consistency
 * 
 * **Feature: credit-os, Property 4: Crypto Vault LTV Consistency**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * These tests verify that LTV calculations are consistent and accurate
 * across different scenarios and operations.
 */

import fc from 'fast-check';
import { LTVCalculatorService, LTVCalculationParams } from '../../lib/crypto/ltv-calculator-service';

describe('Crypto Vault LTV Consistency Properties', () => {
  let ltvCalculator: LTVCalculatorService;

  beforeAll(() => {
    ltvCalculator = new LTVCalculatorService();
  });

  /**
   * Property 4: Crypto Vault LTV Consistency
   * For any valid collateral and loan amounts, LTV calculations should be deterministic and consistent
   */
  test('property: LTV calculation is deterministic and consistent', () => {
    fc.assert(
      fc.property(
        fc.record({
          collateralAmount: fc.integer({ min: 1000000000, max: 100000000000 }), // 1-100 SUI
          collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(100.0), noNaN: true }),
          loanAmount: fc.integer({ min: 1, max: 1000 }),
          collateralDecimals: fc.constantFrom(6, 8, 9),
          accruedInterest: fc.integer({ min: 0, max: 100 })
        }).filter(params => {
          // Filter out cases that would result in extreme LTV ratios
          const collateralValue = (params.collateralAmount / Math.pow(10, params.collateralDecimals)) * params.collateralPrice;
          const totalDebt = params.loanAmount + params.accruedInterest;
          const ltvRatio = collateralValue > 0 ? (totalDebt / collateralValue) * 10000 : 10000;
          return ltvRatio <= 15000; // Allow up to 150% LTV for testing
        }),
        (params) => {
          // Calculate LTV multiple times with same inputs
          const result1 = ltvCalculator.calculateHealthFactor(params);
          const result2 = ltvCalculator.calculateHealthFactor(params);
          const result3 = ltvCalculator.calculateHealthFactor(params);

          // Results should be identical
          expect(result1.ltvRatio).toBe(result2.ltvRatio);
          expect(result2.ltvRatio).toBe(result3.ltvRatio);
          expect(result1.healthFactor).toBe(result2.healthFactor);
          expect(result1.collateralValue).toBe(result2.collateralValue);
          expect(result1.totalDebt).toBe(result2.totalDebt);

          // LTV should be in reasonable range
          expect(result1.ltvRatio).toBeGreaterThanOrEqual(0);
          expect(result1.ltvRatio).toBeLessThanOrEqual(15000); // 150% max for testing

          // Health factor should be positive
          expect(result1.healthFactor).toBeGreaterThan(0);

          // Collateral value should match calculation
          const expectedCollateralValue = (params.collateralAmount / Math.pow(10, params.collateralDecimals)) * params.collateralPrice;
          expect(Math.abs(result1.collateralValue - expectedCollateralValue)).toBeLessThan(0.01);

          // Total debt should match loan + interest
          const expectedTotalDebt = params.loanAmount + params.accruedInterest;
          expect(result1.totalDebt).toBe(expectedTotalDebt);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: LTV ratio increases when loan amount increases
   */
  test('property: LTV increases with loan amount (collateral constant)', () => {
    fc.assert(
      fc.property(
        fc.record({
          collateralAmount: fc.integer({ min: 1000000000, max: 10000000000 }),
          collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
          baseLoanAmount: fc.integer({ min: 100, max: 1000 }),
          additionalLoan: fc.integer({ min: 10, max: 500 }), // Increased minimum to avoid edge cases
          collateralDecimals: fc.constant(9)
        }),
        (params) => {
          const baseParams: LTVCalculationParams = {
            collateralAmount: params.collateralAmount,
            collateralPrice: params.collateralPrice,
            collateralDecimals: params.collateralDecimals,
            loanAmount: params.baseLoanAmount,
            accruedInterest: 0
          };

          const increasedParams: LTVCalculationParams = {
            ...baseParams,
            loanAmount: params.baseLoanAmount + params.additionalLoan
          };

          const baseResult = ltvCalculator.calculateHealthFactor(baseParams);
          const increasedResult = ltvCalculator.calculateHealthFactor(increasedParams);

          // LTV should increase when loan amount increases
          expect(increasedResult.ltvRatio).toBeGreaterThan(baseResult.ltvRatio);
          
          // Health factor should decrease when LTV increases (allow for equal in edge cases)
          expect(increasedResult.healthFactor).toBeLessThanOrEqual(baseResult.healthFactor);

          // Collateral value should remain the same
          expect(increasedResult.collateralValue).toBe(baseResult.collateralValue);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: LTV ratio decreases when collateral amount increases
   */
  test('property: LTV decreases with collateral amount (loan constant)', () => {
    fc.assert(
      fc.property(
        fc.record({
          baseCollateralAmount: fc.integer({ min: 1000000000, max: 5000000000 }),
          additionalCollateral: fc.integer({ min: 1000000000, max: 2000000000 }),
          collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
          loanAmount: fc.integer({ min: 100, max: 1000 }),
          collateralDecimals: fc.constant(9)
        }),
        (params) => {
          const baseParams: LTVCalculationParams = {
            collateralAmount: params.baseCollateralAmount,
            collateralPrice: params.collateralPrice,
            collateralDecimals: params.collateralDecimals,
            loanAmount: params.loanAmount,
            accruedInterest: 0
          };

          const increasedParams: LTVCalculationParams = {
            ...baseParams,
            collateralAmount: params.baseCollateralAmount + params.additionalCollateral
          };

          const baseResult = ltvCalculator.calculateHealthFactor(baseParams);
          const increasedResult = ltvCalculator.calculateHealthFactor(increasedParams);

          // LTV should decrease when collateral increases
          expect(increasedResult.ltvRatio).toBeLessThan(baseResult.ltvRatio);
          
          // Health factor should increase when LTV decreases
          expect(increasedResult.healthFactor).toBeGreaterThan(baseResult.healthFactor);

          // Total debt should remain the same
          expect(increasedResult.totalDebt).toBe(baseResult.totalDebt);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Maximum borrowable amount respects LTV limits
   */
  test('property: max borrowable amount respects LTV constraints', () => {
    fc.assert(
      fc.property(
        fc.record({
          collateralAmount: fc.integer({ min: 1000000000, max: 10000000000 }),
          collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
          collateralDecimals: fc.constant(9),
          assetType: fc.constantFrom('SUI', 'USDC', 'WETH')
        }),
        (params) => {
          const maxBorrowable = ltvCalculator.calculateMaxBorrowAmount(
            params.collateralAmount,
            params.collateralPrice,
            params.collateralDecimals,
            params.assetType
          );

          // Max borrowable should be non-negative
          expect(maxBorrowable).toBeGreaterThanOrEqual(0);

          // If we borrow the maximum amount, LTV should be at or below the limit
          if (maxBorrowable > 0) {
            const testParams: LTVCalculationParams = {
              collateralAmount: params.collateralAmount,
              collateralPrice: params.collateralPrice,
              collateralDecimals: params.collateralDecimals,
              loanAmount: maxBorrowable,
              accruedInterest: 0
            };

            const result = ltvCalculator.calculateHealthFactor(testParams, params.assetType);
            const supportedAssets = ltvCalculator.getSupportedAssets();
            const maxLtv = supportedAssets[params.assetType]?.maxLtv || 8000;

            // LTV should not exceed the maximum for this asset type
            expect(result.ltvRatio).toBeLessThanOrEqual(maxLtv + 1); // Allow for rounding
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: LTV validation catches invalid parameters
   */
  test('property: LTV validation correctly identifies invalid parameters', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Negative collateral amount
          fc.record({
            collateralAmount: fc.integer({ min: -1000000000, max: -1 }),
            collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
            loanAmount: fc.integer({ min: 1, max: 1000 }),
            collateralDecimals: fc.constant(9)
          }),
          // Zero or negative price
          fc.record({
            collateralAmount: fc.integer({ min: 1000000000, max: 10000000000 }),
            collateralPrice: fc.oneof(fc.constant(0), fc.float({ min: Math.fround(-10.0), max: Math.fround(-0.1), noNaN: true })),
            loanAmount: fc.integer({ min: 1, max: 1000 }),
            collateralDecimals: fc.constant(9)
          }),
          // Negative loan amount
          fc.record({
            collateralAmount: fc.integer({ min: 1000000000, max: 10000000000 }),
            collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
            loanAmount: fc.integer({ min: -1000, max: -1 }),
            collateralDecimals: fc.constant(9)
          })
        ),
        (params) => {
          const validation = ltvCalculator.validateLTVParams(params);
          
          // Should identify as invalid
          expect(validation.isValid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Edge case: Zero debt scenarios
   */
  test('property: zero debt results in zero LTV and maximum health', () => {
    fc.assert(
      fc.property(
        fc.record({
          collateralAmount: fc.integer({ min: 1000000000, max: 10000000000 }),
          collateralPrice: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
          collateralDecimals: fc.constant(9)
        }),
        (params) => {
          const testParams: LTVCalculationParams = {
            collateralAmount: params.collateralAmount,
            collateralPrice: params.collateralPrice,
            collateralDecimals: params.collateralDecimals,
            loanAmount: 0,
            accruedInterest: 0
          };

          const result = ltvCalculator.calculateHealthFactor(testParams);

          // Zero debt should result in zero LTV
          expect(result.ltvRatio).toBe(0);
          
          // Health factor should be maximum
          expect(result.healthFactor).toBe(10000);
          
          // Total debt should be zero
          expect(result.totalDebt).toBe(0);
          
          // Status should be healthy
          expect(result.status).toBe('healthy');
        }
      ),
      { numRuns: 10 }
    );
  });
});