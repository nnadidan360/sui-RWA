/**
 * Asset Token Contract Implementation
 * 
 * This module implements the core business logic for asset tokenization
 * following SafeERC20 patterns and comprehensive validation.
 * 
 * The actual smart contract deployment will be handled separately,
 * but this provides the core functionality and validation logic.
 */

import { AccessControl } from '../auth/access-control';
import { UserRole, User } from '../../types/auth';

export interface AssetMetadata {
  description: string;
  location: string;
  documentHashes: string[];
  appraisalValue: bigint;
  appraisalDate: number;
  specifications: Record<string, any>;
}

export interface AssetVerification {
  verifier: string;
  verificationDate: number;
  notes: string;
  complianceChecks: ComplianceChecks;
}

export interface ComplianceChecks {
  kycCompleted: boolean;
  documentationComplete: boolean;
  valuationVerified: boolean;
  legalClearance: boolean;
}

export enum VerificationStatus {
  Pending = 'pending',
  UnderReview = 'under_review',
  Approved = 'approved',
  Rejected = 'rejected',
  RequiresUpdate = 'requires_update'
}

export enum AssetType {
  RealEstate = 'real_estate',
  Commodity = 'commodity',
  Invoice = 'invoice',
  Equipment = 'equipment',
  Other = 'other'
}

export interface AssetTokenData {
  tokenId: string;
  assetType: AssetType;
  owner: string;
  valuation: bigint;
  verificationStatus: VerificationStatus;
  metadata: AssetMetadata;
  createdAt: number;
  lastUpdated: number;
  isLocked: boolean;
  loanId?: string;
}

export interface AssetCreationParams {
  assetType: AssetType;
  owner: string;
  initialValuation: bigint;
  metadata: AssetMetadata;
  verification: AssetVerification;
}

export interface ValuationUpdate {
  newValuation: bigint;
  appraiser: string;
  appraisalDate: number;
  notes: string;
}

export class AssetTokenError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AssetTokenError';
  }
}

/**
 * Asset Token Factory - Core business logic implementation
 * 
 * This class implements the asset tokenization logic with comprehensive
 * validation following the design document requirements.
 */
export class AssetTokenFactory {
  private tokens: Map<string, AssetTokenData> = new Map();
  private ownerTokens: Map<string, Set<string>> = new Map();
  private lockedTokens: Map<string, string> = new Map(); // tokenId -> loanId
  private tokenCounter = 0;
  private userRegistry: Map<string, User> = new Map(); // Mock user registry for testing

  constructor() {
    // Initialize with mock users for testing
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
  }

  /**
   * Get user by address
   */
  private getUser(address: string): User | null {
    return this.userRegistry.get(address) || null;
  }

  /**
   * Tokenize a real-world asset
   * 
   * **Property 1: Asset tokenization completeness**
   * For any valid asset submission with complete documentation and verification,
   * the tokenization process should create an Asset_Token with all required fields populated correctly
   */
  async tokenizeAsset(params: AssetCreationParams, caller: string): Promise<AssetTokenData> {
    // Check if system is paused
    this.checkNotPaused();
    
    const user = this.getUser(caller);
    
    // Validate asset metadata
    this.validateAssetMetadata(params.metadata);

    // Validate asset verification
    this.validateAssetVerification(params.verification, caller);

    // Validate initial valuation
    this.validateValuation(params.initialValuation);

    // Generate new token ID
    const tokenId = this.generateTokenId();

    // Determine verification status based on compliance checks
    const verificationStatus = this.determineVerificationStatus(params.verification.complianceChecks);

    // Create asset token data
    const assetData: AssetTokenData = {
      tokenId,
      assetType: params.assetType,
      owner: params.owner,
      valuation: params.initialValuation,
      verificationStatus,
      metadata: params.metadata,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      isLocked: false,
    };

    // Store asset token
    this.tokens.set(tokenId, assetData);

    // Add token to owner's list
    this.addTokenToOwner(params.owner, tokenId);

    return assetData;
  }

