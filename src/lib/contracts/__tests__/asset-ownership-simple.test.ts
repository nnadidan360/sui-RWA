import fc from 'fast-check';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

/**
 * Simplified Property-Based Test for Asset Ownership Assignment
 * 
 * **Feature: rwa-lending-protocol, Property 3: Asset ownership assignment**
 * **Validates: Requirements 1.4**
 * 
 * Property: For any successfully minted Asset_Token, the token ownership should be correctly assigned to the verified asset owner
 */

describe('Property-Based Test: Asset Ownership Assignment (Simplified)', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users with simple addresses
    assetTokenFactory.registerUser('owner1', UserRole.USER);
    assetTokenFactory.registerUser('owner2', UserRole.USER);
    assetTokenFactory.registerUser('owner3', UserRole.USER);
    assetTokenFactory.registerUser('recipient1', UserRole.USER);
    assetTokenFactory.registerUser('recipient2', UserRole.USER);
    assetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
    assetTokenFactory.registerUser('admin_address', UserRole.ADMIN);
    assetTokenFactory.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
  });

  /**
   * Property Test: Asset ownership is correctly assigned upon minting
   */
  test('Property 3: Asset ownership assignment - tokens are correctly assigned to owners', () => {
    fc.assert(
      fc.asyncProperty(
        // Use predefined owner addresses to avoid special character issues
        fc.constantFrom('owner1', 'owner2', 'owner3'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }),
        async (ownerAddress: string, assetType: AssetType, valuation: bigint) => {
          // Create a fresh factory for this test iteration to avoid state sharing
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner1', 'owner2', 'owner3', 'recipient1', 'recipient2',
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
            throw new Error(`Token data not found for tokenId: ${tokenId}, owner: ${ownerAddress}`);
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
            const recipientAddress = 'recipient1';

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
   */
  test('Property 3: Asset ownership assignment - ownership transfers maintain consistency', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate multiple owner addresses for transfer chain
        fc.shuffledSubarray(['owner1', 'owner2', 'owner3'], { minLength: 2, maxLength: 3 }),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (ownerAddresses: string[], assetType: AssetType, valuation: bigint) => {
          // Create a fresh factory for this test iteration to avoid state sharing
          const testFactory = new AssetTokenFactory();
          
          // Register test users
          const testUsers = [
            'owner1', 'owner2', 'owner3', 'recipient1', 'recipient2',
            'verifier_address', 'admin_address', 'lending_protocol_address'
          ];
          
          testUsers.forEach(address => {
            const role = address.includes('admin') ? UserRole.ADMIN :
                         address.includes('verifier') ? UserRole.VERIFIER :
                         address.includes('lending_protocol') ? UserRole.LENDING_PROTOCOL :
                         UserRole.USER;
            testFactory.registerUser(address, role);
          });

          const initialOwner = ownerAddresses[0];

          // Create and mint asset
          const params: AssetCreationParams = {
            assetType,
            owner: initialOwner,
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

          // Perform transfer chain
          let currentOwner = initialOwner;
          for (let i = 1; i < ownerAddresses.length; i++) {
            const nextOwner = ownerAddresses[i];

            // Get state before transfer
            const beforeOwnerTokens = testFactory.getOwnerTokens(currentOwner);
            const beforeRecipientTokens = testFactory.getOwnerTokens(nextOwner);

            // Perform transfer
            await testFactory.transferToken(tokenId, nextOwner, currentOwner);

            // Verify state after transfer
            
            // 1. Token should be removed from original owner's list
            const afterOwnerTokens = testFactory.getOwnerTokens(currentOwner);
            expect(afterOwnerTokens).not.toContain(tokenId);
            expect(afterOwnerTokens.length).toBe(beforeOwnerTokens.length - 1);

            // 2. Token should be added to new owner's list
            const afterRecipientTokens = testFactory.getOwnerTokens(nextOwner);
            expect(afterRecipientTokens).toContain(tokenId);
            expect(afterRecipientTokens.length).toBe(beforeRecipientTokens.length + 1);

            // 3. Ownership verification should reflect the change
            expect(testFactory.verifyOwnership(tokenId, nextOwner)).toBe(true);
            expect(testFactory.verifyOwnership(tokenId, currentOwner)).toBe(false);

            // 4. Token data should be updated correctly
            const tokenDataAfterTransfer = testFactory.getTokenData(tokenId);
            if (tokenDataAfterTransfer) {
              expect(tokenDataAfterTransfer.owner).toBe(nextOwner);
            }

            currentOwner = nextOwner;
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
   */
  test('Property 3: Asset ownership assignment - unauthorized transfers are rejected', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner1', 'owner2'),
        fc.constantFrom('recipient1', 'recipient2'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Ensure addresses are different
          if (ownerAddress === recipientAddress) {
            return; // Skip this test case
          }

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

          const tokenData = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Action & Verification: Unauthorized user should not be able to transfer
          const unauthorizedUser = ownerAddress === 'owner1' ? 'owner2' : 'owner1';
          await expect(
            assetTokenFactory.transferToken(tokenId, recipientAddress, unauthorizedUser)
          ).rejects.toThrow('Only token owner can transfer asset');

          // Verify ownership hasn't changed
          expect(assetTokenFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
          expect(assetTokenFactory.verifyOwnership(tokenId, recipientAddress)).toBe(false);

          const ownerTokens = assetTokenFactory.getOwnerTokens(ownerAddress);
          const recipientTokens = assetTokenFactory.getOwnerTokens(recipientAddress);
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
   * Property Test: Admin can transfer any asset
   */
  test('Property 3: Asset ownership assignment - admin can transfer any asset', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner1', 'owner2'),
        fc.constantFrom('recipient1', 'recipient2'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(500000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Ensure addresses are different
          if (ownerAddress === recipientAddress) {
            return; // Skip this test case
          }

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

          const tokenData = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Action: Admin should be able to transfer the asset
          await expect(
            assetTokenFactory.transferToken(tokenId, recipientAddress, 'admin_address')
          ).resolves.not.toThrow();

          // Verification: Ownership should have changed
          expect(assetTokenFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
          expect(assetTokenFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);

          const ownerTokens = assetTokenFactory.getOwnerTokens(ownerAddress);
          const recipientTokens = assetTokenFactory.getOwnerTokens(recipientAddress);
          expect(ownerTokens).not.toContain(tokenId);
          expect(recipientTokens).toContain(tokenId);
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 789,
      }
    );
  });
});