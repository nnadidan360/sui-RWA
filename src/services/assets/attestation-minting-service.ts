import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import logger from '../../utils/logger';

/**
 * Jurisdiction code mapping for RWA attestations
 * Maps country names to ISO 3166-1 alpha-2 codes
 */
export const JURISDICTION_CODES: Record<string, string> = {
  // Fully supported jurisdictions
  'United States': 'US',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Germany': 'DE',
  'Singapore': 'SG',
  
  // Partially supported jurisdictions
  'France': 'FR',
  'Japan': 'JP',
  'Switzerland': 'CH',
  'Netherlands': 'NL',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  
  // Additional common jurisdictions
  'Spain': 'ES',
  'Italy': 'IT',
  'Belgium': 'BE',
  'Austria': 'AT',
  'Ireland': 'IE',
  'New Zealand': 'NZ',
  'South Korea': 'KR',
  'Hong Kong': 'HK',
  'United Arab Emirates': 'AE',
  'India': 'IN',
  'Brazil': 'BR',
  'Mexico': 'MX',
};

/**
 * Asset type mapping for RWA attestations
 */
export const ASSET_TYPES = {
  PROPERTY: 'property',
  VEHICLE: 'vehicle',
  EQUIPMENT: 'equipment',
  INVOICE: 'invoice',
  RECEIVABLE: 'receivable',
  INVENTORY: 'inventory',
  INTELLECTUAL_PROPERTY: 'intellectual_property',
  COMMODITY: 'commodity',
  OTHER: 'other',
} as const;

/**
 * Document type mapping for attestation hashes
 */
export const DOCUMENT_TYPES = {
  DEED: 'deed',
  TITLE: 'title',
  REGISTRATION: 'registration',
  INVOICE: 'invoice',
  APPRAISAL: 'appraisal',
  INSPECTION: 'inspection',
  INSURANCE: 'insurance',
  TAX_DOCUMENT: 'tax_document',
  OWNERSHIP_PROOF: 'ownership_proof',
  OTHER: 'other',
} as const;

export interface AttestationDocument {
  hash: string;
  documentType: string;
}

export interface CreateAttestationParams {
  internalAssetId: string;
  ownerAccountId: string;
  assetType: string;
  jurisdiction: string;
  metadataUri: string;
  documents: AttestationDocument[];
  confidenceScore?: number;
}

export interface AttestationResult {
  attestationId: string;
  transactionDigest: string;
  objectId: string;
  success: boolean;
  error?: string;
}

/**
 * Service for minting RWA attestation NFTs on Sui blockchain
 */
