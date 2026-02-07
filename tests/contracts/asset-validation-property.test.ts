import fc from 'fast-check';
import { AssetRegistryService } from '../../../src/lib/contracts/asset-registry';
import { AssetType } from '../../../src/lib/contracts/asset-token';
import { UserRole } from '../../../shared-types/src/entities';
import { DocumentMetadata } from '../../../src/lib/services/ipfs-service';

// Mock the Asset model
jest.mock('../../database/models/Asset', () => {
  return require('../__mocks__/Asset');
});

/**
 * Property-Based Test for Asset Validation
 * 
 * **Feature: rwa-lending-protocol, Property 2: Invalid asset rejection**
 * **Validates: Requirements 1.3**
 * 
 * Property: For any asset submission with incomplete or invalid documentation,
 * the tokenization process should reject the submission and provide appropriate error feedback
 */

describe('Property-Based Test: Asset Validation', () => {
  let assetRegistry: AssetRegistryService;

  beforeEach(() => {
    // Clear mocks before each test
    const { Asset } = require('../__mocks__/Asset');
    Asset.clearMocks();
    
    assetRegistry = new AssetRegistryService();
    
    // Register test users
    assetRegistry.registerUser('owner_address', UserRole.USER);
    assetRegistry.registerUser('verifier_address', UserRole.VERIFIER);
    assetRegistry.registerUser('admin_address', UserRole.ADMIN);
  });

  /**
   * Property Test: Invalid asset documentation is rejected
   * 
   * For any asset submission with invalid or incomplete documentation:
   * 1. The submission should be rejected
   * 2. Appropriate error feedback should be provided
   * 3. No asset token should be created
   */
  test('Property 2: Invalid asset rejection - incomplete documentation rejected', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate invalid document scenarios
        fc.record({
          hasEmptyDescription: fc.boolean(),
          hasEmptyLocation: fc.boolean(),
          hasNoDocuments: fc.boolean(),
          hasInvalidIPFSHash: fc.boolean(),
          hasZeroValuation: fc.boolean(),
          hasFutureAppraisalDate: fc.boolean(),
        }),
        fc.constantFrom(...Object.values(AssetType)),
        async (invalidScenario: any, assetType: AssetType) => {
          // Skip valid scenarios (we want to test invalid ones)
          if (!Object.values(invalidScenario).some(Boolean)) {
            return; // All false means valid scenario, skip
          }

          // Create invalid asset data based on scenario
          const assetData = {
            assetType,
            owner: 'owner_address',
            metadata: {
              title: 'Test Asset',
              description: invalidScenario.hasEmptyDescription ? '' : 'Valid description',
              location: {
                address: invalidScenario.hasEmptyLocation ? '' : 'Valid location',
                coordinates: { lat: -1.2921, lng: 36.8219 },
              },
              valuation: {
                amount: invalidScenario.hasZeroValuation ? 0 : 50000,
                currency: 'USD',
                appraiser: 'test_appraiser',
              },
              documents: invalidScenario.hasNoDocuments ? [] : [
                {
                  type: 'deed' as const,
                  ipfsHash: invalidScenario.hasInvalidIPFSHash ? 'invalid_hash' : 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51',
                  fileName: 'test_deed.pdf',
                  uploadDate: invalidScenario.hasFutureAppraisalDate ? 
                    new Date(Date.now() + 86400000) : // Future date
                    new Date(Date.now() - 86400000),   // Past date
                },
              ],
              specifications: {},
            },
          };

          // Action & Verification: Submission should be rejected
          await expect(
            assetRegistry.submitAssetForTokenization(assetData, 'owner_address')
          ).rejects.toThrow();

          // Verify no tokens were created for the owner
          const ownerTokens = await assetRegistry.getAssetsByOwner('owner_address');
          expect(ownerTokens.length).toBe(0);
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
   * Property Test: Invalid IPFS document hashes are rejected
   * 
   * For any document with invalid IPFS hash format, the upload should fail
   */
  test('Property 2: Invalid asset rejection - invalid IPFS hashes rejected', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate invalid IPFS hash formats
        fc.oneof(
          fc.constant(''), // Empty hash
          fc.string({ minLength: 1, maxLength: 20 }), // Too short
          fc.string({ minLength: 100, maxLength: 200 }), // Too long
          fc.string().filter(s => !s.startsWith('Qm')), // Wrong prefix
          fc.constant('Qm' + 'x'.repeat(44)), // Invalid characters
        ),
        async (invalidHash: string) => {
          // Create document with invalid hash
          const documentMetadata: DocumentMetadata = {
            fileName: 'test_document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: 'owner_address',
            uploadDate: new Date(),
            documentType: 'deed',
          };

          const mockBuffer = Buffer.from('test document content');

          // Action & Verification: Upload should fail for invalid hash
          const ipfsService = assetRegistry.getIPFSService();
          
          // We can't directly test invalid hash in upload (it generates the hash)
          // But we can test retrieval with invalid hash
          await expect(
            ipfsService.getDocument(invalidHash)
          ).rejects.toThrow();
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
   * Property Test: Assets with insufficient valuation are rejected
   * 
   * For any asset with valuation below minimum threshold, tokenization should fail
   */
  test('Property 2: Invalid asset rejection - insufficient valuation rejected', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate valuations below minimum threshold ($1000)
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom(...Object.values(AssetType)),
        async (lowValuation: number, assetType: AssetType) => {
          // Create asset with low valuation
          const assetData = {
            assetType,
            owner: 'owner_address',
            metadata: {
              title: 'Low Value Asset',
              description: 'Asset with valuation below minimum threshold',
              location: {
                address: 'Test Location',
                coordinates: { lat: -1.2921, lng: 36.8219 },
              },
              valuation: {
                amount: lowValuation,
                currency: 'USD',
                appraiser: 'test_appraiser',
              },
              documents: [
                {
                  type: 'deed' as const,
                  ipfsHash: 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51',
                  fileName: 'test_deed.pdf',
                  uploadDate: new Date(Date.now() - 86400000),
                },
              ],
              specifications: {},
            },
          };

          // Action & Verification: Submission should fail due to low valuation
          await expect(
            assetRegistry.submitAssetForTokenization(assetData, 'owner_address')
          ).rejects.toThrow('Asset value below minimum threshold');
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
   * Property Test: Incomplete compliance checks prevent tokenization
   * 
   * For any asset with incomplete compliance checks, tokenization should be rejected
   */
  test('Property 2: Invalid asset rejection - incomplete compliance checks rejected', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate incomplete compliance scenarios
        fc.record({
          kycCompleted: fc.boolean(),
          documentationComplete: fc.boolean(),
          valuationVerified: fc.boolean(),
          legalClearance: fc.boolean(),
        }).filter(checks => 
          // Ensure at least one check is false (incomplete)
          !checks.kycCompleted || !checks.documentationComplete || 
          !checks.valuationVerified || !checks.legalClearance
        ),
        fc.constantFrom(...Object.values(AssetType)),
        fc.integer({ min: 1000, max: 100000 }), // Valid valuation range
        async (incompleteChecks: any, assetType: AssetType, valuation: number) => {
          // Create valid asset data
          const assetData = {
            assetType,
            owner: 'owner_address',
            metadata: {
              title: 'Test Asset with Incomplete Compliance',
              description: 'Valid asset description',
              location: {
                address: 'Valid location',
                coordinates: { lat: -1.2921, lng: 36.8219 },
              },
              valuation: {
                amount: valuation,
                currency: 'USD',
                appraiser: 'test_appraiser',
              },
              documents: [
                {
                  type: 'deed' as const,
                  ipfsHash: 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51',
                  fileName: 'test_deed.pdf',
                  uploadDate: new Date(Date.now() - 86400000),
                },
              ],
              specifications: {},
            },
          };

          // Submit asset for tokenization
          const assetId = await assetRegistry.submitAssetForTokenization(assetData, 'owner_address');

          // Set compliance checks according to the incomplete scenario
          if (incompleteChecks.kycCompleted) {
            await assetRegistry.updateComplianceCheck(assetId, 'kycCompleted', true, 'verifier_address');
          }
          if (incompleteChecks.documentationComplete) {
            await assetRegistry.updateComplianceCheck(assetId, 'documentationComplete', true, 'verifier_address');
          }
          if (incompleteChecks.valuationVerified) {
            await assetRegistry.updateComplianceCheck(assetId, 'valuationVerified', true, 'verifier_address');
          }
          if (incompleteChecks.legalClearance) {
            await assetRegistry.updateComplianceCheck(assetId, 'legalClearance', true, 'verifier_address');
          }

          // Action & Verification: Tokenization should fail due to incomplete compliance
          await expect(
            assetRegistry.completeVerificationAndTokenize(assetId, 'verifier_address')
          ).rejects.toThrow('All compliance checks must be completed');

          // Verify no token was created
          const ownerTokens = await assetRegistry.getAssetsByOwner('owner_address');
          expect(ownerTokens.length).toBe(0);
        }
      ),
      { 
        numRuns: 50,
        verbose: true,
        seed: 789,
      }
    );
  });

  /**
   * Property Test: Document verification with missing required documents
   * 
   * For any asset type, missing required documents should be detected and reported
   */
  test('Property 2: Invalid asset rejection - missing required documents detected', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.values(AssetType)),
        async (assetType: AssetType) => {
          // Upload incomplete document set (only one document when multiple may be required)
          const documentMetadata: DocumentMetadata = {
            fileName: 'single_document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: 'owner_address',
            uploadDate: new Date(),
            documentType: 'other', // Generic type, may not satisfy requirements
          };

          const mockBuffer = Buffer.from('test document content');
          const ipfsService = assetRegistry.getIPFSService();

          // Upload single document
          const uploadResult = await ipfsService.uploadDocument(mockBuffer, documentMetadata);
          const documentHashes = [uploadResult.hash];

          // Action: Verify documents for asset type
          const verificationResult = await assetRegistry.verifyAssetDocuments(
            documentHashes,
            'verifier_address',
            assetType
          );

          // Verification: For asset types requiring multiple documents, verification should indicate missing documents
          if (assetType === AssetType.RealEstate) {
            // Real estate typically requires deed, appraisal, insurance
            expect(verificationResult.verified).toBe(false);
            expect(verificationResult.missingDocuments.length).toBeGreaterThan(0);
          }

          // The verification should always complete without throwing errors
          expect(verificationResult).toBeDefined();
          expect(typeof verificationResult.verified).toBe('boolean');
          expect(Array.isArray(verificationResult.missingDocuments)).toBe(true);
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
   * Property Test: Unauthorized users cannot perform verification actions
   * 
   * For any verification action, only authorized users should be able to perform it
   */
  test('Property 2: Invalid asset rejection - unauthorized verification rejected', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('unauthorized_user', 'random_address', 'fake_verifier'),
        async (unauthorizedUser: string) => {
          // Register unauthorized user (not as verifier or admin)
          assetRegistry.registerUser(unauthorizedUser, UserRole.USER);

          // Create valid asset data
          const assetData = {
            assetType: AssetType.RealEstate,
            owner: 'owner_address',
            metadata: {
              title: 'Test Asset',
              description: 'Valid asset description',
              location: {
                address: 'Valid location',
                coordinates: { lat: -1.2921, lng: 36.8219 },
              },
              valuation: {
                amount: 50000,
                currency: 'USD',
                appraiser: 'test_appraiser',
              },
              documents: [
                {
                  type: 'deed' as const,
                  ipfsHash: 'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51',
                  fileName: 'test_deed.pdf',
                  uploadDate: new Date(Date.now() - 86400000),
                },
              ],
              specifications: {},
            },
          };

          // Submit asset for tokenization
          const assetId = await assetRegistry.submitAssetForTokenization(assetData, 'owner_address');

          // Action & Verification: Unauthorized user should not be able to update compliance checks
          await expect(
            assetRegistry.updateComplianceCheck(assetId, 'kycCompleted', true, unauthorizedUser)
          ).rejects.toThrow('Only verifiers can update compliance checks');

          // Action & Verification: Unauthorized user should not be able to complete verification
          await expect(
            assetRegistry.completeVerificationAndTokenize(assetId, unauthorizedUser)
          ).rejects.toThrow('Only verifiers can complete verification');
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