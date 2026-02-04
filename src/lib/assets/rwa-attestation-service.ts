import { SuiService } from '../blockchain/sui-service';
import { AssetVerificationResult } from './asset-verification-service';
import { DocumentMetadata } from './document-upload-service';

export interface RWAAttestationNFT {
  attestationId: string;
  objectId: string;
  documentHash: string;
  assetType: string;
  jurisdiction: string;
  confidenceScore: number;
  verificationStatus: string;
  attestedAt: Date;
  expiresAt?: Date;
  metadata: AttestationMetadata;
}

export interface AttestationMetadata {
  assetDescription: string;
  documentCount: number;
  verificationMethod: string;
  jurisdictionCode: string;
  complianceChecks: string[];
  registryValidation: boolean;
  manualReview: boolean;
}

export interface AttestationRequest {
  documentHash: string;
  assetType: 'real_estate' | 'vehicle' | 'equipment' | 'intellectual_property' | 'other';
  jurisdiction: string;
  assetDescription: string;
  verificationResult: AssetVerificationResult;
  documentMetadata: DocumentMetadata;
  userAccountId: string;
}

export class RWAAttestationService {
  private suiService: SuiService;
  
  private readonly JURISDICTION_CODES = {
    'US': 'US',
    'UK': 'GB', 
    'CA': 'CA',
    'AU': 'AU',
    'DE': 'DE',
    'FR': 'FR',
    'JP': 'JP',
    'SG': 'SG'
  };

  private readonly ATTESTATION_VALIDITY_PERIOD = {
    real_estate: 365 * 24 * 60 * 60 * 1000, // 1 year
    vehicle: 180 * 24 * 60 * 60 * 1000,     // 6 months
    equipment: 90 * 24 * 60 * 60 * 1000,    // 3 months
    intellectual_property: 730 * 24 * 60 * 60 * 1000, // 2 years
    other: 180 * 24 * 60 * 60 * 1000        // 6 months
  };

  constructor(suiService: SuiService) {
    this.suiService = suiService;
  }

  /**
   * Create RWA attestation NFT on Sui blockchain
   */
  async createAttestation(request: AttestationRequest): Promise<RWAAttestationNFT> {
    // Validate request
    this.validateAttestationRequest(request);

    // Only create attestations for verified or manually approved assets
    if (!this.isEligibleForAttestation(request.verificationResult)) {
      throw new Error(`Asset verification status '${request.verificationResult.verificationStatus}' is not eligible for attestation`);
    }

    // Prepare attestation metadata
    const metadata = this.prepareAttestationMetadata(request);

    // Generate unique attestation ID
    const attestationId = this.generateAttestationId(request);

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(request.assetType);

    // Create attestation object on Sui
    const objectId = await this.mintAttestationNFT({
      attestationId,
      documentHash: request.documentHash,
      assetType: request.assetType,
      jurisdiction: request.jurisdiction,
      confidenceScore: request.verificationResult.confidenceScore,
      metadata,
      userAccountId: request.userAccountId,
      expiresAt
    });

    return {
      attestationId,
      objectId,
      documentHash: request.documentHash,
      assetType: request.assetType,
      jurisdiction: request.jurisdiction,
      confidenceScore: request.verificationResult.confidenceScore,
      verificationStatus: request.verificationResult.verificationStatus,
      attestedAt: new Date(),
      expiresAt,
      metadata
    };
  }

  /**
   * Verify attestation NFT authenticity
   */
  async verifyAttestation(objectId: string): Promise<RWAAttestationNFT | null> {
    try {
      // Fetch attestation object from Sui
      const attestationObject = await this.suiService.getObject(objectId);
      
      if (!attestationObject || !this.isValidAttestationObject(attestationObject)) {
        return null;
      }

      // Parse attestation data
      return this.parseAttestationObject(attestationObject);
    } catch (error) {
      console.error('Error verifying attestation:', error);
      return null;
    }
  }

  /**
   * Update attestation status (for renewals or revocations)
   */
  async updateAttestationStatus(
    objectId: string, 
    newStatus: 'active' | 'expired' | 'revoked',
    reason?: string
  ): Promise<boolean> {
    try {
      // This would call a Move function to update the attestation status
      await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'rwa_asset',
        function: 'update_attestation_status',
        arguments: [objectId, newStatus, reason || ''],
        gasBudget: 10000000
      });

