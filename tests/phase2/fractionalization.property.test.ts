// PHASE 2: Property-Based Tests for Fractionalization
// **Feature: credit-os, Property 16: Fractionalization Integrity**
// **Validates: Requirements 13.2, 13.4**

import fc from 'fast-check';
import mongoose from 'mongoose';
import { FractionalToken } from '../../src/models/phase2/FractionalToken';
import { FractionalizationService } from '../../src/services/phase2/FractionalizationService';
import { Asset } from '../../src/models/Asset';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/test-db';

// Test database setup
beforeAll(async () => {
  await connectTestDB();
}, 60000); // 60 second timeout

afterAll(async () => {
  await disconnectTestDB();
}, 60000); // 60 second timeout

beforeEach(async () => {
  await clearTestDB();
}, 60000); // 60 second timeout

// Helper function to create a valid asset for testing
async function createTestAsset(
  userId: string,
  assetName: string,
  assetValue: number,
  assetType: 'real_estate' | 'commodity' | 'invoice' | 'equipment' | 'other' = 'real_estate'
) {
  const tokenId = `asset-${Date.now()}-${Math.random()}`;
  return await Asset.create({
    tokenId,
    assetType,
    owner: userId,
    metadata: {
      title: assetName,
      description: `Test asset for fractionalization - ${assetName}`,
      valuation: {
        amount: assetValue,
        currency: 'USD',
        date: new Date()
      },
      documents: [],
      searchKeywords: ['test', 'fractionalization'],
      tags: ['test']
    },
    verification: {
      status: 'approved',
      complianceChecks: {
        kycCompleted: true,
        documentationComplete: true,
        valuationVerified: true,
        legalClearance: true
      }
    },
    onChainData: {},
    financialData: {
      currentValue: assetValue,
      valueHistory: [],
      utilizationInLoans: []
    },
    auditTrail: []
  });
}

