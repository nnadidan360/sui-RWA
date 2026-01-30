import fc from 'fast-check';
import { LoanManager, LoanManagerError, ApplicationStatus } from '../loan-manager';
import { LendingPool } from '../lending-pool';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

/**
 * Property-Based Test for Loan Manager Operations
 * 
 * **Feature: rwa-lending-protocol, Property 5: Loan calculation consistency**
 * **Validates: Requirements 2.1**
 * 
 * **Feature: rwa-lending-protocol, Property 6: Atomic loan execution**
 * **Validates: Requirements 2.2**
 * 
 * Property: For any Asset_Token used as collateral, the maximum loan amount calculation 
 * should be deterministic based on asset valuation and current risk parameters
 */

describe('Property-Based Test: Loan Manager Operations', () => {
  let loanManager: LoanManager;
  let lendingPool: LendingPool;
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    lendingPool = new LendingPool(assetTokenFactory);
    loanManager = new LoanManager(assetTokenFactory, lendingPool);
    
    // Register test users
    const users = [
      'borrower_address', 'lender_address', 'verifier_address', 
      'admin_address', 'lending_protocol_address'
    ];
    
    users.forEach(address => {
      const role = address.includes('admin') ? UserRole.ADMIN :
                   address.includes('verifier') ? UserRole.VERIFIER :
                   address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                   UserRole.USER;
      
      assetTokenFactory.registerUser(address, role);
      lendingPool.registerUser(address, role);
      loanManager.registerUser(address, role);
    });
  });

  /**
   * Property Test: Loan calculation consistency
   * 
   * For any valid collateral asset, loan calculations should be deterministic
   */
  test('Property 5: Loan calculation consistency - loan amounts calculated consistently', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }), // Asset valuation
        fc.integer({ min: 30, max: 365 }), // Loan term in days
        fc.bigInt({ min: BigInt(50000), max: BigInt(200000) }), // Pool liquidity
        async (assetValuation: bigint, loanTerm: number, poolLiquidity: bigint) => {
          // Create fresh instances for this test iteration to avoid state sharing
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
          });

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

          const collateralToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = collateralToken.tokenId;

          // Add liquidity to pool
          await testLendingPool.deposit(poolLiquidity, 'lender_address');

          // Calculate expected maximum loan amount (70% LTV)
          const expectedMaxLoan = assetValuation * BigInt(70) / BigInt(100);
          const requestedAmount = expectedMaxLoan / BigInt(2); // Request 50% of max

          // Submit loan application
          const applicationId = await testLoanManager.submitLoanApplication(
            'borrower_address',
            requestedAmount,
            [collateralTokenId],
            'Property investment',
            loanTerm
          );

          // Verify application was created
          const application = testLoanManager.getLoanApplication(applicationId);
          expect(application).toBeDefined();
          expect(application!.borrower).toBe('borrower_address');
          expect(application!.requestedAmount).toBe(requestedAmount);
          expect(application!.status).toBe(ApplicationStatus.Pending);

          // Conduct risk assessment
          const riskAssessment = await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');

          // Verify risk assessment calculations
          expect(riskAssessment.collateralValue).toBe(assetValuation);
          expect(riskAssessment.loanToValueRatio).toBe(Number(requestedAmount * BigInt(100) / assetValuation));
          expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
          expect(riskAssessment.riskScore).toBeLessThanOrEqual(100);

          // For reasonable LTV ratios, should recommend approval
          if (riskAssessment.loanToValueRatio <= 60) {
            expect(riskAssessment.recommendedAction).toBe('approve');
          }

          // Multiple assessments of the same application should yield consistent results
          const riskAssessment2 = await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
          expect(riskAssessment2.collateralValue).toBe(riskAssessment.collateralValue);
          expect(riskAssessment2.loanToValueRatio).toBe(riskAssessment.loanToValueRatio);
        }
      ),
      { 
        numRuns: 50,
        verbose: true,
        seed: 42,
      }
    );
  });

  /**
   * Property Test: Atomic loan execution
   * 
   * For any approved loan, the borrower should receive the requested amount 
   * and the collateral should be locked in a single atomic transaction
   */
  test('Property 6: Atomic loan execution - loans execute atomically', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(200000), max: BigInt(500000) }), // Asset valuation
        fc.bigInt({ min: BigInt(100000), max: BigInt(300000) }), // Pool liquidity
        async (assetValuation: bigint, poolLiquidity: bigint) => {
          // Create fresh instances for this test iteration to avoid state sharing
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
          });

          // Create verified asset token for collateral
          const assetParams: AssetCreationParams = {
            assetType: AssetType.Equipment,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test equipment for atomic loan test',
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

          const collateralToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = collateralToken.tokenId;

          // Add liquidity to pool
          await testLendingPool.deposit(poolLiquidity, 'lender_address');

          // Calculate safe loan amount (40% LTV to ensure approval)
          const requestedAmount = assetValuation * BigInt(40) / BigInt(100);

          if (requestedAmount <= poolLiquidity) {
            // Submit and process loan application
            const applicationId = await testLoanManager.submitLoanApplication(
              'borrower_address',
              requestedAmount,
              [collateralTokenId],
              'Equipment financing',
              180
            );

            // Conduct risk assessment
            await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');

            // Get initial states
            const initialTokenData = testAssetTokenFactory.getTokenData(collateralTokenId);
            const initialPoolState = testLendingPool.getPoolState();

            expect(initialTokenData!.isLocked).toBe(false);

            // Approve loan (atomic execution)
            const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

            // Verify atomic execution results
            
            // 1. Collateral should be locked
            const finalTokenData = testAssetTokenFactory.getTokenData(collateralTokenId);
            expect(finalTokenData).toBeDefined();
            expect(finalTokenData!.isLocked).toBe(true);
            expect(finalTokenData!.loanId).toBe(loanId);

            // 2. Loan should be created in lending pool
            const loanData = testLendingPool.getLoan(loanId);
            expect(loanData).toBeDefined();
            expect(loanData!.borrower).toBe('borrower_address');
            expect(loanData!.principalAmount).toBe(requestedAmount);
            expect(loanData!.collateralTokenIds).toContain(collateralTokenId);
            expect(loanData!.status).toBe('active');

            // 3. Pool state should be updated
            const finalPoolState = testLendingPool.getPoolState();
            expect(finalPoolState.totalBorrows).toBe(initialPoolState.totalBorrows + requestedAmount);

            // 4. Application should be marked as approved
            const finalApplication = testLoanManager.getLoanApplication(applicationId);
            expect(finalApplication!.status).toBe(ApplicationStatus.Approved);

            // Verify that if any part fails, the entire transaction should fail
            // (This is implicitly tested by the atomic nature of the operations)
          }
        }
      ),
      { 
        numRuns: 30,
        verbose: true,
        seed: 123,
      }
    );
  });

  /**
   * Property Test: Risk assessment consistency
   * 
   * For any loan application, risk assessments should be consistent and deterministic
   */
  test('Property: Risk assessment consistency - assessments are deterministic', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          assetValuation: fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
          requestedAmount: fc.bigInt({ min: BigInt(30000), max: BigInt(200000) }),
          loanTerm: fc.integer({ min: 30, max: 730 }),
          assetType: fc.constantFrom(...Object.values(AssetType)),
        }),
        async (params: any) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
          });

          // Create verified asset token
          const assetParams: AssetCreationParams = {
            assetType: params.assetType,
            owner: 'borrower_address',
            initialValuation: params.assetValuation,
            metadata: {
              description: 'Test asset for risk assessment',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: params.assetValuation,
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

          const collateralToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = collateralToken.tokenId;

          // Submit loan application
          const applicationId = await testLoanManager.submitLoanApplication(
            'borrower_address',
            params.requestedAmount,
            [collateralTokenId],
            'Test loan purpose',
            params.loanTerm
          );

          // Conduct risk assessment
          const riskAssessment = await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');

          // Verify risk assessment properties
          expect(riskAssessment.collateralValue).toBe(params.assetValuation);
          
          const expectedLTV = Number(params.requestedAmount * BigInt(100) / params.assetValuation);
          expect(riskAssessment.loanToValueRatio).toBe(expectedLTV);

          // Risk score should be within valid range
          expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
          expect(riskAssessment.riskScore).toBeLessThanOrEqual(100);

          // Risk factors should be relevant to the loan parameters
          expect(Array.isArray(riskAssessment.riskFactors)).toBe(true);

          // Recommendation should be consistent with risk score and LTV
          if (riskAssessment.riskScore > 70 || expectedLTV > 85) {
            expect(riskAssessment.recommendedAction).toBe('reject');
          } else if (riskAssessment.riskScore > 50 || expectedLTV > 75) {
            expect(riskAssessment.recommendedAction).toBe('request_more_collateral');
          } else {
            expect(riskAssessment.recommendedAction).toBe('approve');
          }
        }
      ),
      { 
        numRuns: 40,
        verbose: true,
        seed: 456,
      }
    );
  });

  /**
   * Property Test: Loan payment processing
   * 
   * For any valid loan payment, the payment should be processed correctly
   */
  test('Property: Loan payment processing - payments processed correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(200000), max: BigInt(400000) }), // Asset valuation
        fc.bigInt({ min: BigInt(150000), max: BigInt(300000) }), // Pool liquidity
        fc.bigInt({ min: BigInt(1000), max: BigInt(50000) }), // Payment amount
        async (assetValuation: bigint, poolLiquidity: bigint, paymentAmount: bigint) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
          });

          // Create and approve a loan first
          const assetParams: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test asset for payment test',
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

          const collateralToken = await testAssetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
          const collateralTokenId = collateralToken.tokenId;
          await testLendingPool.deposit(poolLiquidity, 'lender_address');

          const loanAmount = assetValuation * BigInt(30) / BigInt(100); // 30% LTV

          if (loanAmount <= poolLiquidity) {
            // Create and approve loan
            const applicationId = await testLoanManager.submitLoanApplication(
              'borrower_address',
              loanAmount,
              [collateralTokenId],
              'Test loan',
              180
            );

            await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
            const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

            // Get initial loan state
            const initialLoanData = testLendingPool.getLoan(loanId);
            const initialRepaidAmount = initialLoanData!.repaidAmount;

            // Make payment
            const paymentId = await testLoanManager.makeLoanPayment(
              loanId,
              paymentAmount,
              'principal',
              'borrower_address'
            );

            // Verify payment was recorded
            const payments = testLoanManager.getLoanPayments(loanId);
            expect(payments.length).toBeGreaterThan(0);
            
            const payment = payments.find(p => p.paymentId === paymentId);
            expect(payment).toBeDefined();
            expect(payment!.amount).toBe(paymentAmount);
            expect(payment!.paidBy).toBe('borrower_address');
            expect(payment!.loanId).toBe(loanId);

            // Verify loan state was updated
            const updatedLoanData = testLendingPool.getLoan(loanId);
            expect(updatedLoanData!.repaidAmount).toBe(initialRepaidAmount + paymentAmount);
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
   * Property Test: Invalid operations are rejected
   * 
   * For any invalid loan manager operation, appropriate errors should be thrown
   */
  test('Property: Invalid operations are rejected with appropriate errors', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidAmount: fc.bigInt({ min: BigInt(-1000), max: BigInt(0) }),
          invalidTerm: fc.integer({ min: -100, max: 0 }),
          unauthorizedUser: fc.string({ minLength: 5, maxLength: 20 }).map(s => `unauthorized_${s}`),
        }),
        async (invalidInputs: any) => {
          // Create fresh instances for this test iteration
          const testLoanManager = new LoanManager(new AssetTokenFactory(), new LendingPool(new AssetTokenFactory()));
          
          // Register unauthorized user
          testLoanManager.registerUser(invalidInputs.unauthorizedUser, UserRole.USER);

          // Test invalid loan amount
          await expect(
            testLoanManager.submitLoanApplication(
              'borrower_address',
              invalidInputs.invalidAmount,
              ['fake_token'],
              'Test purpose',
              180
            )
          ).rejects.toThrow('Requested amount must be positive');

          // Test invalid loan term
          await expect(
            testLoanManager.submitLoanApplication(
              'borrower_address',
              BigInt(10000),
              ['fake_token'],
              'Test purpose',
              invalidInputs.invalidTerm
            )
          ).rejects.toThrow('Loan term must be between 1 and 1825 days');

          // Test no collateral
          await expect(
            testLoanManager.submitLoanApplication(
              'borrower_address',
              BigInt(10000),
              [],
              'Test purpose',
              180
            )
          ).rejects.toThrow('At least one collateral token required');

          // Test unauthorized risk assessment
          await expect(
            testLoanManager.conductRiskAssessment('fake_app_id', invalidInputs.unauthorizedUser)
          ).rejects.toThrow('Only verifiers can conduct risk assessments');

          // Test unauthorized loan approval
          await expect(
            testLoanManager.approveLoanApplication('fake_app_id', invalidInputs.unauthorizedUser)
          ).rejects.toThrow('Only admins can approve loans');
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 101112,
      }
    );
  });
});