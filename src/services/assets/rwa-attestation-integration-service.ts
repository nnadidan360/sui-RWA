import { AttestationMintingService, ASSET_TYPES, DOCUMENT_TYPES } from './attestation-minting-service';
import { AssetConfidenceScoringService } from './asset-confidence-scoring-service';
import { JurisdictionValidationService } from './jurisdiction-validation-service';
import logger from '../../utils/logger';

/**
 * Integration service that connects document upload with attestation minting
 * This service orchestrates the flow from asset verification to on-chain attestation
 */
export class RWAAttestationIntegrationService {
  private attestationService: AttestationMintingService;
  private scoringService: AssetConfidenceScoringService;
  private jurisdictionService: JurisdictionValidationService;

  constructor(
    attestationService: AttestationMintingService,
    scoringService: AssetConfidenceScoringService,
    jurisdictionService: JurisdictionValidationService
  ) {
    this.attestationService = attestationService;
    this.scoringService = scoringService;
    this.jurisdictionService = jurisdictionService;
  }

  /**
   * Create attestation for a verified asset
   * This is called after asset verification is complete
   */
  async createAttestationForAsset(params: {
    assetId: string;
    userId: string;
    assetType: string;
    jurisdiction: string;
    documents: Array<{
      hash: string;
      type: string;
      filename: string;
    }>;
    verificationStatus: string;
    registryMatch: boolean;
    metadataUri?: string;
  }): Promise<{
    success: boolean;
    attestationId?: string;
    confidenceScore?: number;
    error?: string;
  }> {
    try {
      logger.info('Creating attestation for verified asset', {
        assetId: params.assetId,
        assetType: params.assetType,
        jurisdiction: params.jurisdiction,
      });

      // Validate jurisdiction
      const jurisdictionValidation = await this.jurisdictionService.validateJurisdiction(
        params.jurisdiction
      );

      if (!jurisdictionValidation.isValid) {
        throw new Error(`Invalid jurisdiction: ${params.jurisdiction}`);
      }

      // Calculate confidence score
      const confidenceScore = await this.scoringService.calculateConfidenceScore({
        assetId: params.assetId,
        documentQuality: this.assessDocumentQuality(params.documents),
        verificationStatus: params.verificationStatus,
        registryMatch: params.registryMatch,
        hasDuplicates: false, // Assumed to be checked before
        metadataCompleteness: this.assessMetadataCompleteness(params),
        jurisdiction: params.jurisdiction,
        documentAge: 0, // Current documents
      });

      // Map document types to attestation format
      const attestationDocuments = params.documents.map(doc => ({
        hash: doc.hash,
        documentType: this.mapDocumentType(doc.type),
      }));

      // Create metadata URI (in production, this would be IPFS or similar)
      const metadataUri = params.metadataUri || `ipfs://placeholder/${params.assetId}`;

      // Create attestation on Sui blockchain
      const result = await this.attestationService.createAttestation(
        {
          internalAssetId: params.assetId,
          ownerAccountId: params.userId,
          assetType: this.mapAssetType(params.assetType),
          jurisdiction: params.jurisdiction,
          metadataUri,
          documents: attestationDocuments,
          confidenceScore: confidenceScore.score,
        },
        params.userId // In production, this would be the actual Sui address
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create attestation');
      }

      logger.info('Attestation created successfully', {
        assetId: params.assetId,
        attestationId: result.attestationId,
        confidenceScore: confidenceScore.score,
      });

      return {
        success: true,
        attestationId: result.attestationId,
        confidenceScore: confidenceScore.score,
      };
    } catch (error) {
      logger.error('Failed to create attestation for asset', {
        error: error instanceof Error ? error.message : 'Unknown error',
        assetId: params.assetId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update attestation when asset is re-verified
   */
  async updateAttestationScore(
    attestationId: string,
    assetId: string,
    newVerificationData: {
      verificationStatus: string;
      registryMatch: boolean;
      documentQuality: number;
    }
  ): Promise<{
    success: boolean;
    newScore?: number;
    error?: string;
  }> {
    try {
      logger.info('Updating attestation confidence score', {
        attestationId,
        assetId,
      });

      // Recalculate confidence score
      const confidenceScore = await this.scoringService.calculateConfidenceScore({
        assetId,
        documentQuality: newVerificationData.documentQuality,
        verificationStatus: newVerificationData.verificationStatus,
        registryMatch: newVerificationData.registryMatch,
        hasDuplicates: false,
        metadataCompleteness: 80, // Default value
        jurisdiction: 'US', // Would be fetched from asset
        documentAge: 0,
      });

      // Update on-chain attestation
      const result = await this.attestationService.updateConfidenceScore(
        attestationId,
        confidenceScore.score,
        'system',
        'system' // Would be actual signer address
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update attestation');
      }

      logger.info('Attestation score updated successfully', {
        attestationId,
        newScore: confidenceScore.score,
      });

      return {
        success: true,
        newScore: confidenceScore.score,
      };
    } catch (error) {
      logger.error('Failed to update attestation score', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attestationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke attestation (e.g., for fraud or invalid asset)
   */
  async revokeAttestation(
    attestationId: string,
    reason: string,
    revokedBy: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Revoking attestation', {
        attestationId,
        reason,
      });

      const result = await this.attestationService.revokeAttestation(
        attestationId,
        revokedBy,
        reason,
        revokedBy // Would be actual signer address
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke attestation');
      }

      logger.info('Attestation revoked successfully', {
        attestationId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to revoke attestation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attestationId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Map internal asset type to blockchain asset type
   */
  private mapAssetType(internalType: string): string {
    const typeMap: Record<string, string> = {
      'real_estate': ASSET_TYPES.PROPERTY,
      'property': ASSET_TYPES.PROPERTY,
      'vehicle': ASSET_TYPES.VEHICLE,
      'car': ASSET_TYPES.VEHICLE,
      'equipment': ASSET_TYPES.EQUIPMENT,
      'machinery': ASSET_TYPES.EQUIPMENT,
      'invoice': ASSET_TYPES.INVOICE,
      'receivable': ASSET_TYPES.RECEIVABLE,
      'inventory': ASSET_TYPES.INVENTORY,
      'ip': ASSET_TYPES.INTELLECTUAL_PROPERTY,
      'patent': ASSET_TYPES.INTELLECTUAL_PROPERTY,
      'commodity': ASSET_TYPES.COMMODITY,
    };

    return typeMap[internalType.toLowerCase()] || ASSET_TYPES.OTHER;
  }

  /**
   * Map internal document type to blockchain document type
   */
  private mapDocumentType(internalType: string): string {
    const typeMap: Record<string, string> = {
      'deed': DOCUMENT_TYPES.DEED,
      'title': DOCUMENT_TYPES.TITLE,
      'registration': DOCUMENT_TYPES.REGISTRATION,
      'invoice': DOCUMENT_TYPES.INVOICE,
      'appraisal': DOCUMENT_TYPES.APPRAISAL,
      'inspection': DOCUMENT_TYPES.INSPECTION,
      'insurance': DOCUMENT_TYPES.INSURANCE,
      'tax': DOCUMENT_TYPES.TAX_DOCUMENT,
      'ownership': DOCUMENT_TYPES.OWNERSHIP_PROOF,
      'proof': DOCUMENT_TYPES.OWNERSHIP_PROOF,
    };

    return typeMap[internalType.toLowerCase()] || DOCUMENT_TYPES.OTHER;
  }

  /**
   * Assess document quality based on file types and completeness
   */
  private assessDocumentQuality(documents: Array<{ type: string; filename: string }>): number {
    if (documents.length === 0) return 0;

    let qualityScore = 0;
    const requiredTypes = ['deed', 'title', 'ownership'];
    const hasRequiredDocs = requiredTypes.some(type =>
      documents.some(doc => doc.type.toLowerCase().includes(type))
    );

    if (hasRequiredDocs) qualityScore += 50;
    if (documents.length >= 3) qualityScore += 30;
    if (documents.some(doc => doc.filename.toLowerCase().includes('appraisal'))) {
      qualityScore += 20;
    }

    return Math.min(qualityScore, 100);
  }

  /**
   * Assess metadata completeness
   */
  private assessMetadataCompleteness(params: {
    assetType: string;
    jurisdiction: string;
    documents: any[];
  }): number {
    let score = 0;
    if (params.assetType) score += 30;
    if (params.jurisdiction) score += 30;
    if (params.documents && params.documents.length > 0) score += 40;
    return score;
  }
}
