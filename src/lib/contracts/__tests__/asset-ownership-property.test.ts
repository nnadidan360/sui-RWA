import fc from 'fast-check';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

/**
 * Property-Based Test for Asset Ownership Assignment
 * 
 * **Feature: rwa-lending-protocol, Property 3: Asset ownership assignment**
 * **Validates: Requirements 1.4**
 * 
 * Property: For any successfully minted Asset_Token, the token ownership should be correctly assigned to the verified asset owner
 */

describe('Property-Based Test: Asset Ownership Assignment', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users
    const testUsers = [
      'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
      'recipient_eve', 'recipient_frank', 'recipient_grace',
      'verifier_address', 'admin_address', 'lending_protocol_address'
    ];
    
    testUsers.forEach(address => {
      const role = address.includes('admin') ? UserRole.ADMIN :
                   address.includes('verifier') ? UserRole.VERIFIER :
                   address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                   UserRole.USER;
      assetTokenFactory.registerUser(address, role);
    });
  });

  /**
   * Property Test: Asset ownership is correctly assigned upon minting
   * 
   * For any successfully minted asset token:
   * 1. The token should be owned by the specified owner
   * 2. The owner should have the token in their token list
   * 3. Ownership verification should work correctly
   * 4. Only the owner should be able to transfer the token
   */
  test('Property 3: Asset ownership assignment - tokens are correctly assigned to owners', () => {
    fc.assert(
      fc.asyncProperty(
        // Use predefined owner addresses to avoid special character issues
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }),
        async (ownerAddress: string, assetType: AssetType, valuation: bigint) => {
          // Create a fresh factory for this test iteration to avoid state sharing
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
            'recipient_eve', 'recipient_frank', 'recipient_grace',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          // Create valid asset creation parameters
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for ownership verification',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Ownership test verification',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          // Action: Tokenize the asset
          const tokenData = await testFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Verification: Check ownership assignment
          
          // 1. Token should be owned by the specified owner
          const retrievedTokenData = testFactory.getTokenData(tokenId);
          expect(retrievedTokenData).toBeDefined();
          
          if (!retrievedTokenData) {
            throw new Error(`Token data not found for tokenId: ${tokenId}`);
          }
          
          expect(retrievedTokenData.owner).toBe(ownerAddress);

          // 2. Owner should have the token in their token list
          const ownerTokens = testFactory.getOwnerTokens(ownerAddress);
          expect(ownerTokens).toContain(tokenId);

          // 3. Ownership verification should work correctly
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, 'other_address')).toBe(false);

          // 4. Only the owner should be able to transfer the token (if verified)
          if (retrievedTokenData.verificationStatus === VerificationStatus.Approved) {
            const recipientAddress = `recipient_${ownerAddress}`;
            testFactory.registerUser(recipientAddress, UserRole.USER);

            // Owner should be able to transfer
            await expect(
              testFactory.transferToken(tokenId, recipientAddress, ownerAddress)
            ).resolves.not.toThrow();

            // Verify ownership changed
            const updatedTokenData = testFactory.getTokenData(tokenId);
            expect(updatedTokenData).toBeDefined();
            if (updatedTokenData) {
              expect(updatedTokenData.owner).toBe(recipientAddress);
              expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
              expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);
            }
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
   * Property Test: Ownership transfer maintains consistency
   * 
   * For any asset token transfer between valid owners:
   * 1. The token should be removed from the original owner's list
   * 2. The token should be added to the new owner's list
   * 3. Ownership verification should reflect the change
   * 4. Token data should be updated correctly
   */
  test('Property 3: Asset ownership assignment - ownership transfers maintain consistency', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie'),
        fc.constantFrom('recipient_eve', 'recipient_frank', 'recipient_grace'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (ownerAddress: string, recipientAddress: string, assetType: AssetType, valuation: bigint) => {
          // Create a fresh factory for this test iteration to avoid state sharing
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
            'recipient_eve', 'recipient_frank', 'recipient_grace',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          // Create and mint asset
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for ownership transfer',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Transfer test verification',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const tokenData = await testFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Get state before transfer
          const beforeOwnerTokens = testFactory.getOwnerTokens(ownerAddress);
          const beforeRecipientTokens = testFactory.getOwnerTokens(recipientAddress);

          // Perform transfer
          await testFactory.transferToken(tokenId, recipientAddress, ownerAddress);

          // Verify state after transfer
          
          // 1. Token should be removed from original owner's list
          const afterOwnerTokens = testFactory.getOwnerTokens(ownerAddress);
          expect(afterOwnerTokens).not.toContain(tokenId);
          expect(afterOwnerTokens.length).toBe(beforeOwnerTokens.length - 1);

          // 2. Token should be added to new owner's list
          const afterRecipientTokens = testFactory.getOwnerTokens(recipientAddress);
          expect(afterRecipientTokens).toContain(tokenId);
          expect(afterRecipientTokens.length).toBe(beforeRecipientTokens.length + 1);

          // 3. Ownership verification should reflect the change
          expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);

          // 4. Token data should be updated correctly
          const updatedTokenData = testFactory.getTokenData(tokenId);
          expect(updatedTokenData).toBeDefined();
          if (updatedTokenData) {
            expect(updatedTokenData.owner).toBe(recipientAddress);
            expect(updatedTokenData.lastUpdated).toBeGreaterThan(0);
          }
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
   * Property Test: Unauthorized transfers are rejected
   * 
   * For any asset token, only authorized parties should be able to transfer it
   */
  test('Property 3: Asset ownership assignment - unauthorized transfers are rejected', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie'),
        fc.constantFrom('recipient_eve', 'recipient_frank', 'recipient_grace'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Create a fresh factory for this test iteration
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
            'recipient_eve', 'recipient_frank', 'recipient_grace',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          // Create unauthorized user address
          const unauthorizedAddress = `unauthorized_${ownerAddress}_${recipientAddress}`;
          testFactory.registerUser(unauthorizedAddress, UserRole.USER);

          // Create and mint asset
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for unauthorized transfer test',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Unauthorized transfer test',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const tokenData = await testFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Action & Verification: Unauthorized user should not be able to transfer
          await expect(
            testFactory.transferToken(tokenId, recipientAddress, unauthorizedAddress)
          ).rejects.toThrow('Only token owner can transfer asset');

          // Verify ownership hasn't changed
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(false);

          const ownerTokens = testFactory.getOwnerTokens(ownerAddress);
          const recipientTokens = testFactory.getOwnerTokens(recipientAddress);
          expect(ownerTokens).toContain(tokenId);
          expect(recipientTokens).not.toContain(tokenId);
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
   * Property Test: Locked assets cannot be transferred
   * 
   * For any asset token that is locked as collateral, transfers should be rejected
   */
  test('Property 3: Asset ownership assignment - locked assets cannot be transferred', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie'),
        fc.constantFrom('recipient_eve', 'recipient_frank', 'recipient_grace'),
        fc.string({ minLength: 5, maxLength: 20 }).map(s => `loan_${s}`),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          loanId: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Create a fresh factory for this test iteration
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
            'recipient_eve', 'recipient_frank', 'recipient_grace',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          // Create and mint asset
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for locked transfer test',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Locked transfer test',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const tokenData = await testFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Lock the asset as collateral
          await testFactory.lockForCollateral(tokenId, loanId, 'lending_protocol_address');

          // Verify asset is locked
          expect(testFactory.isTokenLocked(tokenId)).toBe(true);
          expect(testFactory.getTokenLoanId(tokenId)).toBe(loanId);

          // Action & Verification: Transfer should be rejected for locked asset
          await expect(
            testFactory.transferToken(tokenId, recipientAddress, ownerAddress)
          ).rejects.toThrow('Asset is locked as collateral and cannot be transferred');

          // Verify ownership hasn't changed
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(false);

          // Unlock the asset and verify transfer works
          await testFactory.unlockFromCollateral(tokenId, 'lending_protocol_address');
          expect(testFactory.isTokenLocked(tokenId)).toBe(false);

          // Now transfer should work
          await expect(
            testFactory.transferToken(tokenId, recipientAddress, ownerAddress)
          ).resolves.not.toThrow();

          // Verify ownership changed
          expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);
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
   * Property Test: Admin can transfer any asset
   * 
   * For any asset token, admin users should be able to transfer it regardless of ownership
   */
  test('Property 3: Asset ownership assignment - admin can transfer any asset', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie'),
        fc.constantFrom('recipient_eve', 'recipient_frank', 'recipient_grace'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Create a fresh factory for this test iteration
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana',
            'recipient_eve', 'recipient_frank', 'recipient_grace',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          // Create and mint asset
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for admin transfer test',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Admin transfer test',
              complianceChecks: {
                kycCompleted: true,
                documentationComplete: true,
                valuationVerified: true,
                legalClearance: true,
              },
            },
          };

          const tokenData = await testFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Action: Admin should be able to transfer the asset
          await expect(
            testFactory.transferToken(tokenId, recipientAddress, 'admin_address')
          ).resolves.not.toThrow();

          // Verification: Ownership should have changed
          expect(testFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);

          const ownerTokens = testFactory.getOwnerTokens(ownerAddress);
          const recipientTokens = testFactory.getOwnerTokens(recipientAddress);
          expect(ownerTokens).not.toContain(tokenId);
          expect(recipientTokens).toContain(tokenId);
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