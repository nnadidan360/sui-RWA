import { AssetTokenFactory, AssetCreationParams, AssetType, VerificationStatus } from '../asset-token';
import { UserRole } from '../../../types/auth';

describe('Asset Ownership - Basic Tests', () => {
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    
    // Register test users
    assetTokenFactory.registerUser('owner_address', UserRole.USER);
    assetTokenFactory.registerUser('recipient_address', UserRole.USER);
    assetTokenFactory.registerUser('verifier_address', UserRole.VERIFIER);
    assetTokenFactory.registerUser('admin_address', UserRole.ADMIN);
  });

  test('should assign ownership correctly upon asset creation', async () => {
    const params: AssetCreationParams = {
      assetType: AssetType.RealEstate,
      owner: 'owner_address',
      initialValuation: BigInt(100000),
      metadata: {
        description: 'Test asset',
        location: 'Test location',
        documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
        appraisalValue: BigInt(100000),
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

    const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
    const tokenId = assetToken.tokenId;

    // Verify ownership
    const tokenData = assetTokenFactory.getTokenData(tokenId);
    expect(tokenData).toBeDefined();
    expect(tokenData!.owner).toBe('owner_address');
    
    // Verify ownership verification methods
    expect(assetTokenFactory.verifyOwnership(tokenId, 'owner_address')).toBe(true);
    expect(assetTokenFactory.verifyOwnership(tokenId, 'other_address')).toBe(false);
    
    // Verify owner token list
    const ownerTokens = assetTokenFactory.getOwnerTokens('owner_address');
    expect(ownerTokens).toContain(tokenId);
  });

  test('should transfer ownership correctly', async () => {
    // Create asset
    const params: AssetCreationParams = {
      assetType: AssetType.Equipment,
      owner: 'owner_address',
      initialValuation: BigInt(150000), // $1500
      metadata: {
        description: 'Test equipment',
        location: 'Test location',
        documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
        appraisalValue: BigInt(150000),
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

    const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
    const tokenId = assetToken.tokenId;

    // Transfer ownership
    await assetTokenFactory.transferToken(tokenId, 'recipient_address', 'owner_address');

    // Verify ownership changed
    const tokenData = assetTokenFactory.getTokenData(tokenId);
    expect(tokenData!.owner).toBe('recipient_address');
    
    // Verify ownership verification methods
    expect(assetTokenFactory.verifyOwnership(tokenId, 'recipient_address')).toBe(true);
    expect(assetTokenFactory.verifyOwnership(tokenId, 'owner_address')).toBe(false);
    
    // Verify token lists updated
    const originalOwnerTokens = assetTokenFactory.getOwnerTokens('owner_address');
    const newOwnerTokens = assetTokenFactory.getOwnerTokens('recipient_address');
    expect(originalOwnerTokens).not.toContain(tokenId);
    expect(newOwnerTokens).toContain(tokenId);
  });

  test('should reject unauthorized transfers', async () => {
    // Create asset
    const params: AssetCreationParams = {
      assetType: AssetType.Commodity,
      owner: 'owner_address',
      initialValuation: BigInt(175000), // $1750
      metadata: {
        description: 'Test commodity',
        location: 'Test location',
        documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
        appraisalValue: BigInt(175000),
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

    const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
    const tokenId = assetToken.tokenId;

    // Try unauthorized transfer
    await expect(
      assetTokenFactory.transferToken(tokenId, 'recipient_address', 'recipient_address')
    ).rejects.toThrow('Only token owner can transfer asset');

    // Verify ownership unchanged
    expect(assetTokenFactory.verifyOwnership(tokenId, 'owner_address')).toBe(true);
    expect(assetTokenFactory.verifyOwnership(tokenId, 'recipient_address')).toBe(false);
  });

  test('should allow admin to transfer any asset', async () => {
    // Create asset
    const params: AssetCreationParams = {
      assetType: AssetType.Invoice,
      owner: 'owner_address',
      initialValuation: BigInt(125000), // $1250
      metadata: {
        description: 'Test invoice',
        location: 'Test location',
        documentHashes: ['QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51'],
        appraisalValue: BigInt(125000),
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

    const assetToken = await assetTokenFactory.tokenizeAsset(params, 'verifier_address');
    const tokenId = assetToken.tokenId;

    // Admin transfer
    await assetTokenFactory.transferToken(tokenId, 'recipient_address', 'admin_address');

    // Verify ownership changed
    expect(assetTokenFactory.verifyOwnership(tokenId, 'recipient_address')).toBe(true);
    expect(assetTokenFactory.verifyOwnership(tokenId, 'owner_address')).toBe(false);
  });
});