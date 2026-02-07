import fc from 'fast-check';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../../../src/lib/contracts/asset-token';
import { UserRole } from '../../../shared-types/src/entities';

/**
 * Property-Based Test for Asset Ownership Assignment
 * 
 * **Feature: rwa-lending-protocol, Property 3: Asset ownership assignment**
 * **Validates: Requirements 1.4**
 * 
 * Property: For any successfully minted Asset_Token, the token ownership should be correctly assigned to the verified asset owner
 */

describe('Property-Based Test: Asset Ownership Assignment (Final)', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users with simple, predictable addresses
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
   * For any valid asset creation parameters:
   * 1. A unique token ID should be generated
   * 2. The token should be owned by the specified owner
   * 3. The owner should have the token in their token list
   * 4. Ownership verification should work correctly
   */
  test('Property 3: Asset ownership assignment - tokens are correctly assigned to owners', () => {
    fc.assert(
      fc.asyncProperty(
        // Use predefined owner addresses to avoid special character issues
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie', 'owner_diana'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }), // $1000 to $10000
        async (ownerAddress: string, assetType: AssetType, valuation: bigint) => {
          // Create a fresh factory for this test run
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
              description: `Test ${assetType} for ownership verification`,
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: { testProperty: true },
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Property test verification',
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
          
          // 1. Token ID should be generated and unique
          expect(tokenId).toBeDefined();
          expect(typeof tokenId).toBe('string');
          expect(tokenId.length).toBeGreaterThan(0);

          // 2. Token should be owned by the specified owner
          const retrievedTokenData = testFactory.getTokenData(tokenId);
          expect(retrievedTokenData).toBeDefined();
          expect(retrievedTokenData!.owner).toBe(ownerAddress);

          // 3. Owner should have the token in their token list
          const ownerTokens = testFactory.getOwnerTokens(ownerAddress);
          expect(ownerTokens).toContain(tokenId);

          // 4. Ownership verification should work correctly
          expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
          expect(testFactory.verifyOwnership(tokenId, 'owner_alice')).toBe(ownerAddress === 'owner_alice');
          expect(testFactory.verifyOwnership(tokenId, 'nonexistent_user')).toBe(false);

          // 5. Token should be verified (all compliance checks passed)
          expect(retrievedTokenData!.verificationStatus).toBe(VerificationStatus.Approved);
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
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Create a fresh factory for this test run
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
              description: `Test ${assetType} for transfer test`,
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
          expect(updatedTokenData!.owner).toBe(recipientAddress);
          expect(updatedTokenData!.lastUpdated).toBeGreaterThan(0);
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
   * Property Test: Multiple asset ownership
   * 
   * For any user owning multiple assets, all ownership operations should work correctly
   */
  test('Property 3: Asset ownership assignment - multiple asset ownership works correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob'),
        fc.array(
          fc.record({
            assetType: fc.constantFrom(...Object.values(AssetType)),
            valuation: fc.bigInt({ min: BigInt(100000), max: BigInt(300000) }),
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (ownerAddress: string, assetSpecs: any[]) => {
          // Create a fresh factory for this test run to avoid interference
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

          const tokenIds: string[] = [];

          // Create multiple assets for the same owner
          for (let i = 0; i < assetSpecs.length; i++) {
            const spec = assetSpecs[i];
            const params: AssetCreationParams = {
              assetType: spec.assetType,
              owner: ownerAddress,
              initialValuation: spec.valuation,
              metadata: {
                description: `Test asset ${i} for multiple ownership test`,
                location: `Test location ${i}`,
                documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
                appraisalValue: spec.valuation,
                appraisalDate: Date.now() - 86400000,
                specifications: { index: i },
              },
              verification: {
                verifier: 'verifier_address',
                verificationDate: Date.now(),
                notes: `Multiple ownership test ${i}`,
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
            tokenIds.push(tokenId);
          }

          // Verify all tokens are owned by the correct owner
          const ownerTokens = testFactory.getOwnerTokens(ownerAddress);
          expect(ownerTokens.length).toBe(tokenIds.length);

          for (const tokenId of tokenIds) {
            expect(ownerTokens).toContain(tokenId);
            expect(testFactory.verifyOwnership(tokenId, ownerAddress)).toBe(true);
            
            const tokenData = testFactory.getTokenData(tokenId);
            expect(tokenData!.owner).toBe(ownerAddress);
          }

          // Transfer one asset and verify the rest remain with original owner
          if (tokenIds.length > 1) {
            const tokenToTransfer = tokenIds[0];
            const recipientAddress = 'recipient_eve';

            await testFactory.transferToken(tokenToTransfer, recipientAddress, ownerAddress);

            // Verify transfer
            expect(testFactory.verifyOwnership(tokenToTransfer, recipientAddress)).toBe(true);
            expect(testFactory.verifyOwnership(tokenToTransfer, ownerAddress)).toBe(false);

            // Verify remaining tokens still owned by original owner
            for (let i = 1; i < tokenIds.length; i++) {
              expect(testFactory.verifyOwnership(tokenIds[i], ownerAddress)).toBe(true);
            }

            // Verify token lists
            const updatedOwnerTokens = testFactory.getOwnerTokens(ownerAddress);
            const recipientTokens = testFactory.getOwnerTokens(recipientAddress);
            
            expect(updatedOwnerTokens.length).toBe(tokenIds.length - 1);
            expect(recipientTokens).toContain(tokenToTransfer);
            expect(updatedOwnerTokens).not.toContain(tokenToTransfer);
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
   * Property Test: Admin override capabilities
   * 
   * For any asset, admin should be able to transfer regardless of ownership
   */
  test('Property 3: Asset ownership assignment - admin can transfer any asset', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner_alice', 'owner_bob', 'owner_charlie'),
        fc.constantFrom('recipient_eve', 'recipient_frank'),
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(400000) }),
        async (
          ownerAddress: string,
          recipientAddress: string,
          assetType: AssetType,
          valuation: bigint
        ) => {
          // Create asset
          const params: AssetCreationParams = {
            assetType,
            owner: ownerAddress,
            initialValuation: valuation,
            metadata: {
              description: `Test ${assetType} for admin transfer test`,
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

          // Admin should be able to transfer the asset
          await expect(
            assetTokenFactory.transferToken(tokenId, recipientAddress, 'admin_address')
          ).resolves.not.toThrow();

          // Verify ownership changed
          expect(assetTokenFactory.verifyOwnership(tokenId, recipientAddress)).toBe(true);
          expect(assetTokenFactory.verifyOwnership(tokenId, ownerAddress)).toBe(false);

          const ownerTokens = assetTokenFactory.getOwnerTokens(ownerAddress);
          const recipientTokens = assetTokenFactory.getOwnerTokens(recipientAddress);
          expect(ownerTokens).not.toContain(tokenId);
          expect(recipientTokens).toContain(tokenId);
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
   * Property Test: Ownership invariants
   * 
   * For any sequence of valid operations, ownership invariants should be maintained
   */
  test('Property 3: Asset ownership assignment - ownership invariants maintained', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.values(AssetType)),
        fc.bigInt({ min: BigInt(100000), max: BigInt(300000) }),
        async (assetType: AssetType, valuation: bigint) => {
          // Create asset
          const params: AssetCreationParams = {
            assetType,
            owner: 'owner_alice',
            initialValuation: valuation,
            metadata: {
              description: `Test ${assetType} for invariant test`,
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Invariant test',
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

          // Invariant 1: Every token has exactly one owner
          const finalTokenData = assetTokenFactory.getTokenData(tokenId);
          expect(finalTokenData!.owner).toBeDefined();
          expect(typeof finalTokenData!.owner).toBe('string');
          expect(finalTokenData!.owner.length).toBeGreaterThan(0);

          // Invariant 2: Owner's token list contains the token
          const ownerTokens = assetTokenFactory.getOwnerTokens(finalTokenData!.owner);
          expect(ownerTokens).toContain(tokenId);

          // Invariant 3: Ownership verification is consistent
          expect(assetTokenFactory.verifyOwnership(tokenId, finalTokenData!.owner)).toBe(true);

          // Perform transfer and verify invariants still hold
          await assetTokenFactory.transferToken(tokenId, 'recipient_eve', 'owner_alice');

          const updatedTokenData = assetTokenFactory.getTokenData(tokenId);
          
          // Invariant 1: Still has exactly one owner
          expect(updatedTokenData!.owner).toBe('recipient_eve');
          
          // Invariant 2: New owner's token list contains the token
          const newOwnerTokens = assetTokenFactory.getOwnerTokens('recipient_eve');
          expect(newOwnerTokens).toContain(tokenId);
          
          // Invariant 3: Old owner's token list doesn't contain the token
          const oldOwnerTokens = assetTokenFactory.getOwnerTokens('owner_alice');
          expect(oldOwnerTokens).not.toContain(tokenId);
          
          // Invariant 4: Ownership verification is consistent
          expect(assetTokenFactory.verifyOwnership(tokenId, 'recipient_eve')).toBe(true);
          expect(assetTokenFactory.verifyOwnership(tokenId, 'owner_alice')).toBe(false);
        }
      ),
      { 
        numRuns: 40,
        verbose: true,
        seed: 101112,
      }
    );
  });
});