export class AttestationMintingService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;

  constructor(
    suiClient: SuiClient,
    packageId: string,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Get jurisdiction code from country name
   */
  getJurisdictionCode(jurisdiction: string): string {
    const code = JURISDICTION_CODES[jurisdiction];
    if (!code) {
      logger.warn(`Unknown jurisdiction: ${jurisdiction}, using 'XX' as fallback`);
      return 'XX'; // Unknown jurisdiction code
    }
    return code;
  }

  /**
   * Validate asset type
   */
  validateAssetType(assetType: string): boolean {
    return Object.values(ASSET_TYPES).includes(assetType as any);
  }

  /**
   * Validate document type
   */
  validateDocumentType(documentType: string): boolean {
    return Object.values(DOCUMENT_TYPES).includes(documentType as any);
  }

  /**
   * Create a new RWA attestation NFT on Sui blockchain
   */
  async createAttestation(
    params: CreateAttestationParams,
    signerAddress: string
  ): Promise<AttestationResult> {
    try {
      logger.info('Creating RWA attestation NFT', {
        assetId: params.internalAssetId,
        assetType: params.assetType,
        jurisdiction: params.jurisdiction,
      });

      // Validate asset type
      if (!this.validateAssetType(params.assetType)) {
        throw new Error(`Invalid asset type: ${params.assetType}`);
      }

      // Get jurisdiction code
      const jurisdictionCode = this.getJurisdictionCode(params.jurisdiction);

      // Validate documents
      for (const doc of params.documents) {
        if (!this.validateDocumentType(doc.documentType)) {
          throw new Error(`Invalid document type: ${doc.documentType}`);
        }
        if (!doc.hash || doc.hash.length !== 64) {
          throw new Error(`Invalid document hash: ${doc.hash}`);
        }
      }

      // Create transaction block
      const tx = new TransactionBlock();

      // Call create_attestation function
      const [attestation] = tx.moveCall({
        target: `${this.packageId}::rwa_asset::create_attestation`,
        arguments: [
          tx.pure(params.internalAssetId),
          tx.pure(params.ownerAccountId),
          tx.pure(params.assetType),
          tx.pure(jurisdictionCode),
          tx.pure(params.metadataUri),
          tx.object(this.clockObjectId),
        ],
      });

      // Add document hashes to attestation
      for (const doc of params.documents) {
        tx.moveCall({
          target: `${this.packageId}::rwa_asset::add_document_hash`,
          arguments: [
            attestation,
            tx.pure(doc.hash),
            tx.pure(doc.documentType),
            tx.object(this.clockObjectId),
          ],
        });
      }

      // If confidence score is provided, verify the attestation
      if (params.confidenceScore !== undefined) {
        tx.moveCall({
          target: `${this.packageId}::rwa_asset::verify_attestation`,
          arguments: [
            attestation,
            tx.pure('system'), // Verifier ID
            tx.pure(params.confidenceScore),
            tx.object(this.clockObjectId),
          ],
        });
      }

      // Transfer attestation to owner
      tx.transferObjects([attestation], tx.pure(signerAddress));

      // Execute transaction (in production, this would be signed by a keypair)
      // For now, we return the transaction block for external signing
      logger.info('RWA attestation transaction prepared', {
        assetId: params.internalAssetId,
        documentCount: params.documents.length,
      });

      // In a real implementation, you would execute the transaction here
      // const result = await this.suiClient.signAndExecuteTransactionBlock({
      //   transactionBlock: tx,
      //   signer: keypair,
      // });

      return {
        attestationId: 'pending', // Would be extracted from transaction result
        transactionDigest: 'pending',
        objectId: 'pending',
        success: true,
      };
    } catch (error) {
      logger.error('Failed to create RWA attestation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        assetId: params.internalAssetId,
      });

      return {
        attestationId: '',
        transactionDigest: '',
        objectId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update attestation confidence score
   */
  async updateConfidenceScore(
    attestationObjectId: string,
    newScore: number,
    updatedBy: string,
    signerAddress: string
  ): Promise<AttestationResult> {
    try {
      if (newScore < 0 || newScore > 100) {
        throw new Error('Confidence score must be between 0 and 100');
      }

      logger.info('Updating attestation confidence score', {
        attestationId: attestationObjectId,
        newScore,
      });

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::rwa_asset::update_confidence_score`,
        arguments: [
          tx.object(attestationObjectId),
          tx.pure(newScore),
          tx.pure(updatedBy),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Confidence score update transaction prepared', {
        attestationId: attestationObjectId,
      });

      return {
        attestationId: attestationObjectId,
        transactionDigest: 'pending',
        objectId: attestationObjectId,
        success: true,
      };
    } catch (error) {
      logger.error('Failed to update confidence score', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attestationId: attestationObjectId,
      });

      return {
        attestationId: attestationObjectId,
        transactionDigest: '',
        objectId: attestationObjectId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke an attestation
   */
  async revokeAttestation(
    attestationObjectId: string,
    revokerId: string,
    reason: string,
    signerAddress: string
  ): Promise<AttestationResult> {
    try {
      logger.info('Revoking attestation', {
        attestationId: attestationObjectId,
        reason,
      });

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::rwa_asset::revoke_attestation`,
        arguments: [
          tx.object(attestationObjectId),
          tx.pure(revokerId),
          tx.pure(reason),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Attestation revocation transaction prepared', {
        attestationId: attestationObjectId,
      });

      return {
        attestationId: attestationObjectId,
        transactionDigest: 'pending',
        objectId: attestationObjectId,
        success: true,
      };
    } catch (error) {
      logger.error('Failed to revoke attestation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attestationId: attestationObjectId,
      });

      return {
        attestationId: attestationObjectId,
        transactionDigest: '',
        objectId: attestationObjectId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query attestation by object ID
   */
  async getAttestation(attestationObjectId: string): Promise<any> {
    try {
      const object = await this.suiClient.getObject({
        id: attestationObjectId,
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      return object;
    } catch (error) {
      logger.error('Failed to query attestation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attestationId: attestationObjectId,
      });
      throw error;
    }
  }

  /**
   * Query attestations by owner
   */
  async getAttestationsByOwner(ownerAddress: string): Promise<any[]> {
    try {
      const objects = await this.suiClient.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::rwa_asset::RWAAttestationObject`,
        },
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      return objects.data;
    } catch (error) {
      logger.error('Failed to query attestations by owner', {
        error: error instanceof Error ? error.message : 'Unknown error',
        owner: ownerAddress,
      });
      throw error;
    }
  }
}