      return true;
    } catch (error) {
      console.error('Error updating attestation status:', error);
      return false;
    }
  }

  /**
   * Get all attestations for a user
   */
  async getUserAttestations(userAccountId: string): Promise<RWAAttestationNFT[]> {
    try {
      // Query Sui for user's attestation objects
      const attestationObjects = await this.suiService.getObjectsOwnedByAddress(userAccountId);
      
      const attestations: RWAAttestationNFT[] = [];
      
      for (const obj of attestationObjects) {
        if (this.isValidAttestationObject(obj)) {
          const attestation = this.parseAttestationObject(obj);
          if (attestation) {
            attestations.push(attestation);
          }
        }
      }

      return attestations;
    } catch (error) {
      console.error('Error fetching user attestations:', error);
      return [];
    }
  }

  /**
   * Check if attestation is still valid (not expired or revoked)
   */
  isAttestationValid(attestation: RWAAttestationNFT): boolean {
    const now = new Date();
    
    // Check expiration
    if (attestation.expiresAt && now > attestation.expiresAt) {
      return false;
    }

    // Check if revoked (would need to check on-chain status)
    // For now, assume valid if not expired
    return true;
  }

  /**
   * Revoke attestation (for fraud or compliance issues)
   */
  async revokeAttestation(objectId: string, reason: string): Promise<boolean> {
    return this.updateAttestationStatus(objectId, 'revoked', reason);
  }

  // Private helper methods

  private validateAttestationRequest(request: AttestationRequest): void {
    if (!request.documentHash || request.documentHash.length !== 64) {
      throw new Error('Invalid document hash');
    }

    if (!request.assetType || !['real_estate', 'vehicle', 'equipment', 'intellectual_property', 'other'].includes(request.assetType)) {
      throw new Error('Invalid asset type');
    }

    if (!request.jurisdiction || !this.JURISDICTION_CODES[request.jurisdiction as keyof typeof this.JURISDICTION_CODES]) {
      throw new Error('Unsupported jurisdiction');
    }

    if (!request.userAccountId) {
      throw new Error('User account ID is required');
    }

    if (!request.verificationResult) {
      throw new Error('Verification result is required');
    }
  }

  private isEligibleForAttestation(verificationResult: AssetVerificationResult): boolean {
    return ['verified', 'manual_review'].includes(verificationResult.verificationStatus) &&
           verificationResult.confidenceScore >= 60;
  }

  private prepareAttestationMetadata(request: AttestationRequest): AttestationMetadata {
    const verificationResult = request.verificationResult;
    
    return {
      assetDescription: request.assetDescription,
      documentCount: 1, // Currently supporting single document per attestation
      verificationMethod: this.getVerificationMethod(verificationResult),
      jurisdictionCode: this.JURISDICTION_CODES[request.jurisdiction as keyof typeof this.JURISDICTION_CODES],
      complianceChecks: this.getComplianceChecks(verificationResult),
      registryValidation: verificationResult.registryChecks.some(check => check.matched),
      manualReview: verificationResult.verificationDetails.manualOverride?.applied || false
    };
  }

  private generateAttestationId(request: AttestationRequest): string {
    const timestamp = Date.now();
    const data = `${request.documentHash}-${request.assetType}-${request.jurisdiction}-${timestamp}`;
    
    // Simple hash generation - in production would use crypto.createHash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `RWA-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  private calculateExpirationDate(assetType: string): Date {
    const validityPeriod = this.ATTESTATION_VALIDITY_PERIOD[assetType as keyof typeof this.ATTESTATION_VALIDITY_PERIOD] 
                          || this.ATTESTATION_VALIDITY_PERIOD.other;
    
    return new Date(Date.now() + validityPeriod);
  }

  private async mintAttestationNFT(attestationData: {
    attestationId: string;
    documentHash: string;
    assetType: string;
    jurisdiction: string;
    confidenceScore: number;
    metadata: AttestationMetadata;
    userAccountId: string;
    expiresAt: Date;
  }): Promise<string> {
    try {
      // Call Move function to mint attestation NFT
      const result = await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'rwa_asset',
        function: 'mint_attestation',
        arguments: [
          attestationData.attestationId,
          attestationData.documentHash,
          attestationData.assetType,
          attestationData.jurisdiction,
          attestationData.confidenceScore,
          JSON.stringify(attestationData.metadata),
          attestationData.userAccountId,
          attestationData.expiresAt.getTime()
        ],
        gasBudget: 10000000
      });

      // Extract object ID from transaction result
      return this.extractObjectIdFromTransaction(result);
    } catch (error) {
      console.error('Error minting attestation NFT:', error);
      throw new Error('Failed to create attestation NFT on blockchain');
    }
  }

  private isValidAttestationObject(obj: any): boolean {
    // Check if object has required attestation fields
    return obj && 
           obj.data && 
           obj.data.type && 
           obj.data.type.includes('RWAAttestationObject') &&
           obj.data.fields;
  }

  private parseAttestationObject(obj: any): RWAAttestationNFT | null {
    try {
      const fields = obj.data.fields;
      
      return {
        attestationId: fields.attestation_id,
        objectId: obj.data.objectId,
        documentHash: fields.document_hash,
        assetType: fields.asset_type,
        jurisdiction: fields.jurisdiction,
        confidenceScore: parseInt(fields.confidence_score),
        verificationStatus: fields.verification_status,
        attestedAt: new Date(parseInt(fields.attested_at)),
        expiresAt: fields.expires_at ? new Date(parseInt(fields.expires_at)) : undefined,
        metadata: JSON.parse(fields.metadata)
      };
    } catch (error) {
      console.error('Error parsing attestation object:', error);
      return null;
    }
  }

  private extractObjectIdFromTransaction(result: any): string {
    // Extract object ID from Sui transaction result
    // This is a simplified implementation
    if (result.effects?.created && result.effects.created.length > 0) {
      return result.effects.created[0].reference.objectId;
    }
    
    throw new Error('Could not extract object ID from transaction result');
  }

  private getVerificationMethod(verificationResult: AssetVerificationResult): string {
    if (verificationResult.verificationDetails.manualOverride?.applied) {
      return 'manual_review';
    } else if (verificationResult.registryChecks.some(check => check.matched)) {
      return 'registry_verified';
    } else {
      return 'document_analysis';
    }
  }

  private getComplianceChecks(verificationResult: AssetVerificationResult): string[] {
    const checks: string[] = [];
    
    if (verificationResult.jurisdictionCompliance.compliant) {
      checks.push('jurisdiction_compliant');
    }
    
    if (verificationResult.verificationDetails.duplicateCheck) {
      checks.push('duplicate_check_passed');
    }
    
    if (verificationResult.registryChecks.some(check => check.available)) {
      checks.push('registry_check_performed');
    }
    
    return checks;
  }
}