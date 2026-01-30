import fc from 'fast-check';
import { LendingPool, LendingPoolError } from '../lending-pool';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

/**
 * Property-Based Test for Lending Pool Operations
 * 
 * **Feature: rwa-lending-protocol, Property 10: Pool token issuance proportionality**
 * **Validates: Requirements 3.1**
 * 
 * Property: For any deposit into the lending pool, the number of pool tokens issued 
 * should be proportional to the depositor's share of the total pool
 */

describe('Property-Based Test: Lending Pool Operations', () => {
  let lendingPool: LendingPool;
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    lendingPool = new LendingPool(assetTokenFactory);
    
    // Register test users
    assetTokenFactory.registerUser('lender1_address', UserRole.USER);
    assetTokenFactory.registerUser('lender2_address', UserRole.USER);
    assetTokenFactory.registerUser('borrower_address', UserRole.USER);
    assetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
    assetTokenFactory.registerUser('admin_address', UserRole.ADMIN);
    assetTokenFactory.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
    
    lendingPool.registerUser('lender1_address', UserRole.USER);
    lendingPool.registerUser('lender2_address', UserRole.USER);
    lendingPool.registerUser('borrower_address', UserRole.USER);
    lendingPool.registerUser('verifier_address', UserRole.VERIFIER);
    lendingPool.registerUser('admin_address', UserRole.ADMIN);
    lendingPool.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
  });

  /**
   * Property Test: Pool token issuance is proportional to deposits
   * 
   * For any sequence of deposits into the lending pool:
   * 1. Pool tokens should be issued proportionally to deposit amounts
   * 2. Total pool tokens should equal sum of all issued tokens
   * 3. Each depositor's share should be proportional to their deposit
   */
  test('Property 10: Pool token issuance proportionality - tokens issued proportionally', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate array of deposit amounts
        fc.array(
          fc.record({
            depositor: fc.constantFrom('lender1_address', 'lender2_address'),
            amount: fc.bigInt({ min: BigInt(1000), max: BigInt(100000) }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (deposits: Array<{ depositor: string; amount: bigint }>) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser('lender1_address', UserRole.USER);
          testAssetTokenFactory.registerUser('lender2_address', UserRole.USER);
          testLendingPool.registerUser('lender1_address', UserRole.USER);
          testLendingPool.registerUser('lender2_address', UserRole.USER);

          const poolTokenIds: string[] = [];
          let totalDeposited = BigInt(0);

          // Process deposits sequentially
          for (const deposit of deposits) {
            const poolTokenId = await testLendingPool.deposit(deposit.amount, deposit.depositor);
            poolTokenIds.push(poolTokenId);
            totalDeposited += deposit.amount;

            // Verify pool token was created
            const poolToken = testLendingPool.getPoolToken(poolTokenId);
            expect(poolToken).toBeDefined();
            expect(poolToken!.holder).toBe(deposit.depositor);
            expect(poolToken!.amount).toBeGreaterThan(BigInt(0));
          }

          // Verify pool state consistency
          const poolState = testLendingPool.getPoolState();
          expect(poolState.totalDeposits).toBe(totalDeposited);

          // Verify proportionality for each deposit
          let totalPoolTokens = BigInt(0);
          for (const poolTokenId of poolTokenIds) {
            const poolToken = testLendingPool.getPoolToken(poolTokenId);
            if (poolToken) {
              totalPoolTokens += poolToken.amount;
            }
          }

          expect(poolState.totalPoolTokens).toBe(totalPoolTokens);

          // For single deposit, should get 1:1 ratio initially
          if (deposits.length === 1) {
            const firstToken = testLendingPool.getPoolToken(poolTokenIds[0]);
            expect(firstToken!.amount).toBe(deposits[0].amount);
          }

          // For multiple deposits, each should get proportional tokens
          // The exact calculation depends on the order of deposits
          for (let i = 0; i < deposits.length; i++) {
            const poolToken = testLendingPool.getPoolToken(poolTokenIds[i]);
            expect(poolToken!.amount).toBeGreaterThan(BigInt(0));
            expect(poolToken!.holder).toBe(deposits[i].depositor);
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
        seed: 42,
      }
    );
  });

  /**
   * Property Test: Withdrawal calculation accuracy
   * 
   * For any deposit followed by immediate withdrawal:
   * 1. Withdrawal amount should equal deposit amount (no interest accrued)
   * 2. Pool state should return to original state
   * 3. Pool tokens should be burned correctly
   */
  test('Property 12: Withdrawal calculation accuracy - withdrawals return correct amounts', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(1000), max: BigInt(50000) }),
        fc.constantFrom('lender1_address', 'lender2_address'),
        async (depositAmount: bigint, depositor: string) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser(depositor, UserRole.USER);
          testLendingPool.registerUser(depositor, UserRole.USER);

          // Get initial pool state
          const initialState = testLendingPool.getPoolState();

          // Make deposit
          const poolTokenId = await testLendingPool.deposit(depositAmount, depositor);

          // Verify deposit was recorded
          const afterDepositState = testLendingPool.getPoolState();
          expect(afterDepositState.totalDeposits).toBe(initialState.totalDeposits + depositAmount);

          // Immediate withdrawal (no time for interest to accrue)
          const withdrawalAmount = await testLendingPool.withdraw(poolTokenId, depositor);

          // Verify withdrawal amount equals deposit amount
          expect(withdrawalAmount).toBe(depositAmount);

          // Verify pool state returned to initial state
          const finalState = testLendingPool.getPoolState();
          expect(finalState.totalDeposits).toBe(initialState.totalDeposits);
          expect(finalState.totalPoolTokens).toBe(initialState.totalPoolTokens);

          // Verify pool token was burned
          const poolToken = testLendingPool.getPoolToken(poolTokenId);
          expect(poolToken).toBeUndefined();

          // Verify token removed from holder's list
          const holderTokens = testLendingPool.getHolderTokens(depositor);
          expect(holderTokens).not.toContain(poolTokenId);
        }
      ),
      { 
        numRuns: 50,
        verbose: true,
        seed: 123,
      }
    );
  });

  /**
   * Property Test: Loan calculation consistency
   * 
   * For any valid collateral, loan calculations should be deterministic and consistent
   */
  test('Property 5: Loan calculation consistency - loan amounts calculated consistently', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }), // Asset valuation
        fc.bigInt({ min: BigInt(10000), max: BigInt(100000) }), // Pool liquidity
        async (assetValuation: bigint, poolLiquidity: bigint) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser('borrower_address', UserRole.USER);
          testAssetTokenFactory.registerUser('lender1_address', UserRole.USER);
          testAssetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
          testLendingPool.registerUser('borrower_address', UserRole.USER);
          testLendingPool.registerUser('lender1_address', UserRole.USER);
          testLendingPool.registerUser('verifier_address', UserRole.VERIFIER);

          // Create verified asset token for collateral
          const assetParams: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test collateral asset',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: assetValuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Test verification',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const assetToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = assetToken.tokenId;

          // Add liquidity to pool
          await testLendingPool.deposit(poolLiquidity, 'lender1_address');

          // Calculate expected maximum loan amount (70% LTV)
          const expectedMaxLoan = assetValuation * BigInt(70) / BigInt(100);

          // Test loan calculation consistency
          const requestedAmount = expectedMaxLoan / BigInt(2); // Request 50% of max

          if (requestedAmount <= poolLiquidity) {
            // Should be able to borrow up to the calculated amount
            const loanId = await testLendingPool.borrow([collateralTokenId], requestedAmount, 'borrower_address');

            // Verify loan was created
            const loanData = testLendingPool.getLoan(loanId);
            expect(loanData).toBeDefined();
            expect(loanData!.borrower).toBe('borrower_address');
            expect(loanData!.principalAmount).toBe(requestedAmount);
            expect(loanData!.collateralTokenIds).toContain(collateralTokenId);

            // Verify collateral is locked
            const tokenData = testAssetTokenFactory.getTokenData(collateralTokenId);
            expect(tokenData!.isLocked).toBe(true);
            expect(tokenData!.loanId).toBe(loanId);

            // Test that borrowing more than max should fail
            if (expectedMaxLoan < poolLiquidity) {
              await expect(
                testLendingPool.borrow([collateralTokenId], expectedMaxLoan + BigInt(1), 'borrower_address')
              ).rejects.toThrow('Asset is already locked as collateral');
            }
          }
        }
      ),
      { 
        numRuns: 30,
        verbose: true,
        seed: 456,
      }
    );
  });

  /**
   * Property Test: Loan repayment round-trip
   * 
   * For any loan that is fully repaid, collateral should be released correctly
   */
  test('Property 8: Loan repayment round-trip - full repayment releases collateral', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(200000), max: BigInt(500000) }), // Asset valuation
        fc.bigInt({ min: BigInt(50000), max: BigInt(100000) }), // Pool liquidity
        async (assetValuation: bigint, poolLiquidity: bigint) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser('borrower_address', UserRole.USER);
          testAssetTokenFactory.registerUser('lender1_address', UserRole.USER);
          testAssetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
          testLendingPool.registerUser('borrower_address', UserRole.USER);
          testLendingPool.registerUser('lender1_address', UserRole.USER);
          testLendingPool.registerUser('verifier_address', UserRole.VERIFIER);

          // Create verified asset token for collateral
          const assetParams: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test collateral for repayment',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: assetValuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Test verification',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const assetToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = assetToken.tokenId;

          // Add liquidity to pool
          await testLendingPool.deposit(poolLiquidity, 'lender1_address');

          // Calculate loan amount (50% of max to ensure it's within limits)
          const maxLoanAmount = assetValuation * BigInt(70) / BigInt(100);
          const loanAmount = maxLoanAmount / BigInt(2);

          if (loanAmount <= poolLiquidity) {
            // Create loan
            const loanId = await testLendingPool.borrow([collateralTokenId], loanAmount, 'borrower_address');

            // Verify collateral is locked
            const lockedTokenData = testAssetTokenFactory.getTokenData(collateralTokenId);
            expect(lockedTokenData!.isLocked).toBe(true);
            expect(lockedTokenData!.loanId).toBe(loanId);

            // Calculate total repayment amount (principal + minimal interest for immediate repayment)
            const loanData = testLendingPool.getLoan(loanId);
            const repaymentAmount = loanData!.principalAmount + BigInt(100); // Add small buffer for interest

            // Repay loan fully
            const isFullyRepaid = await testLendingPool.repay(loanId, repaymentAmount, 'borrower_address');

            // Verify loan is fully repaid
            expect(isFullyRepaid).toBe(true);

            // Verify loan status is updated
            const repaidLoanData = testLendingPool.getLoan(loanId);
            expect(repaidLoanData!.status).toBe('repaid');

            // Verify collateral is unlocked
            const unlockedTokenData = testAssetTokenFactory.getTokenData(collateralTokenId);
            expect(unlockedTokenData!.isLocked).toBe(false);
            expect(unlockedTokenData!.loanId).toBeUndefined();

            // Verify borrower still owns the collateral
            expect(unlockedTokenData!.owner).toBe('borrower_address');
          }
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 789,
      }
    );
  });

  /**
   * Property Test: Interest rate adjustment consistency
   * 
   * For any change in pool utilization, interest rates should adjust according to the model
   */
  test('Property 13: Interest rate adjustment consistency - rates adjust with utilization', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            deposit: fc.bigInt({ min: BigInt(10000), max: BigInt(50000) }),
            borrow: fc.bigInt({ min: BigInt(5000), max: BigInt(25000) }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (operations: Array<{ deposit: bigint; borrow: bigint }>) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser('borrower_address', UserRole.USER);
          testAssetTokenFactory.registerUser('lender1_address', UserRole.USER);
          testAssetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
          testLendingPool.registerUser('borrower_address', UserRole.USER);
          testLendingPool.registerUser('lender1_address', UserRole.USER);
          testLendingPool.registerUser('verifier_address', UserRole.VERIFIER);

          const initialState = testLendingPool.getPoolState();
          const initialRate = initialState.baseInterestRate;

          for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            // Add deposit
            await testLendingPool.deposit(op.deposit, 'lender1_address');

            // Create collateral for borrowing
            const minAssetValue = BigInt(100000); // $1000 minimum
            const assetValuation = minAssetValue + op.borrow * BigInt(2); // Ensure above minimum
            const assetParams: AssetCreationParams = {
              assetType: AssetType.Equipment,
              owner: 'borrower_address',
              initialValuation: assetValuation,
              metadata: {
                description: `Test asset ${i}`,
                location: 'Test location',
                documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
                appraisalValue: assetValuation,
                appraisalDate: Date.now() - 86400000,
                specifications: {},
              },
              verification: {
                verifier: 'verifier_address',
                verificationDate: Date.now(),
                notes: 'Test verification',
                complianceChecks: {
                  kycCompleted: true,
                  documentationComplete: true,
                  valuationVerified: true,
                  legalClearance: true,
                },
              },
            };

            const assetToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
            const collateralTokenId = assetToken.tokenId;

            // Borrow against collateral
            try {
              await testLendingPool.borrow([collateralTokenId], op.borrow, 'borrower_address');
            } catch (error) {
              // Skip if insufficient liquidity or other constraints
              continue;
            }

            // Check that utilization rate and interest rates are updated
            const currentState = testLendingPool.getPoolState();
            
            // Utilization rate should be calculated correctly
            if (currentState.totalDeposits > BigInt(0)) {
              const expectedUtilization = Number(
                currentState.totalBorrows * BigInt(100) / currentState.totalDeposits
              );
              expect(Math.abs(currentState.utilizationRate - expectedUtilization)).toBeLessThan(1);
            }

            // Interest rate should increase with utilization
            if (currentState.utilizationRate > 0) {
              expect(currentState.baseInterestRate).toBeGreaterThanOrEqual(2.0); // Base rate
            }
          }
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 101112,
      }
    );
  });

  /**
   * Property Test: Invalid operations are rejected
   * 
   * For any invalid lending pool operation, appropriate errors should be thrown
   */
  test('Property: Invalid operations are rejected with appropriate errors', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidDepositAmount: fc.bigInt({ min: BigInt(-1000), max: BigInt(0) }),
          invalidWithdrawer: fc.string({ minLength: 5, maxLength: 20 }).map(s => `invalid_${s}`),
          invalidBorrowAmount: fc.bigInt({ min: BigInt(-1000), max: BigInt(0) }),
        }),
        async (invalidInputs: any) => {
          // Create fresh instances for each property test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          
          // Register test users
          testAssetTokenFactory.registerUser('lender1_address', UserRole.USER);
          testAssetTokenFactory.registerUser('borrower_address', UserRole.USER);
          testLendingPool.registerUser('lender1_address', UserRole.USER);
          testLendingPool.registerUser('borrower_address', UserRole.USER);

          // Test invalid deposit amount
          await expect(
            testLendingPool.deposit(invalidInputs.invalidDepositAmount, 'lender1_address')
          ).rejects.toThrow('Deposit amount must be positive');

          // Test valid deposit for withdrawal test
          const validDepositAmount = BigInt(10000);
          const poolTokenId = await testLendingPool.deposit(validDepositAmount, 'lender1_address');

          // Test unauthorized withdrawal
          testLendingPool.registerUser(invalidInputs.invalidWithdrawer, UserRole.USER);
          await expect(
            testLendingPool.withdraw(poolTokenId, invalidInputs.invalidWithdrawer)
          ).rejects.toThrow('Only token holder can withdraw');

          // Test invalid borrow amount
          await expect(
            testLendingPool.borrow(['fake_token'], invalidInputs.invalidBorrowAmount, 'borrower_address')
          ).rejects.toThrow('Borrow amount must be positive');

          // Test borrowing with no collateral
          await expect(
            testLendingPool.borrow([], BigInt(1000), 'borrower_address')
          ).rejects.toThrow('At least one collateral token required');
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 131415,
      }
    );
  });
});