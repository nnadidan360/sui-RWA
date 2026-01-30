/**
 * Property-Based Tests for Staked Token Collateral Valuation
 * 
 * **Feature: rwa-lending-protocol, Property 19: Staked token collateral valuation**
 * **Validates: Requirements 4.5**
 */

import * as fc from 'fast-check';

// Mock interfaces for staked token collateral valuation
interface StakedToken {
  tokenId: string;
  staker: string;
  stakedAmount: bigint;
  derivativeTokens: bigint;
  exchangeRate: bigint; // Scaled by 1e9 (e.g., 1.5 = 1500000000)
  createdAt: Date;
  status: 'active' | 'unbonding' | 'completed';
}

interface CollateralValuation {
  tokenId: string;
  tokenType: 'asset' | 'staked';
  originalAmount: bigint;
  currentValue: bigint;
  exchangeRate?: bigint;
  valuationTimestamp: Date;
}

interface LoanRequest {
  borrower: string;
  collateralTokens: string[];
  requestedAmount: bigint;
  collateralValuations: CollateralValuation[];
}

interface LoanApproval {
  approved: boolean;
  maxLoanAmount: bigint;
  collateralValue: bigint;
  loanToValueRatio: number;
  reason?: string;
}

// Mock staking protocol for exchange rate management
class MockStakingProtocol {
  private stakedTokens: Map<string, StakedToken> = new Map();
  private globalExchangeRate: bigint = BigInt('1000000000'); // 1.0 initial rate

  createStakedToken(
    tokenId: string,
    staker: string,
    stakedAmount: bigint
  ): StakedToken {
    const stakedToken: StakedToken = {
      tokenId,
      staker,
      stakedAmount,
      derivativeTokens: stakedAmount, // 1:1 initial ratio
      exchangeRate: this.globalExchangeRate,
      createdAt: new Date(),
      status: 'active'
    };
    
    this.stakedTokens.set(tokenId, stakedToken);
    return stakedToken;
  }

  updateGlobalExchangeRate(newRate: bigint): void {
    this.globalExchangeRate = newRate;
    
    // Update all active staked tokens with new exchange rate
    for (const [tokenId, token] of this.stakedTokens) {
      if (token.status === 'active') {
        token.exchangeRate = newRate;
      }
    }
  }

  getStakedToken(tokenId: string): StakedToken | undefined {
    const token = this.stakedTokens.get(tokenId);
    // Return the token as-is, let the caller check status
    return token;
  }

  getCurrentExchangeRate(): bigint {
    return this.globalExchangeRate;
  }

  // Calculate current value of staked tokens based on exchange rate
  calculateCurrentValue(stakedToken: StakedToken): bigint {
    // Current value = derivative tokens * exchange rate / 1e9
    return (stakedToken.derivativeTokens * stakedToken.exchangeRate) / BigInt('1000000000');
  }
}

// Mock lending protocol for collateral valuation
class MockLendingProtocol {
  private stakingProtocol: MockStakingProtocol;
  private loanToValueRatio: number = 0.75; // 75% LTV

  constructor(stakingProtocol: MockStakingProtocol) {
    this.stakingProtocol = stakingProtocol;
  }

  setLoanToValueRatio(ratio: number): void {
    // Ensure ratio is valid
    if (isNaN(ratio) || ratio <= 0 || ratio >= 1) {
      this.loanToValueRatio = 0.75; // Default fallback
    } else {
      this.loanToValueRatio = ratio;
    }
  }

  // Requirement 4.5: Accept staked tokens at current exchange rate value
  valuateCollateral(tokenId: string, tokenType: 'asset' | 'staked'): CollateralValuation | null {
    if (tokenType === 'staked') {
      const stakedToken = this.stakingProtocol.getStakedToken(tokenId);
      if (!stakedToken || stakedToken.status !== 'active') {
        return null;
      }

      const currentValue = this.stakingProtocol.calculateCurrentValue(stakedToken);
      
      return {
        tokenId,
        tokenType: 'staked',
        originalAmount: stakedToken.stakedAmount,
        currentValue,
        exchangeRate: stakedToken.exchangeRate,
        valuationTimestamp: new Date()
      };
    }
    
    // For asset tokens, use fixed valuation for testing
    return {
      tokenId,
      tokenType: 'asset',
      originalAmount: BigInt('50000000000'), // 50k
      currentValue: BigInt('50000000000'),
      valuationTimestamp: new Date()
    };
  }