  /**
   * Update asset verification status
   * Only authorized verifiers can update verification status
   */
  async updateVerificationStatus(
    tokenId: string,
    newStatus: VerificationStatus,
    verification: AssetVerification,
    caller: string
  ): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller is authorized verifier
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only verifiers can update verification status');
    }

    // Get asset token data
    const assetData = this.tokens.get(tokenId);
    if (!assetData) {
      throw new AssetTokenError('TOKEN_NOT_FOUND', `Asset token ${tokenId} not found`);
    }

    // Validate verification data
    this.validateAssetVerification(verification, caller);

    // For approved status, validate compliance checks
    if (newStatus === VerificationStatus.Approved) {
      this.validateComplianceChecks(verification.complianceChecks);
    }

    // Update verification status
    assetData.verificationStatus = newStatus;
    assetData.lastUpdated = Date.now();

    this.tokens.set(tokenId, assetData);
  }

  /**
   * Transfer asset token to new owner
   * Only verified assets can be transferred
   * Assets locked as collateral cannot be transferred
   */
  async transferToken(tokenId: string, to: string, caller: string): Promise<void> {
    // Get asset token data
    const assetData = this.tokens.get(tokenId);
    if (!assetData) {
      throw new AssetTokenError('TOKEN_NOT_FOUND', `Asset token ${tokenId} not found`);
    }

    const user = this.getUser(caller);

    // Check caller is owner or admin
    if (caller !== assetData.owner && !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only token owner can transfer asset');
    }

    // Check asset is verified
    if (assetData.verificationStatus !== VerificationStatus.Approved) {
      throw new AssetTokenError('ASSET_NOT_VERIFIED', 'Only verified assets can be transferred');
    }

    // Check asset is not locked
    if (assetData.isLocked) {
      throw new AssetTokenError('ASSET_LOCKED', 'Asset is locked as collateral and cannot be transferred');
    }

    const from = assetData.owner;

    // Update ownership
    this.removeTokenFromOwner(from, tokenId);
    this.addTokenToOwner(to, tokenId);

    // Update asset data
    assetData.owner = to;
    assetData.lastUpdated = Date.now();
    this.tokens.set(tokenId, assetData);
  }

  /**
   * Update asset valuation
   * Only verifiers or admin can update valuations
   */
  async updateValuation(
    tokenId: string,
    valuationUpdate: ValuationUpdate,
    caller: string
  ): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller is authorized
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only verifiers can update valuations');
    }

    // Get asset token data
    const assetData = this.tokens.get(tokenId);
    if (!assetData) {
      throw new AssetTokenError('TOKEN_NOT_FOUND', `Asset token ${tokenId} not found`);
    }

    // Validate new valuation
    this.validateValuation(valuationUpdate.newValuation);

    // Check asset is verified (only verified assets can have valuations updated)
    if (assetData.verificationStatus !== VerificationStatus.Approved) {
      throw new AssetTokenError('ASSET_NOT_VERIFIED', 'Only verified assets can have valuations updated');
    }

    // Update valuation and metadata
    assetData.valuation = valuationUpdate.newValuation;
    assetData.metadata.appraisalValue = valuationUpdate.newValuation;
    assetData.metadata.appraisalDate = valuationUpdate.appraisalDate;
    assetData.lastUpdated = Date.now();

    this.tokens.set(tokenId, assetData);
  }

  /**
   * Lock asset token for use as collateral
   * Only lending protocol can lock assets
   */
  async lockForCollateral(tokenId: string, loanId: string, caller: string): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller is authorized (lending protocol)
    if (!AccessControl.hasRole(user, UserRole.LENDING_PROTOCOL)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only lending protocol can lock assets');
    }

    // Get asset token data
    const assetData = this.tokens.get(tokenId);
    if (!assetData) {
      throw new AssetTokenError('TOKEN_NOT_FOUND', `Asset token ${tokenId} not found`);
    }

    // Check asset is verified
    if (assetData.verificationStatus !== VerificationStatus.Approved) {
      throw new AssetTokenError('ASSET_NOT_VERIFIED', 'Only verified assets can be used as collateral');
    }

    // Check asset is not already locked
    if (assetData.isLocked) {
      throw new AssetTokenError('ASSET_LOCKED', 'Asset is already locked as collateral');
    }

    // Lock the token
    assetData.isLocked = true;
    assetData.loanId = loanId;
    assetData.lastUpdated = Date.now();

    this.tokens.set(tokenId, assetData);
    this.lockedTokens.set(tokenId, loanId);
  }

  /**
   * Unlock asset token from collateral use
   * Only lending protocol can unlock assets
   */
  async unlockFromCollateral(tokenId: string, caller: string): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller is authorized (lending protocol)
    if (!AccessControl.hasRole(user, UserRole.LENDING_PROTOCOL)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only lending protocol can unlock assets');
    }

    // Get asset token data
    const assetData = this.tokens.get(tokenId);
    if (!assetData) {
      throw new AssetTokenError('TOKEN_NOT_FOUND', `Asset token ${tokenId} not found`);
    }

    // Check asset is locked
    if (!assetData.isLocked) {
      throw new AssetTokenError('ASSET_NOT_LOCKED', 'Asset is not locked');
    }

    // Unlock the token
    assetData.isLocked = false;
    assetData.loanId = undefined;
    assetData.lastUpdated = Date.now();

    this.tokens.set(tokenId, assetData);
    this.lockedTokens.delete(tokenId);
  }

  /**
   * Get asset token data
   */
  getTokenData(tokenId: string): AssetTokenData | undefined {
    return this.tokens.get(tokenId);
  }

  /**
   * Get tokens owned by account
   */
  getOwnerTokens(owner: string): string[] {
    const tokens = this.ownerTokens.get(owner);
    return tokens ? Array.from(tokens) : [];
  }

  /**
   * Check if token is locked
   */
  isTokenLocked(tokenId: string): boolean {
    const assetData = this.tokens.get(tokenId);
    return assetData?.isLocked || false;
  }

  /**
   * Get loan ID for locked token
   */
  getTokenLoanId(tokenId: string): string | undefined {
    return this.lockedTokens.get(tokenId);
  }

  /**
   * Verify asset ownership
   */
  verifyOwnership(tokenId: string, owner: string): boolean {
    const assetData = this.tokens.get(tokenId);
    return assetData?.owner === owner || false;
  }

  // Private helper methods

  private initializeMockUsers(): void {
    // Initialize some mock users for testing
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('verifier_address', UserRole.VERIFIER);
    this.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
  }

  private validateAssetMetadata(metadata: AssetMetadata): void {
    // Check description is not empty
    if (!metadata?.description?.trim()) {
      throw new AssetTokenError('INVALID_METADATA', 'Asset description cannot be empty');
    }

    // Check location is not empty
    if (!metadata?.location?.trim()) {
      throw new AssetTokenError('INVALID_METADATA', 'Asset location cannot be empty');
    }

    // Check document hashes are provided
    if (metadata.documentHashes.length === 0) {
      throw new AssetTokenError('INVALID_METADATA', 'Asset must have at least one document');
    }

    // Validate document hashes format (basic IPFS hash validation)
    for (const hash of metadata.documentHashes) {
      if (hash.length < 46 || !hash.startsWith('Qm')) {
        throw new AssetTokenError('INVALID_METADATA', `Invalid IPFS hash format: ${hash}`);
      }
    }

    // Check appraisal value is positive
    if (metadata.appraisalValue <= BigInt(0)) {
      throw new AssetTokenError('INVALID_VALUATION', 'Appraisal value must be positive');
    }

    // Check appraisal date is not in the future
    if (metadata.appraisalDate > Date.now()) {
      throw new AssetTokenError('INVALID_METADATA', 'Appraisal date cannot be in the future');
    }
  }

  private validateAssetVerification(verification: AssetVerification, caller: string): void {
    const verifierUser = this.getUser(verification.verifier);
    
    // Check verifier is authorized
    if (!AccessControl.hasRole(verifierUser, UserRole.VERIFIER) && 
        !AccessControl.hasRole(verifierUser, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Verifier is not authorized');
    }

    // Check verification date is not in the future
    if (verification.verificationDate > Date.now()) {
      throw new AssetTokenError('INVALID_METADATA', 'Verification date cannot be in the future');
    }
  }

  private validateValuation(valuation: bigint): void {
    // Minimum asset value threshold ($1000 USD equivalent)
    const minValue = BigInt(1000) * BigInt(100); // $1000 in cents

    if (valuation < minValue) {
      throw new AssetTokenError('ASSET_VALUE_TOO_LOW', 'Asset value below minimum threshold');
    }
  }

  private validateComplianceChecks(checks: ComplianceChecks): void {
    if (!checks.kycCompleted) {
      throw new AssetTokenError('COMPLIANCE_CHECK_FAILED', 'KYC verification required');
    }

    if (!checks.documentationComplete) {
      throw new AssetTokenError('COMPLIANCE_CHECK_FAILED', 'Complete documentation required');
    }

    if (!checks.valuationVerified) {
      throw new AssetTokenError('COMPLIANCE_CHECK_FAILED', 'Valuation verification required');
    }

    if (!checks.legalClearance) {
      throw new AssetTokenError('COMPLIANCE_CHECK_FAILED', 'Legal clearance required');
    }
  }

  private determineVerificationStatus(checks: ComplianceChecks): VerificationStatus {
    if (checks.kycCompleted && checks.documentationComplete && 
        checks.valuationVerified && checks.legalClearance) {
      return VerificationStatus.Approved;
    }
    return VerificationStatus.Pending;
  }

  private generateTokenId(): string {
    return `asset_${++this.tokenCounter}_${Date.now()}`;
  }

  private addTokenToOwner(owner: string, tokenId: string): void {
    if (!this.ownerTokens.has(owner)) {
      this.ownerTokens.set(owner, new Set());
    }
    this.ownerTokens.get(owner)!.add(tokenId);
  }

  private removeTokenFromOwner(owner: string, tokenId: string): void {
    const tokens = this.ownerTokens.get(owner);
    if (tokens) {
      tokens.delete(tokenId);
      if (tokens.size === 0) {
        this.ownerTokens.delete(owner);
      }
    }
  }

  /**
   * Emergency pause functionality for security incidents
   */
  emergencyPause(adminId: string): void {
    // Get the actual user from registry (in real implementation would be from database)
    const adminUser = this.getUser(adminId);
    
    if (!adminUser || !AccessControl.hasRole(adminUser, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only admins can trigger emergency pause');
    }

    this.isPaused = true;
    console.log(`Emergency pause activated by admin: ${adminId}`);
  }

  /**
   * Emergency unpause functionality
   */
  emergencyUnpause(adminId: string): void {
    // Get the actual user from registry (in real implementation would be from database)
    const adminUser = this.getUser(adminId);
    
    if (!adminUser || !AccessControl.hasRole(adminUser, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only admins can unpause system');
    }

    this.isPaused = false;
    console.log(`Emergency pause deactivated by admin: ${adminId}`);
  }

  /**
   * Approve asset type for tokenization
   */
  async approveAssetType(assetType: string, adminId: string): Promise<void> {
    const adminUser = this.getUser(adminId);
    
    if (!adminUser || !AccessControl.hasRole(adminUser, UserRole.ADMIN)) {
      throw new AssetTokenError('UNAUTHORIZED', 'Only admins can approve asset types');
    }

    // In a real implementation, this would update a database of approved asset types
    console.log(`Asset type ${assetType} approved by admin: ${adminId}`);
  }

  private isPaused: boolean = false;

  private checkNotPaused(): void {
    if (this.isPaused) {
      throw new AssetTokenError('SYSTEM_PAUSED', 'Contract is paused');
    }
  }
}