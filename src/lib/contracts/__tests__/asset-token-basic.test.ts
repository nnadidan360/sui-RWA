import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

describe('Asset Token Factory - Basic Tests', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users
    assetTokenFactory.registerUser('owner_address', UserRole.USER);
    assetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
    assetTokenFactory.registerUser('admin_address', UserRole.ADMIN);
  });

  test('should create a single asset token successfully', async () => {
    const params: AssetCreationParams = {
      assetType: AssetType.RealEstate,
      owner: 'owner_address',
      initialValuation: BigInt(100000), // $1000
      metadata: {
        description: 'Test Real Estate Asset',
        location: 'Test Location',
        documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
        appraisalValue: BigInt(100000),
        appraisalDate: Date.now() - 86400000, // 1 day ago
        specifications: { category: 'residential', verified: true },
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

    const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');

    expect(assetToken).toBeDefined();
    expect(typeof assetToken).toBe('object');
    expect(assetToken.tokenId).toBeDefined();
    expect(typeof assetToken.tokenId).toBe('string');

    const tokenData = assetTokenFactory.getTokenData(assetToken.tokenId);
    expect(tokenData).toBeDefined();
    expect(tokenData!.tokenId).toBe(assetToken.tokenId);
    expect(tokenData!.assetType).toBe(AssetType.RealEstate);
    expect(tokenData!.owner).toBe('owner_address');
    expect(tokenData!.verificationStatus).toBe(VerificationStatus.Approved);
  });

  test('should create multiple unique asset tokens', async () => {
    const tokenIds: string[] = [];

    for (let i = 0; i < 3; i++) {
      const params: AssetCreationParams = {
        assetType: AssetType.RealEstate,
        owner: 'owner_address',
        initialValuation: BigInt(100000 + i * 1000),
        metadata: {
          description: `Test Asset ${i}`,
          location: `Test Location ${i}`,
          documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
          appraisalValue: BigInt(100000 + i * 1000),
          appraisalDate: Date.now() - 86400000,
          specifications: { category: 'test', index: i },
        },
        verification: {
          verifier: 'verifier_address',
          verificationDate: Date.now(),
          notes: `Test verification ${i}`,
          complianceChecks: {
            kycCompleted: true,
            documentationComplete: true,
            valuationVerified: true,
            legalClearance: true,
          },
        },
      };

      const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
      tokenIds.push(assetToken.tokenId);
    }

    // All token IDs should be unique
    const uniqueTokenIds = new Set(tokenIds);
    expect(uniqueTokenIds.size).toBe(tokenIds.length);

    // All tokens should be retrievable
    for (const tokenId of tokenIds) {
      const tokenData = assetTokenFactory.getTokenData(tokenId);
      expect(tokenData).toBeDefined();
      expect(tokenData!.tokenId).toBe(tokenId);
    }
  });
});