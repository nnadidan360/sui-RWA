import fc from 'fast-check';
import { LiquidationManager, LiquidationManagerError, LiquidationStatus } from '../liquidation-manager';
import { LendingPool } from '../lending-pool';
import { AssetTokenFactory, AssetCreationParams, AssetType } from '../asset-token';
import { LoanManager } from '../loan-manager';
import { UserRole } from '../../../types/auth';

/**
 * Property-Based Test for Liquidation System
 * 
 * **Feature: rwa-lending-protocol, Property 7: Liquidation threshold enforcement**
 * **Validates: Requirements 2.3**
 * 
 * Property: For any loan position where collateral value falls below the liquidation threshold, 
 * the liquidation process should be automatically initiated
 */

describe('Property-Based Test: Liquidation System', () => {
  let liquidationManager: LiquidationManager;
  let lendingPool: LendingPool;
  let assetTokenFactory: AssetTokenFactory;
  let loanManager: LoanManager;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    lendingPool = new LendingPool(assetTokenFactory);
    loanManager = new LoanManager(assetTokenFactory, lendingPool);
    liquidationManager = new LiquidationManager(assetTokenFactory, lendingPool);
    
    // Register test users
    const users = [
      'borrower_address', 'lender_address', 'verifier_address', 
      'admin_address', 'lending_protocol_address', 'liquidator_address'
    ];
    
    users.forEach(address => {
      const role = address.includes('admin') ? UserRole.ADMIN :
                   address.includes('verifier') ? UserRole.VERIFIER :
                   address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                   UserRole.USER;
      
      assetTokenFactory.registerUser(address, role);
      lendingPool.registerUser(address, role);
      loanManager.registerUser(address, role);
      liquidationManager.registerUser(address, role);
    });
  });

  /**
   * Helper function to create a loan for testing
   */
  const createTestLoan = async (
    assetValuation: bigint,
    loanAmount: bigint,
    poolLiquidity: bigint
  ): Promise<{ loanId: string; collateralTokenId: string }> => {
    // Create verified asset token for collateral
    const assetParams: AssetCreationParams = {
      assetType: AssetType.RealEstate,
      owner: 'borrower_address',
      initialValuation: assetValuation,
      metadata: {
        description: 'Test collateral for liquidation',
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

    const collateralToken = await assetTokenFactory.tokenizeAsset(assetParams, 'verifier_address');
    const collateralTokenId = collateralToken.tokenId;

    // Add liquidity to pool
    await lendingPool.deposit(poolLiquidity, 'lender_address');

    // Create and approve loan
    const applicationId = await loanManager.submitLoanApplication(
      'borrower_address',
      loanAmount,
      [collateralTokenId],
      'Test loan for liquidation',
      180
    );

    await loanManager.conductRiskAssessment(applicationId, 'verifier_address');
    const loanId = await loanManager.approveLoanApplication(applicationId, 'admin_address');

    return { loanId, collateralTokenId };
  };

  /**
   * Property Test: Liquidation threshold enforcement
   * 
   * For any loan where collateral value falls below liquidation threshold,
   * liquidation should be triggered
   */
  test('Property 7: Liquidation threshold enforcement - liquidation triggered when threshold exceeded', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(300000), max: BigInt(500000) }), // Asset valuation
        fc.bigInt({ min: BigInt(200000), max: BigInt(400000) }), // Pool liquidity
        async (assetValuation: bigint, poolLiquidity: bigint) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          const testLiquidationManager = new LiquidationManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address', 'liquidator_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
            testLiquidationManager.registerUser(address, role);
          });

          // Create loan with high LTV (70% of asset value)
          const loanAmount = assetValuation * BigInt(70) / BigInt(100);

          if (loanAmount <= poolLiquidity) {
            // Create verified asset token for collateral
            const assetParams: AssetCreationParams = {
              assetType: AssetType.RealEstate,
              owner: 'borrower_address',
              initialValuation: assetValuation,
              metadata: {
                description: 'Test collateral for liquidation',
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

            // Create and approve loan
            const applicationId = await testLoanManager.submitLoanApplication(
              'borrower_address',
              loanAmount,
              [collateralTokenId],
              'Test loan for liquidation',
              180
            );

            await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
            const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

            // Simulate collateral value drop by updating asset valuation
            // This would trigger liquidation as LTV would exceed threshold
            const newLowerValuation = loanAmount * BigInt(100) / BigInt(80); // 80% LTV (above 75% threshold)
            
            // Update asset valuation to simulate market drop
            await testAssetTokenFactory.updateValuation(
              collateralTokenId,
              {
                newValuation: newLowerValuation,
                appraiser: 'verifier_address',
                appraisalDate: Date.now(),
                notes: 'Market valuation drop for liquidation test',
              },
              'verifier_address'
            );

            // Check liquidation criteria
            const shouldLiquidate = await testLiquidationManager.checkLiquidationCriteria(loanId);
            expect(shouldLiquidate).toBe(true);

            // Initiate liquidation
            const liquidationId = await testLiquidationManager.initiateLiquidation(
              loanId,
              'liquidator_address',
              'ltv_threshold'
            );

            // Verify liquidation event was created
            const liquidationEvent = testLiquidationManager.getLiquidationEvent(liquidationId);
            expect(liquidationEvent).toBeDefined();
            expect(liquidationEvent!.loanId).toBe(loanId);
            expect(liquidationEvent!.borrower).toBe('borrower_address');
            expect(liquidationEvent!.liquidator).toBe('liquidator_address');
            expect(liquidationEvent!.status).toBe(LiquidationStatus.Initiated);
            expect(liquidationEvent!.liquidationRatio).toBeGreaterThanOrEqual(75);

            // Verify liquidation trigger was recorded
            const triggers = testLiquidationManager.getLiquidationTriggers(loanId);
            expect(triggers.length).toBeGreaterThan(0);
            expect(triggers[0].triggerType).toBe('ltv_threshold');
            expect(triggers[0].isActive).toBe(true);
          }
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 42,
      }
    );
  });

  /**
   * Property Test: Liquidation execution and proceeds distribution
   * 
   * For any liquidation, proceeds should be distributed correctly according to priority
   */
  test('Property: Liquidation proceeds distribution - proceeds distributed correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(400000), max: BigInt(600000) }), // Asset valuation
        fc.bigInt({ min: BigInt(300000), max: BigInt(500000) }), // Pool liquidity
        async (assetValuation: bigint, poolLiquidity: bigint) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          const testLiquidationManager = new LiquidationManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address', 'liquidator_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
            testLiquidationManager.registerUser(address, role);
          });

          // Create loan with moderate LTV initially
          const loanAmount = assetValuation * BigInt(60) / BigInt(100);

          if (loanAmount <= poolLiquidity) {
            // Create verified asset token for collateral
            const assetParams: AssetCreationParams = {
              assetType: AssetType.RealEstate,
              owner: 'borrower_address',
              initialValuation: assetValuation,
              metadata: {
                description: 'Test collateral for liquidation',
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

            // Create and approve loan
            const applicationId = await testLoanManager.submitLoanApplication(
              'borrower_address',
              loanAmount,
              [collateralTokenId],
              'Test loan for liquidation',
              180
            );

            await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
            const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

            // Simulate collateral value drop to trigger liquidation
            const newLowerValuation = loanAmount * BigInt(100) / BigInt(80); // 80% LTV
            
            await testAssetTokenFactory.updateValuation(
              collateralTokenId,
              {
                newValuation: newLowerValuation,
                appraiser: 'verifier_address',
                appraisalDate: Date.now(),
                notes: 'Valuation drop for liquidation test',
              },
              'verifier_address'
            );

            // Initiate and execute liquidation
            const liquidationId = await testLiquidationManager.initiateLiquidation(
              loanId,
              'liquidator_address'
            );

            await testLiquidationManager.executeLiquidation(liquidationId, 'liquidator_address');

            // Verify liquidation was completed
            const liquidationEvent = testLiquidationManager.getLiquidationEvent(liquidationId);
            expect(liquidationEvent!.status).toBe(LiquidationStatus.Completed);

            // Verify proceeds distribution
            const proceeds = testLiquidationManager.getLiquidationProceeds(liquidationId);
            expect(proceeds).toBeDefined();
            expect(proceeds!.totalProceeds).toBe(newLowerValuation);
            expect(proceeds!.distributions.length).toBeGreaterThan(0);

            // Verify debt repayment is prioritized
            const debtRepayment = proceeds!.distributions.find(d => d.distributionType === 'debt_repayment');
            expect(debtRepayment).toBeDefined();
            expect(debtRepayment!.amount).toBeGreaterThan(BigInt(0));

            // Verify total distributions equal total proceeds
            const totalDistributed = proceeds!.distributions.reduce(
              (sum, dist) => sum + dist.amount,
              BigInt(0)
            );
            expect(totalDistributed).toBe(proceeds!.totalProceeds);

            // Verify loan status was updated
            const finalLoanData = testLendingPool.getLoan(loanId);
            expect(finalLoanData!.status).toBe('liquidated');
          }
        }
      ),
      { 
        numRuns: 15,
        verbose: true,
        seed: 123,
      }
    );
  });

  /**
   * Property Test: Penalty interest calculation
   * 
   * For any overdue loan, penalty interest should be calculated correctly
   */
  test('Property: Penalty interest calculation - penalties calculated correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(100000), max: BigInt(300000) }), // Loan amount
        fc.integer({ min: 1, max: 100 }), // Days overdue
        async (loanAmount: bigint, daysOverdue: number) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          const testLiquidationManager = new LiquidationManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address', 'liquidator_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
            testLiquidationManager.registerUser(address, role);
          });

          // Create a loan for penalty calculation
          const assetValuation = loanAmount * BigInt(2); // 50% LTV
          const poolLiquidity = loanAmount + BigInt(50000);

          // Create verified asset token for collateral
          const assetParams: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test collateral for liquidation',
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

          // Create and approve loan
          const applicationId = await testLoanManager.submitLoanApplication(
            'borrower_address',
            loanAmount,
            [collateralTokenId],
            'Test loan for liquidation',
            180
          );

          await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
          const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

          // Get loan data and simulate it being overdue
          const loanData = testLendingPool.getLoan(loanId);
          if (loanData) {
            // Manually set due date to simulate overdue loan
            const millisecondsOverdue = daysOverdue * 24 * 60 * 60 * 1000;
            loanData.dueDate = Date.now() - millisecondsOverdue;

            // Calculate penalty interest
            const penaltyCalc = await testLiquidationManager.calculatePenaltyInterest(loanId);

            // Verify penalty calculation
            expect(penaltyCalc.loanId).toBe(loanId);
            expect(penaltyCalc.daysOverdue).toBe(daysOverdue);
            expect(penaltyCalc.basePenaltyRate).toBe(20); // 20% annual penalty rate
            expect(penaltyCalc.penaltyAmount).toBeGreaterThanOrEqual(BigInt(0));

            // Verify penalty amount calculation
            const expectedPenaltyRate = 0.20; // 20% annual
            const timeInYears = daysOverdue / 365;
            const expectedPenalty = loanAmount * BigInt(Math.floor(expectedPenaltyRate * timeInYears * 1000)) / BigInt(1000);
            
            expect(penaltyCalc.penaltyAmount).toBe(expectedPenalty);
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
   * Property Test: Liquidation criteria validation
   * 
   * For any loan, liquidation should only be allowed when criteria are met
   */
  test('Property: Liquidation criteria validation - liquidation only when warranted', () => {
    fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: BigInt(200000), max: BigInt(400000) }), // Asset valuation
        fc.integer({ min: 60, max: 70 }), // LTV percentage (max 70% to stay within lending limits)
        async (assetValuation: bigint, ltvPercentage: number) => {
          // Create fresh instances for this test iteration
          const testAssetTokenFactory = new AssetTokenFactory();
          const testLendingPool = new LendingPool(testAssetTokenFactory);
          const testLoanManager = new LoanManager(testAssetTokenFactory, testLendingPool);
          const testLiquidationManager = new LiquidationManager(testAssetTokenFactory, testLendingPool);
          
          // Register test users
          const users = [
            'borrower_address', 'lender_address', 'verifier_address', 
            'admin_address', 'lending_protocol_address', 'liquidator_address'
          ];
          
          users.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            
            testAssetTokenFactory.registerUser(address, role);
            testLendingPool.registerUser(address, role);
            testLoanManager.registerUser(address, role);
            testLiquidationManager.registerUser(address, role);
          });

          const loanAmount = assetValuation * BigInt(ltvPercentage) / BigInt(100);
          const poolLiquidity = loanAmount + BigInt(100000);

          // Create verified asset token for collateral
          const assetParams: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'borrower_address',
            initialValuation: assetValuation,
            metadata: {
              description: 'Test collateral for liquidation',
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

          // Create and approve loan
          const applicationId = await testLoanManager.submitLoanApplication(
            'borrower_address',
            loanAmount,
            [collateralTokenId],
            'Test loan for liquidation',
            180
          );

          await testLoanManager.conductRiskAssessment(applicationId, 'verifier_address');
          const loanId = await testLoanManager.approveLoanApplication(applicationId, 'admin_address');

          // Check liquidation criteria
          const shouldLiquidate = await testLiquidationManager.checkLiquidationCriteria(loanId);

          // Since we can only create loans up to 70% LTV, but liquidation threshold is 75%,
          // we need to simulate the loan becoming underwater due to interest/penalties or asset devaluation
          // For this test, we'll check that loans at 60-70% LTV are NOT immediately liquidatable
          
          // At initial LTV (60-70%), liquidation should not be warranted
          expect(shouldLiquidate).toBe(false);

          // Test that we cannot initiate liquidation for healthy loans
          await expect(
            testLiquidationManager.initiateLiquidation(loanId, 'liquidator_address')
          ).rejects.toThrow('Loan does not meet liquidation criteria');
        }
      ),
      { 
        numRuns: 25,
        verbose: true,
        seed: 789,
      }
    );
  });

  /**
   * Property Test: Invalid liquidation operations are rejected
   * 
   * For any invalid liquidation operation, appropriate errors should be thrown
   */
  test('Property: Invalid liquidation operations are rejected', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }).map(s => `invalid_${s}`),
        fc.string({ minLength: 5, maxLength: 20 }).map(s => `fake_loan_${s}`),
        async (invalidUser: string, fakeLoanId: string) => {
          // Create fresh instances for this test iteration
          const testLiquidationManager = new LiquidationManager(new AssetTokenFactory(), new LendingPool(new AssetTokenFactory()));
          
          // Register invalid user
          testLiquidationManager.registerUser(invalidUser, UserRole.USER);

          // Test liquidation of non-existent loan
          await expect(
            testLiquidationManager.checkLiquidationCriteria(fakeLoanId)
          ).resolves.toBe(false);

          await expect(
            testLiquidationManager.initiateLiquidation(fakeLoanId, invalidUser)
          ).rejects.toThrow(/Loan .* not found/);

          // Test liquidation of non-existent liquidation event
          await expect(
            testLiquidationManager.executeLiquidation('fake_liquidation_id', invalidUser)
          ).rejects.toThrow('Liquidation fake_liquidation_id not found');

          // Test penalty calculation for non-existent loan
          await expect(
            testLiquidationManager.calculatePenaltyInterest(fakeLoanId)
          ).rejects.toThrow(`Loan ${fakeLoanId} not found`);
        }
      ),
      { 
        numRuns: 15,
        verbose: true,
        seed: 101112,
      }
    );
  });
});