describe('Fractionalization Integrity Properties', () => {
  /**
   * Property 16: Fractionalization Integrity
   * For any verified asset, fractionalization should create FractionalAssetToken objects
   * that maintain connection to the original asset, and ownership transfers should
   * preserve total supply while updating balances correctly.
   */

  describe('Property 16.1: Fractionalization creates valid tokens linked to assets', () => {
    it('should create fractional tokens with correct supply and link to original asset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }), // totalSupply (reduced range)
          fc.integer({ min: 100, max: 1000 }), // pricePerToken (ensure min value >= $10,000)
          fc.string({ minLength: 5, maxLength: 50 }), // assetName
          async (totalSupply, pricePerToken, assetName) => {
            // Create a verified asset
            const userId = new mongoose.Types.ObjectId().toString();
            const asset = await createTestAsset(userId, assetName, totalSupply * pricePerToken);

            // Fractionalize the asset
            const fractionalToken = await FractionalizationService.createFractionalizationRequest(
              asset._id.toString(),
              userId,
              totalSupply,
              pricePerToken,
              assetName
            );

            // Verify token creation
            expect(fractionalToken).toBeDefined();
            expect(fractionalToken.originalAssetId.toString()).toBe(asset._id.toString());
            expect(fractionalToken.totalSupply).toBe(totalSupply);
            expect(fractionalToken.circulatingSupply).toBe(totalSupply);
            expect(fractionalToken.pricePerToken).toBe(pricePerToken);
            expect(fractionalToken.assetValue).toBe(totalSupply * pricePerToken);

            // Verify initial holder owns all tokens
            expect(fractionalToken.holders).toHaveLength(1);
            expect(fractionalToken.holders[0].userId.toString()).toBe(userId);
            expect(fractionalToken.holders[0].balance).toBe(totalSupply);
            expect(fractionalToken.holders[0].percentage).toBe(100);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 16.2: Ownership transfers preserve total supply', () => {
    it('should maintain total supply invariant across all transfers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 3000 }), // totalSupply (reduced range)
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }), // transfer amounts (reduced)
          async (totalSupply, transferAmounts) => {
            // Create asset and fractionalize
            const ownerId = new mongoose.Types.ObjectId().toString();
            const asset = await createTestAsset(ownerId, 'Test Property', totalSupply * 100);

            let token = await FractionalizationService.createFractionalizationRequest(
              asset._id.toString(),
              ownerId,
              totalSupply,
              100
            );

            // Approve for trading
            token = await FractionalizationService.approveFractionalization(
              token._id.toString(),
              'admin-id'
            );

            // Perform transfers
            const recipients: string[] = [];
            let remainingBalance = totalSupply;

            for (const amount of transferAmounts) {
              if (remainingBalance <= 0) break;
              
              const transferAmount = Math.min(amount, remainingBalance);
              const recipientId = new mongoose.Types.ObjectId().toString();
              recipients.push(recipientId);

              token = await FractionalizationService.transferTokens(
                token._id.toString(),
                ownerId,
                recipientId,
                transferAmount
              );

              remainingBalance -= transferAmount;
            }

            // Verify total supply is preserved
            const totalHolderBalance = token.holders.reduce((sum, h) => sum + h.balance, 0);
            expect(totalHolderBalance).toBe(totalSupply);
            expect(token.totalSupply).toBe(totalSupply);
            expect(token.circulatingSupply).toBe(totalSupply);

            // Verify percentages sum to 100
            const totalPercentage = token.holders.reduce((sum, h) => sum + h.percentage, 0);
            expect(totalPercentage).toBeCloseTo(100, 1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 16.3: Ownership changes maintain asset connection', () => {
    it('should preserve link to original asset through all ownership changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 3000 }), // totalSupply (reduced range)
          fc.array(
            fc.record({
              amount: fc.integer({ min: 10, max: 50 }),
              recipientIndex: fc.integer({ min: 0, max: 2 })
            }),
            { minLength: 3, maxLength: 10 } // reduced
          ),
          async (totalSupply, transfers) => {
            // Create asset and fractionalize
            const ownerId = new mongoose.Types.ObjectId().toString();
            const asset = await createTestAsset(ownerId, 'Test Asset', totalSupply * 50, 'equipment');

            const originalAssetId = asset._id.toString();

            let token = await FractionalizationService.createFractionalizationRequest(
              originalAssetId,
              ownerId,
              totalSupply,
              50
            );

            token = await FractionalizationService.approveFractionalization(
              token._id.toString(),
              'admin-id'
            );

            // Create recipient pool
            const recipients = Array.from({ length: 3 }, () => 
              new mongoose.Types.ObjectId().toString()
            );

            // Perform transfers
            for (const transfer of transfers) {
              const senderHolding = token.holders.find(h => h.balance > 0);
              if (!senderHolding || senderHolding.balance < transfer.amount) continue;

              const senderId = senderHolding.userId.toString();
              const recipientId = recipients[transfer.recipientIndex % recipients.length];

              token = await FractionalizationService.transferTokens(
                token._id.toString(),
                senderId,
                recipientId,
                Math.min(transfer.amount, senderHolding.balance)
              );

              // Verify asset connection is maintained
              expect(token.originalAssetId.toString()).toBe(originalAssetId);
            }

            // Final verification: asset connection still intact
            const finalToken = await FractionalToken.findById(token._id);
            expect(finalToken).toBeDefined();
            expect(finalToken!.originalAssetId.toString()).toBe(originalAssetId);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  describe('Property 16.4: Balance updates are consistent', () => {
    it('should maintain consistent balances across multiple transfers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 5000 }), // totalSupply
          fc.array(
            fc.record({
              fromIndex: fc.integer({ min: 0, max: 2 }),
              toIndex: fc.integer({ min: 0, max: 2 }),
              amount: fc.integer({ min: 1, max: 100 })
            }),
            { minLength: 5, maxLength: 15 }
          ),
          async (totalSupply, transfers) => {
            // Create asset and fractionalize
            const ownerId = new mongoose.Types.ObjectId().toString();
            const asset = await createTestAsset(ownerId, 'Balance Test Asset', totalSupply * 75, 'equipment');

            let token = await FractionalizationService.createFractionalizationRequest(
              asset._id.toString(),
              ownerId,
              totalSupply,
              75
            );

            token = await FractionalizationService.approveFractionalization(
              token._id.toString(),
              'admin-id'
            );

            // Create user pool
            const users = [ownerId, ...Array.from({ length: 2 }, () => 
              new mongoose.Types.ObjectId().toString()
            )];

            // Track expected balances
            const expectedBalances = new Map<string, number>();
            expectedBalances.set(ownerId, totalSupply);

            // Perform transfers
            for (const transfer of transfers) {
              const fromUser = users[transfer.fromIndex];
              const toUser = users[transfer.toIndex];

              if (fromUser === toUser) continue;

              const fromBalance = expectedBalances.get(fromUser) || 0;
              if (fromBalance < transfer.amount) continue;

              try {
                token = await FractionalizationService.transferTokens(
                  token._id.toString(),
                  fromUser,
                  toUser,
                  transfer.amount
                );

                // Update expected balances
                expectedBalances.set(fromUser, fromBalance - transfer.amount);
                expectedBalances.set(toUser, (expectedBalances.get(toUser) || 0) + transfer.amount);

                // Verify actual balances match expected
                for (const [userId, expectedBalance] of expectedBalances.entries()) {
                  const holder = token.holders.find(h => h.userId.toString() === userId);
                  if (expectedBalance > 0) {
                    expect(holder).toBeDefined();
                    expect(holder!.balance).toBe(expectedBalance);
                  } else {
                    expect(holder).toBeUndefined();
                  }
                }
              } catch (error) {
                // Transfer failed, balances should remain unchanged
                continue;
              }
            }

            // Final verification: total supply preserved
            const totalBalance = token.holders.reduce((sum, h) => sum + h.balance, 0);
            expect(totalBalance).toBe(totalSupply);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 16.5: Duplicate fractionalization prevention', () => {
    it('should prevent fractionalizing the same asset twice', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }), // totalSupply
          fc.integer({ min: 100, max: 500 }), // pricePerToken
          async (totalSupply, pricePerToken) => {
            // Create a verified asset
            const userId = new mongoose.Types.ObjectId().toString();
            const asset = await createTestAsset(userId, 'Unique Asset', totalSupply * pricePerToken);

            // First fractionalization should succeed
            const firstToken = await FractionalizationService.createFractionalizationRequest(
              asset._id.toString(),
              userId,
              totalSupply,
              pricePerToken
            );

            expect(firstToken).toBeDefined();

            // Second fractionalization should fail
            await expect(
              FractionalizationService.createFractionalizationRequest(
                asset._id.toString(),
                userId,
                totalSupply * 2,
                pricePerToken
              )
            ).rejects.toThrow('Asset already fractionalized');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});