  evaluateLoanRequest(request: LoanRequest): LoanApproval {
    let totalCollateralValue = BigInt('0');
    const valuations: CollateralValuation[] = [];

    // Valuate all collateral tokens
    for (const tokenId of request.collateralTokens) {
      // Determine token type (simplified - in real system would query token registry)
      const tokenType = tokenId.startsWith('staked_') ? 'staked' : 'asset';
      const valuation = this.valuateCollateral(tokenId, tokenType);
      
      if (!valuation) {
        return {
          approved: false,
          maxLoanAmount: BigInt('0'),
          collateralValue: BigInt('0'),
          loanToValueRatio: 0,
          reason: `Invalid collateral token: ${tokenId}`
        };
      }
      
      valuations.push(valuation);
      totalCollateralValue += valuation.currentValue;
    }

    // Calculate maximum loan amount based on LTV ratio
    const ltvBasisPoints = Math.floor(this.loanToValueRatio * 1000);
    if (isNaN(ltvBasisPoints) || ltvBasisPoints <= 0) {
      return {
        approved: false,
        maxLoanAmount: BigInt('0'),
        collateralValue: totalCollateralValue,
        loanToValueRatio: this.loanToValueRatio,
        reason: 'Invalid LTV ratio configuration'
      };
    }
    
    const maxLoanAmount = (totalCollateralValue * BigInt(ltvBasisPoints)) / BigInt('1000');
    
    const approved = request.requestedAmount <= maxLoanAmount;
    
    return {
      approved,
      maxLoanAmount,
      collateralValue: totalCollateralValue,
      loanToValueRatio: this.loanToValueRatio,
      reason: approved ? undefined : `Requested amount ${request.requestedAmount} exceeds maximum ${maxLoanAmount}`
    };
  }
}

// Property-based test generators
const tokenIdArb = fc.string({ minLength: 10, maxLength: 30 });
const userIdArb = fc.string({ minLength: 5, maxLength: 20 });
const amountArb = fc.bigInt({ min: BigInt('1000000000'), max: BigInt('1000000000000') }); // 1-1000 tokens
const exchangeRateArb = fc.bigInt({ min: BigInt('500000000'), max: BigInt('3000000000') }); // 0.5x to 3.0x
const ltvRatioArb = fc.float({ min: Math.fround(0.5), max: Math.fround(0.9) }); // 50% to 90% LTV

const stakedTokenArb = fc.record({
  tokenId: tokenIdArb,
  staker: userIdArb,
  stakedAmount: amountArb,
  derivativeTokens: amountArb,
  exchangeRate: exchangeRateArb,
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
  status: fc.constantFrom('active', 'unbonding', 'completed')
}) as fc.Arbitrary<StakedToken>;

