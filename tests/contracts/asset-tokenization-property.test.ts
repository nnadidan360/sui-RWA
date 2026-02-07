import fc from 'fast-check';
import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus, AssetTokenError } from '../../../src/lib/contracts/asset-token';
import { UserRole } from '../../../shared-types/src/entities';

/**
 * Property-Based Test for Asset Tokenization Completeness
 * 
 * **Feature: rwa-lending-protocol, Property 1: Asset tokenization completeness**
 * **Validates: Requirements 1.1, 1.2**
 * 
 * Property: For any valid asset submission with complete documentation and verification,
 * the tokenization process should create an Asset_Token with all required fields populated correctly
 */

describe('Property-Based Test: Asset Tokenization Completeness', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users
    assetTokenFactory.registerUser('owner_address', UserRole.USER);
    assetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
    assetTokenFactory.registerUser('admin_address', UserRole.ADMIN);
  });

  /**
   * Property Test: Complete asset tokenization creates valid tokens
   * 
   * For any valid asset creation parameters with complete documentation and verification:
   * 1. A unique token ID should be generated
   * 2. All asset data should be stored correctly
   * 3. The token should be assigned to the correct owner
   * 4. The verification status should be determined correctly
   */
  test('Property 1: Asset tokenization completeness - valid assets create complete tokens', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate random asset types
        fc.constantFrom(...Object.values(AssetType)),
        // Generate random valuations (minimum $1000 to $1,000,000)
        fc.bigInt({ min: BigInt(100000), max: BigInt(100000000) }), // $1000 to $1M in cents
        // Generate random compliance status
        fc.record({
          kycCompleted: fc.boolean(),
          documentationComplete: fc.boolean(),
          valuationVerified: fc.boolean(),
          legalClearance: fc.boolean(),
        }),
        async (
          assetType: AssetType,
          valuation: bigint,
          complianceChecks: any
        ) => {
          // Create valid asset creation parameters
          const params: AssetCreationParams = {
            assetType,
            owner: 'owner_address',
            initialValuation: valuation,
            metadata: {
              description: 'Valid Asset Description for Testing',
              location: 'Valid Location for Testing',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000, // 1 day ago
              specifications: { category: 'test', verified: true },
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Property test verification',
              complianceChecks,
            },
          };

          // Action: Tokenize the asset
          const tokenData = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Verification: Check token was created correctly
          
          // 1. Asset token should be returned with all required fields
          expect(tokenData).toBeDefined();
          expect(typeof tokenData).toBe('object');
          expect(tokenData.tokenId).toBeDefined();
          expect(typeof tokenData.tokenId).toBe('string');
          expect(tokenData.tokenId.length).toBeGreaterThan(0);

          // 2. Asset data should be retrievable and complete
          const retrievedTokenData = assetTokenFactory.getTokenData(tokenData.tokenId);
          expect(retrievedTokenData).toBeDefined();
          expect(retrievedTokenData!.tokenId).toBe(tokenData.tokenId);
          expect(retrievedTokenData!.assetType).toBe(assetType);
          expect(retrievedTokenData!.owner).toBe('owner_address');
          expect(retrievedTokenData!.valuation).toBe(valuation);

          // 3. Metadata should be stored correctly
          expect(retrievedTokenData!.metadata.description).toBe('Valid Asset Description for Testing');
          expect(retrievedTokenData!.metadata.location).toBe('Valid Location for Testing');
          expect(retrievedTokenData!.metadata.appraisalValue).toBe(valuation);

          // 4. Timestamps should be set
          expect(retrievedTokenData!.createdAt).toBeGreaterThan(0);
          expect(retrievedTokenData!.lastUpdated).toBeGreaterThan(0);

          // 5. Token should not be locked initially
          expect(retrievedTokenData!.isLocked).toBe(false);
          expect(retrievedTokenData!.loanId).toBeUndefined();

          // 6. Verification status should be determined correctly
          const expectedStatus = (
            complianceChecks.kycCompleted &&
            complianceChecks.documentationComplete &&
            complianceChecks.valuationVerified &&
            complianceChecks.legalClearance
          ) ? VerificationStatus.Approved : VerificationStatus.Pending;
          
          expect(retrievedTokenData!.verificationStatus).toBe(expectedStatus);

          // 7. Token should be assigned to owner
          const ownerTokens = assetTokenFactory.getOwnerTokens('owner_address');
          expect(ownerTokens).toContain(tokenData.tokenId);

          // 8. Ownership verification should work
          expect(assetTokenFactory.verifyOwnership(tokenData.tokenId, 'owner_address')).toBe(true);
          expect(assetTokenFactory.verifyOwnership(tokenData.tokenId, 'other_address')).toBe(false);
        }
      ),
      { 
        numRuns: 100, // Run 100 iterations as specified in design document
        verbose: true,
        seed: 42, // Fixed seed for reproducible tests
      }
    );
  });

  /**
   * Property Test: Invalid asset data is rejected
   * 
   * For any asset creation parameters with invalid data, the tokenization should fail
   */
  test('Property 1: Asset tokenization completeness - invalid assets are rejected', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate invalid scenarios - valuation too low
        fc.bigInt({ min: BigInt(1), max: BigInt(99999) }), // Below $1000 minimum
        async (lowValuation: bigint) => {
          // Create invalid asset creation parameters
          const params: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'owner_address',
            initialValuation: lowValuation,
            metadata: {
              description: 'Valid description for testing',
              location: 'Valid location for testing',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: lowValuation,
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

          // Action & Verification: Tokenization should fail
          await expect(
            assetTokenFactory.tokenizeAsset(params, 'verifier_address')
          ).rejects.toThrow(AssetTokenError);
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 123,
      }
    );
  });

  /**
   * Property Test: Multiple tokenizations create unique tokens
   * 
   * For any sequence of valid asset tokenizations, each should create a unique token
   */
  test('Property 1: Asset tokenization completeness - multiple tokenizations create unique tokens', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate array of asset creation scenarios
        fc.array(
          fc.record({
            assetType: fc.constantFrom(...Object.values(AssetType)),
            valuation: fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (assetScenarios: any[]) => {
          // Create fresh factory instance for this property test run
          const testFactory = new AssetTokenFactory();
          testFactory.registerUser('owner_address', UserRole.USER);
          testFactory.registerUser('verifier_address', UserRole.VERIFIER);
          testFactory.registerUser('admin_address', UserRole.ADMIN);
          
          const tokenIds: string[] = [];

          // Action: Create multiple assets
          for (let i = 0; i < assetScenarios.length; i++) {
            const scenario = assetScenarios[i];
            const params: AssetCreationParams = {
              assetType: scenario.assetType,
              owner: 'owner_address',
              initialValuation: scenario.valuation,
              metadata: {
                description: `Valid description ${i}`,
                location: `Valid location ${i}`,
                documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
                appraisalValue: scenario.valuation,
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

            const assetToken = await testFactory.tokenizeAsset(params, 'verifier_address');
            tokenIds.push(assetToken.tokenId);
          }

          // Verification: All token IDs should be unique
          const uniqueTokenIds = new Set(tokenIds);
          expect(uniqueTokenIds.size).toBe(tokenIds.length);

          // Each token should be retrievable and valid
          for (const tokenId of tokenIds) {
            const tokenData = testFactory.getTokenData(tokenId);
            expect(tokenData).toBeDefined();
            if (tokenData) {
              expect(tokenData.tokenId).toBe(tokenId);
              expect(tokenData.verificationStatus).toBe(VerificationStatus.Approved);
            }
          }
        }
      ),
      { 
        numRuns: 20,
        verbose: true,
        seed: 456,
      }
    );
  });

  /**
   * Property Test: Asset tokenization with different compliance states
   * 
   * For any compliance check combination, the verification status should be determined correctly
   */
  test('Property 1: Asset tokenization completeness - compliance status determines verification', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate all possible compliance check combinations
        fc.record({
          kycCompleted: fc.boolean(),
          documentationComplete: fc.boolean(),
          valuationVerified: fc.boolean(),
          legalClearance: fc.boolean(),
        }),
        fc.bigInt({ min: BigInt(100000), max: BigInt(1000000) }),
        async (complianceChecks: any, valuation: bigint) => {
          // Create asset with specific compliance status
          const params: AssetCreationParams = {
            assetType: AssetType.RealEstate,
            owner: 'owner_address',
            initialValuation: valuation,
            metadata: {
              description: 'Test asset for compliance verification',
              location: 'Test location',
              documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
              appraisalValue: valuation,
              appraisalDate: Date.now() - 86400000,
              specifications: {},
            },
            verification: {
              verifier: 'verifier_address',
              verificationDate: Date.now(),
              notes: 'Compliance test',
              complianceChecks,
            },
          };

          // Action: Tokenize asset
          const tokenData = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
          const tokenId = tokenData.tokenId;

          // Verification: Check verification status is correct
          const retrievedTokenData = assetTokenFactory.getTokenData(tokenData.tokenId);
          expect(retrievedTokenData).toBeDefined();
          
          if (!retrievedTokenData) {
            throw new Error(`Token data not found for tokenId: ${tokenData.tokenId}`);
          }

          const expectedStatus = (
            complianceChecks.kycCompleted &&
            complianceChecks.documentationComplete &&
            complianceChecks.valuationVerified &&
            complianceChecks.legalClearance
          ) ? VerificationStatus.Approved : VerificationStatus.Pending;

          expect(retrievedTokenData.verificationStatus).toBe(expectedStatus);

          // Additional verification: Only approved assets should be transferable
          if (expectedStatus === VerificationStatus.Approved) {
            // Should be able to transfer approved assets
            assetTokenFactory.registerUser('recipient_address', UserRole.USER);
            await expect(
              assetTokenFactory.transferToken(tokenData.tokenId, 'recipient_address', 'owner_address')
            ).resolves.not.toThrow();
          } else {
            // Should not be able to transfer pending assets
            assetTokenFactory.registerUser('recipient_address', UserRole.USER);
            await expect(
              assetTokenFactory.transferToken(tokenData.tokenId, 'recipient_address', 'owner_address')
            ).rejects.toThrow('Only verified assets can be transferred');
          }
        }
      ),
      { 
        numRuns: 30,
        verbose: true,
        seed: 789,
      }
    );
  });
});