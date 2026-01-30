/**
 * Asset Registry Service
 * 
 * This service handles asset verification workflows, IPFS integration,
 * and asset valuation updates. It bridges the smart contract logic
 * with the database and external services.
 */

import { Asset } from '../database/models/Asset';
import { AssetTokenFactory, AssetCreationParams, AssetTokenData, AssetType, ValuationUpdate } from './asset-token';
import { AccessControl } from '../auth/access-control';
import { UserRole, User } from '../../types/auth';
import { IPFSService, IPFSDocument as IPFSServiceDocument, DocumentMetadata } from '../services/ipfs-service';
import { AssetValuationService, ValuationData } from '../services/asset-valuation';

export interface IPFSDocument {
  type: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other';
  ipfsHash: string;
  fileName: string;
  uploadDate: Date;
  verifiedBy?: string;
  verificationDate?: Date;
}

export interface AssetVerificationWorkflow {
  assetId: string;
  currentStep: 'documentation' | 'valuation' | 'legal' | 'final_review';
  assignedVerifier?: string;
  notes: string[];
  estimatedCompletion: Date;
}

export class AssetRegistryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AssetRegistryError';
  }
}

/**
 * Asset Registry Service
 * 
 * Manages the complete asset lifecycle from submission to tokenization
 */
export class AssetRegistryService {
  private assetTokenFactory: AssetTokenFactory;
  private ipfsService: IPFSService;
  private valuationService: AssetValuationService;
  private userRegistry: Map<string, User> = new Map();

  constructor() {
    this.assetTokenFactory = new AssetTokenFactory();
    this.ipfsService = new IPFSService();
    this.valuationService = new AssetValuationService();
    this.initializeMockUsers();
  }

  /**
   * Register a user for testing purposes
   */
  registerUser(address: string, role: UserRole): void {
    const user: User = {
      id: `user_${address}`,
      address,
      role,
      isActive: true,
      createdAt: new Date(),
    };
    this.userRegistry.set(address, user);
    this.assetTokenFactory.registerUser(address, role);
    this.valuationService.registerUser(address, role);
  }

  /**
   * Get user by address
   */
  private getUser(address: string): User | null {
    return this.userRegistry.get(address) || null;
  }

  /**
   * Upload asset documents to IPFS
   */
  async uploadAssetDocuments(
    files: Array<{ buffer: Buffer; metadata: DocumentMetadata }>,
    caller: string
  ): Promise<string[]> {
    const user = this.getUser(caller);
    
    // Check caller permissions
    if (!AccessControl.hasRole(user, UserRole.USER) && 
        !AccessControl.hasRole(user, UserRole.VERIFIER) &&
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Insufficient permissions to upload documents');
    }

    try {
      const uploadResults = await this.ipfsService.uploadMultipleDocuments(files);
      return uploadResults.map(result => result.hash);
    } catch (error) {
      throw new AssetRegistryError('UPLOAD_FAILED', `Failed to upload documents: ${error}`);
    }
  }

  /**
   * Verify asset documents
   */
  async verifyAssetDocuments(
    documentHashes: string[],
    verifier: string,
    assetType: AssetType
  ): Promise<{ verified: boolean; missingDocuments: string[] }> {
    const user = this.getUser(verifier);
    
    // Check verifier permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Only verifiers can verify documents');
    }

    // Get documents from IPFS
    const documents = await this.ipfsService.getAssetDocuments(documentHashes);
    
    // Validate document completeness
    const completenessCheck = this.ipfsService.validateDocumentCompleteness(
      assetType.toString(),
      documents
    );

    // Verify each document
    for (const document of documents) {
      await this.ipfsService.verifyDocument(
        document.hash,
        verifier,
        'verified',
        'Document verified for asset tokenization'
      );
    }