describe('Staked Token Collateral Valuation Property Tests', () => {
  let stakingProtocol: MockStakingProtocol;
  let lendingProtocol: MockLendingProtocol;

  beforeEach(() => {
    stakingProtocol = new MockStakingProtocol();
    lendingProtocol = new MockLendingProtocol(stakingProtocol);
  });

  /**
   * Property 19: Staked token collateral valuation
   * For any staked tokens used as collateral, they should be valued 
   * at the current exchange rate in the lending protocol
   */
  test('Property 19: Staked tokens valued at current exchange rate', async () => {
    await fc.assert(fc.asyncProperty(
      stakedTokenArb,
      exchangeRateArb,
      async (stakedTokenData, newExchangeRate) => {
        // Only test active staked tokens
        if (stakedTokenData.status !== 'active') return;

        // Create staked token with initial exchange rate
        const stakedToken = stakingProtocol.createStakedToken(
          stakedTokenData.tokenId,
          stakedTokenData.staker,
          stakedTokenData.stakedAmount
        );

        // Update exchange rate to simulate rewards accumulation
        stakingProtocol.updateGlobalExchangeRate(newExchangeRate);

        // Valuate the staked token as collateral
        const valuation = lendingProtocol.valuateCollateral(stakedToken.tokenId, 'staked');

        expect(valuation).toBeDefined();
        expect(valuation!.tokenType).toBe('staked');
        expect(valuation!.tokenId).toBe(stakedToken.tokenId);
        expect(valuation!.exchangeRate).toBe(newExchangeRate);

        // Key requirement: Current value should reflect the current exchange rate
        const expectedValue = (stakedToken.derivativeTokens * newExchangeRate) / BigInt('1000000000');
        expect(valuation!.currentValue).toBe(expectedValue);

        // Valuation should be recent
        const valuationAge = Date.now() - valuation!.valuationTimestamp.getTime();
        expect(valuationAge).toBeLessThan(1000); // Less than 1 second old
      }
    ), { numRuns: 100 });
  });

  test('Property 19: Exchange rate changes affect collateral value immediately', async () => {
    await fc.assert(fc.asyncProperty(
      amountArb,
      exchangeRateArb,
      exchangeRateArb,
      async (stakedAmount, initialRate, newRate) => {
        // Skip if rates are too similar (less than 1% difference)
        const rateDiff = newRate > initialRate ? 
          (newRate - initialRate) * BigInt('100') / initialRate :
          (initialRate - newRate) * BigInt('100') / initialRate;
        if (rateDiff < BigInt('1')) return;

        const tokenId = `staked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const staker = 'test-staker';

        // Set initial exchange rate
        stakingProtocol.updateGlobalExchangeRate(initialRate);
        
        // Create staked token
        const stakedToken = stakingProtocol.createStakedToken(tokenId, staker, stakedAmount);

        // Get initial valuation
        const initialValuation = lendingProtocol.valuateCollateral(tokenId, 'staked');
        expect(initialValuation).toBeDefined();
        
        const initialValue = initialValuation!.currentValue;
        const expectedInitialValue = (stakedAmount * initialRate) / BigInt('1000000000');
        expect(initialValue).toBe(expectedInitialValue);

        // Update exchange rate
        stakingProtocol.updateGlobalExchangeRate(newRate);

        // Get new valuation - should immediately reflect new rate
        const newValuation = lendingProtocol.valuateCollateral(tokenId, 'staked');
        expect(newValuation).toBeDefined();
        
        const newValue = newValuation!.currentValue;
        const expectedNewValue = (stakedAmount * newRate) / BigInt('1000000000');
        expect(newValue).toBe(expectedNewValue);
        expect(newValuation!.exchangeRate).toBe(newRate);

        // Value should have changed proportionally to exchange rate change
        if (newRate > initialRate) {
          expect(newValue).toBeGreaterThan(initialValue);
        } else if (newRate < initialRate) {
          expect(newValue).toBeLessThan(initialValue);
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 19: Loan calculations use current staked token value', async () => {
    await fc.assert(fc.asyncProperty(
      amountArb,
      exchangeRateArb,
      ltvRatioArb,
      fc.bigInt({ min: BigInt('1000000000'), max: BigInt('100000000000') }),
      async (stakedAmount, exchangeRate, ltvRatio, requestedLoan) => {
        // Skip invalid inputs
        if (isNaN(ltvRatio) || ltvRatio <= 0 || ltvRatio >= 1) return;
        const tokenId = `staked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const borrower = 'test-borrower';

        // Set exchange rate and LTV ratio
        stakingProtocol.updateGlobalExchangeRate(exchangeRate);
        lendingProtocol.setLoanToValueRatio(ltvRatio);

        // Create staked token
        stakingProtocol.createStakedToken(tokenId, borrower, stakedAmount);

        // Create loan request using staked token as collateral
        const loanRequest: LoanRequest = {
          borrower,
          collateralTokens: [tokenId],
          requestedAmount: requestedLoan,
          collateralValuations: []
        };

        // Evaluate loan request
        const approval = lendingProtocol.evaluateLoanRequest(loanRequest);

        // Calculate expected values
        const expectedCollateralValue = (stakedAmount * exchangeRate) / BigInt('1000000000');
        const expectedMaxLoan = (expectedCollateralValue * BigInt(Math.floor(ltvRatio * 1000))) / BigInt('1000');

        // Verify collateral value uses current exchange rate
        expect(approval.collateralValue).toBe(expectedCollateralValue);
        expect(approval.maxLoanAmount).toBe(expectedMaxLoan);

        // Verify loan approval logic
        if (requestedLoan <= expectedMaxLoan) {
          expect(approval.approved).toBe(true);
          expect(approval.reason).toBeUndefined();
        } else {
          expect(approval.approved).toBe(false);
          expect(approval.reason).toContain('exceeds maximum');
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 19: Inactive staked tokens cannot be used as collateral', async () => {
    await fc.assert(fc.asyncProperty(
      stakedTokenArb,
      async (stakedTokenData) => {
        // Only test inactive tokens
        if (stakedTokenData.status === 'active') return;

        // Create a proper staked token ID
        const stakedTokenId = `staked_${stakedTokenData.tokenId}`;

        // Create staked token with initial exchange rate
        const stakedToken = stakingProtocol.createStakedToken(
          stakedTokenId,
          stakedTokenData.staker,
          stakedTokenData.stakedAmount
        );

        // Manually set status to inactive for testing
        stakedToken.status = stakedTokenData.status;

        // Skip if we accidentally made it active
        if (stakedToken.status === 'active') return;

        // Attempt to valuate inactive staked token
        const valuation = lendingProtocol.valuateCollateral(stakedToken.tokenId, 'staked');

        // Should return null for inactive tokens
        expect(valuation).toBeNull();

        // Loan request with inactive collateral should be rejected
        const loanRequest: LoanRequest = {
          borrower: stakedTokenData.staker,
          collateralTokens: [stakedToken.tokenId],
          requestedAmount: BigInt('1000000000'),
          collateralValuations: []
        };

        const approval = lendingProtocol.evaluateLoanRequest(loanRequest);
        expect(approval.approved).toBe(false);
        expect(approval.reason).toContain('Invalid collateral token');
      }
    ), { numRuns: 100 });
  });

  test('Property 19: Mixed collateral valuation accuracy', async () => {
    await fc.assert(fc.asyncProperty(
      amountArb,
      exchangeRateArb,
      ltvRatioArb,
      async (stakedAmount, exchangeRate, ltvRatio) => {
        // Skip invalid inputs
        if (isNaN(ltvRatio) || ltvRatio <= 0 || ltvRatio >= 1) return;
        const stakedTokenId = `staked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const assetTokenId = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const borrower = 'test-borrower';

        // Set up protocols
        stakingProtocol.updateGlobalExchangeRate(exchangeRate);
        lendingProtocol.setLoanToValueRatio(ltvRatio);

        // Create staked token
        stakingProtocol.createStakedToken(stakedTokenId, borrower, stakedAmount);

        // Create loan request with mixed collateral
        const loanRequest: LoanRequest = {
          borrower,
          collateralTokens: [stakedTokenId, assetTokenId],
          requestedAmount: BigInt('50000000000'), // 50 tokens
          collateralValuations: []
        };

        // Evaluate loan request
        const approval = lendingProtocol.evaluateLoanRequest(loanRequest);

        // Calculate expected values
        const expectedStakedValue = (stakedAmount * exchangeRate) / BigInt('1000000000');
        const expectedAssetValue = BigInt('50000000000'); // Fixed asset value
        const expectedTotalValue = expectedStakedValue + expectedAssetValue;
        const expectedMaxLoan = (expectedTotalValue * BigInt(Math.floor(ltvRatio * 1000))) / BigInt('1000');

        // Verify total collateral value includes staked token at current exchange rate
        expect(approval.collateralValue).toBe(expectedTotalValue);
        expect(approval.maxLoanAmount).toBe(expectedMaxLoan);

        // Verify staked token contributes its current value, not original amount
        if (exchangeRate !== BigInt('1000000000')) {
          // If exchange rate changed, staked value should differ from original amount
          expect(expectedStakedValue).not.toBe(stakedAmount);
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 19: Valuation timestamp accuracy', async () => {
    await fc.assert(fc.asyncProperty(
      amountArb,
      exchangeRateArb,
      async (stakedAmount, exchangeRate) => {
        const tokenId = `staked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const staker = 'test-staker';

        // Set exchange rate
        stakingProtocol.updateGlobalExchangeRate(exchangeRate);

        // Create staked token
        stakingProtocol.createStakedToken(tokenId, staker, stakedAmount);

        // Record time before valuation
        const beforeValuation = Date.now();

        // Get valuation
        const valuation = lendingProtocol.valuateCollateral(tokenId, 'staked');

        // Record time after valuation
        const afterValuation = Date.now();

        expect(valuation).toBeDefined();
        
        // Valuation timestamp should be between before and after times
        const valuationTime = valuation!.valuationTimestamp.getTime();
        expect(valuationTime).toBeGreaterThanOrEqual(beforeValuation);
        expect(valuationTime).toBeLessThanOrEqual(afterValuation);

        // Valuation should be very recent (within 100ms)
        const age = afterValuation - valuationTime;
        expect(age).toBeLessThan(100);
      }
    ), { numRuns: 100 });
  });
});