    return {
      verified: completenessCheck.isComplete,
      missingDocuments: completenessCheck.missingDocuments,
    };
  }

  /**
   * Get market valuation estimate for asset
   */
  async getMarketValuationEstimate(
    assetType: AssetType,
    location: string,
    size: number
  ): Promise<{ estimatedValue: number; confidence: string; factors: any[] }> {
    return await this.valuationService.getMarketValuationEstimate(assetType, location, size);
  }

  /**
   * Create comprehensive asset valuation
   */
  async createAssetValuation(
    assetId: string,
    assetType: AssetType,
    valuationAmount: number,
    appraiser: string,
    methodology: string,
    caller: string
  ): Promise<ValuationData> {
    return await this.valuationService.createInitialValuation(
      assetId,
      assetType,
      valuationAmount,
      appraiser,
      methodology,
      caller
    );
  }
  /**
   * Submit asset for tokenization
   * Creates database record and initiates verification workflow
   */
  async submitAssetForTokenization(
    assetData: {
      assetType: AssetType;
      owner: string;
      metadata: {
        title: string;
        description: string;
        location: {
          address: string;
          coordinates: { lat: number; lng: number };
        };
        valuation: {
          amount: number;
          currency: string;
          appraiser?: string;
        };
        documents: IPFSDocument[];
        specifications?: Record<string, any>;
      };
    },
    caller: string
  ): Promise<string> {
    const user = this.getUser(caller);
    
    // Validate caller permissions
    if (!AccessControl.hasRole(user, UserRole.USER) && caller !== assetData.owner) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Only asset owner can submit for tokenization');
    }

    // Validate asset data
    this.validateAssetSubmission(assetData);

    // Create database record
    const asset = new Asset({
      tokenId: '', // Will be set after tokenization
      assetType: assetData.assetType,
      owner: assetData.owner,
      metadata: {
        title: assetData.metadata.title,
        description: assetData.metadata.description,
        location: assetData.metadata.location,
        valuation: {
          amount: assetData.metadata.valuation.amount,
          currency: assetData.metadata.valuation.currency,
          date: new Date(),
          appraiser: assetData.metadata.valuation.appraiser,
        },
        documents: assetData.metadata.documents.map((doc: IPFSDocument) => ({
          type: doc.type,
          ipfsHash: doc.ipfsHash,
          fileName: doc.fileName,
          uploadDate: doc.uploadDate,
        })),
        specifications: assetData.metadata.specifications,
      },
      verification: {
        status: 'pending',
        complianceChecks: {
          kycCompleted: false,
          documentationComplete: false,
          valuationVerified: false,
          legalClearance: false,
        },
      },
      financialData: {
        currentValue: assetData.metadata.valuation.amount,
        valueHistory: [{
          value: assetData.metadata.valuation.amount,
          date: new Date(),
          source: 'initial_submission',
        }],
        utilizationInLoans: [],
      },
      auditTrail: [{
        action: 'asset_submitted',
        performedBy: caller,
        timestamp: new Date(),
        details: { assetType: assetData.assetType },
      }],
    });

    await asset.save();

    return asset._id.toString();
  }

  /**
   * Complete asset verification and tokenize
   * Only called after all compliance checks pass
   */
  async completeVerificationAndTokenize(
    assetId: string,
    verifier: string
  ): Promise<string> {
    const user = this.getUser(verifier);
    
    // Check verifier permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Only verifiers can complete verification');
    }

    // Get asset from database
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new AssetRegistryError('ASSET_NOT_FOUND', `Asset ${assetId} not found`);
    }

    // Check all compliance checks are complete
    const checks = asset.verification.complianceChecks;
    if (!checks.kycCompleted || !checks.documentationComplete || 
        !checks.valuationVerified || !checks.legalClearance) {
      throw new AssetRegistryError('COMPLIANCE_INCOMPLETE', 'All compliance checks must be completed');
    }

    // Check minimum valuation threshold
    if (asset.metadata.valuation.amount < 1000) {
      throw new AssetRegistryError('VALUATION_TOO_LOW', 'Asset value below minimum threshold');
    }

    // Prepare tokenization parameters
    const tokenizationParams: AssetCreationParams = {
      assetType: asset.assetType as AssetType,
      owner: asset.owner,
      initialValuation: BigInt(asset.metadata.valuation.amount * 100), // Convert to cents
      metadata: {
        description: asset.metadata.description,
        location: asset.metadata.location?.address || '',
        documentHashes: asset.metadata.documents.map((doc: any) => doc.ipfsHash),
        appraisalValue: BigInt(asset.metadata.valuation.amount * 100),
        appraisalDate: asset.metadata.valuation.date.getTime(),
        specifications: asset.metadata.specifications || {},
      },
      verification: {
        verifier,
        verificationDate: Date.now(),
        notes: asset.verification.notes || '',
        complianceChecks: {
          kycCompleted: checks.kycCompleted,
          documentationComplete: checks.documentationComplete,
          valuationVerified: checks.valuationVerified,
          legalClearance: checks.legalClearance,
        },
      },
    };

    // Tokenize asset
    const tokenId = await this.assetTokenFactory.tokenizeAsset(tokenizationParams, verifier);

    // Update database record
    asset.tokenId = tokenId;
    asset.verification.status = 'approved';
    asset.verification.verifiedBy = verifier;
    asset.verification.verificationDate = new Date();
    asset.onChainData = {
      contractAddress: 'asset_token_factory', // Would be actual contract address
      blockNumber: 0, // Would be actual block number
      transactionHash: `tx_${tokenId}`, // Would be actual transaction hash
      mintedAt: new Date(),
    };
    asset.auditTrail.push({
      action: 'asset_tokenized',
      performedBy: verifier,
      timestamp: new Date(),
      details: { tokenId },
    });

    await asset.save();

    return tokenId.tokenId;
  }

  /**
   * Update asset valuation with market validation
   */
  async updateAssetValuation(
    tokenId: string,
    newValuation: number,
    appraiser: string,
    methodology: string,
    marketFactors: any[],
    notes: string,
    caller: string
  ): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Only verifiers can update valuations');
    }

    // Get asset from database
    const asset = await Asset.findOne({ tokenId });
    if (!asset) {
      throw new AssetRegistryError('ASSET_NOT_FOUND', `Asset with token ${tokenId} not found`);
    }

    // Validate against market data
    const marketValidation = await this.valuationService.validateValuationAgainstMarket(
      asset._id.toString(),
      newValuation,
      asset.assetType as AssetType,
      asset.metadata.location?.address || '',
      1000 // Default size, should be from asset metadata
    );

    if (!marketValidation.isValid) {
      throw new AssetRegistryError('VALUATION_INVALID', marketValidation.recommendation);
    }

    // Update valuation in valuation service
    await this.valuationService.updateValuation(
      asset._id.toString(),
      newValuation,
      appraiser,
      methodology,
      marketFactors,
      caller
    );

    // Update valuation in smart contract
    const valuationUpdate: ValuationUpdate = {
      newValuation: BigInt(newValuation * 100), // Convert to cents
      appraiser,
      appraisalDate: Date.now(),
      notes,
    };

    await this.assetTokenFactory.updateValuation(tokenId, valuationUpdate, caller);

    // Update database record
    asset.metadata.valuation.amount = newValuation;
    asset.metadata.valuation.date = new Date();
    asset.metadata.valuation.appraiser = appraiser;
    asset.financialData.currentValue = newValuation;
    asset.financialData.valueHistory.push({
      value: newValuation,
      date: new Date(),
      source: `appraiser_${appraiser}`,
    });
    asset.auditTrail.push({
      action: 'valuation_updated',
      performedBy: caller,
      timestamp: new Date(),
      details: { 
        newValuation, 
        appraiser, 
        notes, 
        marketVariance: marketValidation.variance,
        methodology 
      },
    });

    await asset.save();
  }

  /**
   * Update compliance check status
   */
  async updateComplianceCheck(
    assetId: string,
    checkType: 'kycCompleted' | 'documentationComplete' | 'valuationVerified' | 'legalClearance',
    status: boolean,
    verifier: string,
    notes?: string
  ): Promise<void> {
    const user = this.getUser(verifier);
    
    // Check verifier permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetRegistryError('UNAUTHORIZED', 'Only verifiers can update compliance checks');
    }

    // Get asset from database
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new AssetRegistryError('ASSET_NOT_FOUND', `Asset ${assetId} not found`);
    }

    // Update compliance check
    asset.verification.complianceChecks[checkType] = status;
    
    if (notes) {
      asset.verification.notes = notes;
    }

    // Update verification status based on all checks
    const checks = asset.verification.complianceChecks;
    if (checks.kycCompleted && checks.documentationComplete && 
        checks.valuationVerified && checks.legalClearance) {
      asset.verification.status = 'approved';
    } else if (status === false) {
      asset.verification.status = 'requires_update';
    } else {
      asset.verification.status = 'under_review';
    }

    asset.auditTrail.push({
      action: 'compliance_check_updated',
      performedBy: verifier,
      timestamp: new Date(),
      details: { checkType, status, notes },
    });

    await asset.save();
  }

  /**
   * Get asset data by token ID
   */
  async getAssetByTokenId(tokenId: string): Promise<AssetTokenData | null> {
    return this.assetTokenFactory.getTokenData(tokenId) || null;
  }

  /**
   * Get assets owned by account
   */
  async getAssetsByOwner(owner: string): Promise<AssetTokenData[]> {
    const tokenIds = this.assetTokenFactory.getOwnerTokens(owner);
    const assets: AssetTokenData[] = [];

    for (const tokenId of tokenIds) {
      const asset = this.assetTokenFactory.getTokenData(tokenId);
      if (asset) {
        assets.push(asset);
      }
    }

    return assets;
  }

  /**
   * Get asset verification workflow status
   */
  async getVerificationWorkflow(assetId: string): Promise<AssetVerificationWorkflow | null> {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return null;
    }

    // Determine current step based on compliance checks
    let currentStep: AssetVerificationWorkflow['currentStep'] = 'documentation';
    const checks = asset.verification.complianceChecks;

    if (!checks.documentationComplete) {
      currentStep = 'documentation';
    } else if (!checks.valuationVerified) {
      currentStep = 'valuation';
    } else if (!checks.legalClearance) {
      currentStep = 'legal';
    } else if (!checks.kycCompleted) {
      currentStep = 'final_review';
    } else {
      currentStep = 'final_review';
    }

    return {
      assetId: asset._id.toString(),
      currentStep,
      assignedVerifier: asset.verification.verifiedBy,
      notes: asset.auditTrail.map((entry: any) => entry.details?.notes).filter(Boolean),
      estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };
  }

  /**
   * Lock asset for collateral use
   */
  async lockAssetForCollateral(tokenId: string, loanId: string, caller: string): Promise<void> {
    await this.assetTokenFactory.lockForCollateral(tokenId, loanId, caller);

    // Update database record
    const asset = await Asset.findOne({ tokenId });
    if (asset) {
      asset.financialData.utilizationInLoans.push({
        loanId,
        amount: asset.financialData.currentValue,
        startDate: new Date(),
      });
      asset.auditTrail.push({
        action: 'asset_locked_for_collateral',
        performedBy: caller,
        timestamp: new Date(),
        details: { loanId },
      });
      await asset.save();
    }
  }

  /**
   * Unlock asset from collateral use
   */
  async unlockAssetFromCollateral(tokenId: string, caller: string): Promise<void> {
    await this.assetTokenFactory.unlockFromCollateral(tokenId, caller);

    // Update database record
    const asset = await Asset.findOne({ tokenId });
    if (asset) {
      // Find and update the loan utilization record
      const loanUtilization = asset.financialData.utilizationInLoans.find(
        (loan: any) => !loan.endDate
      );
      if (loanUtilization) {
        loanUtilization.endDate = new Date();
      }

      asset.auditTrail.push({
        action: 'asset_unlocked_from_collateral',
        performedBy: caller,
        timestamp: new Date(),
        details: { loanId: loanUtilization?.loanId },
      });
      await asset.save();
    }
  }

  /**
   * Process automatic revaluation triggers
   */
  async processRevaluationTriggers(): Promise<string[]> {
    return await this.valuationService.processRevaluationTriggers();
  }

  /**
   * Request manual revaluation for an asset
   */
  async requestManualRevaluation(
    tokenId: string,
    reason: string,
    caller: string
  ): Promise<void> {
    // Get asset from database to get internal asset ID
    const asset = await Asset.findOne({ tokenId });
    if (!asset) {
      throw new AssetRegistryError('ASSET_NOT_FOUND', `Asset with token ${tokenId} not found`);
    }

    await this.valuationService.requestManualRevaluation(
      asset._id.toString(),
      reason,
      caller
    );
  }

  /**
   * Get asset valuation data
   */
  async getAssetValuation(tokenId: string): Promise<ValuationData | null> {
    const asset = await Asset.findOne({ tokenId });
    if (!asset) {
      return null;
    }

    return await this.valuationService.getValuation(asset._id.toString());
  }

  /**
   * Get asset valuation history
   */
  async getAssetValuationHistory(tokenId: string): Promise<any> {
    const asset = await Asset.findOne({ tokenId });
    if (!asset) {
      return null;
    }

    return await this.valuationService.getValuationHistory(asset._id.toString());
  }

  /**
   * Get IPFS service instance (for testing)
   */
  getIPFSService(): IPFSService {
    return this.ipfsService;
  }

  /**
   * Get valuation service instance (for testing)
   */
  getValuationService(): AssetValuationService {
    return this.valuationService;
  }

  /**
   * Get asset token factory instance (for testing)
   */
  getAssetTokenFactory(): AssetTokenFactory {
    return this.assetTokenFactory;
  }

  // Private helper methods

  private validateAssetSubmission(assetData: {
    assetType: AssetType;
    owner: string;
    metadata: {
      title: string;
      description: string;
      location: {
        address: string;
        coordinates: { lat: number; lng: number };
      };
      valuation: {
        amount: number;
        currency: string;
        appraiser?: string;
      };
      documents: IPFSDocument[];
      specifications?: Record<string, any>;
    };
  }): void {
    // Validate required fields
    if (!assetData.metadata.title || assetData.metadata.title.trim() === '') {
      throw new AssetRegistryError('INVALID_DATA', 'Asset title is required');
    }

    if (!assetData.metadata.description || assetData.metadata.description.trim() === '') {
      throw new AssetRegistryError('INVALID_DATA', 'Asset description is required');
    }

    if (!assetData.metadata.location.address || assetData.metadata.location.address.trim() === '') {
      throw new AssetRegistryError('INVALID_DATA', 'Asset location is required');
    }

    // Validate valuation
    if (!assetData.metadata.valuation.amount || assetData.metadata.valuation.amount <= 0) {
      throw new AssetRegistryError('INVALID_DATA', 'Asset valuation must be greater than zero');
    }

    // Validate minimum valuation threshold ($1000)
    if (assetData.metadata.valuation.amount < 1000) {
      throw new AssetRegistryError('INVALID_DATA', 'Asset value below minimum threshold of $1000');
    }

    // Validate documents
    if (!assetData.metadata.documents || assetData.metadata.documents.length === 0) {
      throw new AssetRegistryError('INVALID_DATA', 'At least one document is required');
    }

    // Validate IPFS hashes
    for (const document of assetData.metadata.documents) {
      if (!this.isValidIPFSHash(document.ipfsHash)) {
        throw new AssetRegistryError('INVALID_DATA', `Invalid IPFS hash format: ${document.ipfsHash}`);
      }

      // Validate document upload date is not in the future
      if (document.uploadDate > new Date()) {
        throw new AssetRegistryError('INVALID_DATA', 'Document upload date cannot be in the future');
      }
    }
  }

  private isValidIPFSHash(hash: string): boolean {
    // Basic IPFS hash validation (CIDv0 format)
    // Must start with Qm and be exactly 46 characters
    // Uses base58 alphabet excluding 0, O, I, l to avoid confusion
    if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash)) {
      return false;
    }
    
    // Additional check: reject hashes with repeated characters (likely invalid)
    const hashPart = hash.substring(2);
    const uniqueChars = new Set(hashPart);
    if (uniqueChars.size < 10) { // Real IPFS hashes should have more variety
      return false;
    }
    
    return true;
  }

  private initializeMockUsers(): void {
    // Initialize some mock users for testing
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('verifier_address', UserRole.VERIFIER);
    this.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
    this.registerUser('user_address', UserRole.USER);
  }
}