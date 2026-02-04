import { MongoClient } from 'mongodb';
import { DocumentUploadService, UploadedDocument, DocumentUploadResult } from './document-upload-service';
import { AssetVerificationService, AssetVerificationResult, AssetDetails } from './asset-verification-service';
import { RWAAttestationService, RWAAttestationNFT, AttestationRequest } from './rwa-attestation-service';
import { SuiService } from '../blockchain/sui-service';

export interface AssetIntelligenceResult {
  uploadResult: DocumentUploadResult;
  verificationResult: AssetVerificationResult;
  attestationNFT?: RWAAttestationNFT;
  processingStatus: 'completed' | 'partial' | 'failed';
  errors: string[];
}

export interface AssetProcessingRequest {
  document: UploadedDocument;
  assetType: 'real_estate' | 'vehicle' | 'equipment' | 'intellectual_property' | 'other';
  jurisdiction: string;
  assetDescription: string;
  userAccountId: string;
  createAttestation?: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAssets: {
    documentHash: string;
    attestationId?: string;
    uploadedAt: Date;
    owner: string;
  }[];
  similarity: number;
}

export class AssetIntelligenceService {
  private documentUploadService: DocumentUploadService;
  private assetVerificationService: AssetVerificationService;
  private rwaAttestationService: RWAAttestationService;
  private mongoClient: MongoClient;

  constructor(mongoClient: MongoClient, suiService: SuiService) {
    this.mongoClient = mongoClient;
    this.documentUploadService = new DocumentUploadService(mongoClient);
    this.assetVerificationService = new AssetVerificationService();
    this.rwaAttestationService = new RWAAttestationService(suiService);
  }

  /**
   * Complete asset intelligence processing pipeline
   */
  async processAsset(request: AssetProcessingRequest): Promise<AssetIntelligenceResult> {
    const errors: string[] = [];
    let uploadResult: DocumentUploadResult | null = null;
    let verificationResult: AssetVerificationResult | null = null;
    let attestationNFT: RWAAttestationNFT | null = null;

    try {
      // Step 1: Upload and hash document
      uploadResult = await this.documentUploadService.uploadDocument(request.document);
      
      // Step 2: Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(uploadResult.hash, request.userAccountId);
      if (duplicateCheck.isDuplicate) {
        errors.push(`Duplicate asset detected. Similar assets found: ${duplicateCheck.existingAssets.length}`);
        // Continue processing but flag the duplicate
      }

      // Step 3: Verify asset
      const assetDetails: AssetDetails = {
        assetType: request.assetType,
        jurisdiction: request.jurisdiction,
        documentHash: uploadResult.hash,
        metadata: uploadResult.metadata,
        extractedData: uploadResult.metadata.extractedData
      };

      verificationResult = await this.assetVerificationService.verifyAsset(assetDetails);

      // Step 4: Create attestation NFT if requested and eligible
      if (request.createAttestation && this.isEligibleForAttestation(verificationResult)) {
        try {
          const attestationRequest: AttestationRequest = {
            documentHash: uploadResult.hash,
            assetType: request.assetType,
            jurisdiction: request.jurisdiction,
            assetDescription: request.assetDescription,
            verificationResult,
            documentMetadata: uploadResult.metadata,
            userAccountId: request.userAccountId
          };

          attestationNFT = await this.rwaAttestationService.createAttestation(attestationRequest);
        } catch (attestationError) {
          errors.push(`Attestation creation failed: ${attestationError instanceof Error ? attestationError.message : 'Unknown error'}`);
        }
      }

      // Step 5: Store processing result in database
      await this.storeProcessingResult({
        uploadResult,
        verificationResult,
        attestationNFT,
        userAccountId: request.userAccountId,
        duplicateCheck
      });

      return {
        uploadResult,
        verificationResult,
        attestationNFT: attestationNFT || undefined,
        processingStatus: errors.length === 0 ? 'completed' : 'partial',
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      errors.push(errorMessage);

      return {
        uploadResult: uploadResult || {} as DocumentUploadResult,
        verificationResult: verificationResult || {} as AssetVerificationResult,
        processingStatus: 'failed',
        errors
      };
    }
  }

  /**
   * Check for duplicate assets using document hash and similarity analysis
   */
  async checkForDuplicates(documentHash: string, userAccountId: string): Promise<DuplicateCheckResult> {
    try {
      // Check exact hash matches
      const exactMatches = await this.findExactHashMatches(documentHash);
      
      // Check for similar documents (placeholder - would use more sophisticated similarity)
      const similarDocuments = await this.findSimilarDocuments(documentHash, userAccountId);

      const allMatches = [...exactMatches, ...similarDocuments];
      const uniqueMatches = this.deduplicateMatches(allMatches);

      return {
        isDuplicate: uniqueMatches.length > 0,
        existingAssets: uniqueMatches,
        similarity: uniqueMatches.length > 0 ? this.calculateMaxSimilarity(uniqueMatches) : 0
      };
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return {
        isDuplicate: false,
        existingAssets: [],
        similarity: 0
      };
    }
  }

  /**
   * Get asset intelligence summary for user
   */
  async getUserAssetSummary(userAccountId: string): Promise<{
    totalAssets: number;
    verifiedAssets: number;
    attestedAssets: number;
    averageConfidenceScore: number;
    assetsByType: Record<string, number>;
    recentActivity: any[];
  }> {
    try {
      const db = this.mongoClient.db();
      const collection = db.collection('asset_intelligence_results');

      // Get user's asset processing results
      const userAssets = await collection.find({ userAccountId }).toArray();

      const totalAssets = userAssets.length;
      const verifiedAssets = userAssets.filter(asset => 
        asset.verificationResult?.verificationStatus === 'verified'
      ).length;
      const attestedAssets = userAssets.filter(asset => asset.attestationNFT).length;

      // Calculate average confidence score
      const confidenceScores = userAssets
        .map(asset => asset.verificationResult?.confidenceScore)
        .filter(score => typeof score === 'number');
      const averageConfidenceScore = confidenceScores.length > 0 
        ? Math.round(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length)
        : 0;

      // Group by asset type
      const assetsByType: Record<string, number> = {};
      userAssets.forEach(asset => {
        const assetType = asset.uploadResult?.metadata?.extractedData?.assetType || 'other';
        assetsByType[assetType] = (assetsByType[assetType] || 0) + 1;
      });

      // Get recent activity (last 10 items)
      const recentActivity = userAssets
        .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
        .slice(0, 10)
        .map(asset => ({
          documentId: asset.uploadResult?.documentId,
          assetType: asset.uploadResult?.metadata?.extractedData?.assetType,
          verificationStatus: asset.verificationResult?.verificationStatus,
          confidenceScore: asset.verificationResult?.confidenceScore,
          processedAt: asset.processedAt,
          hasAttestation: !!asset.attestationNFT
        }));

      return {
        totalAssets,
        verifiedAssets,
        attestedAssets,
        averageConfidenceScore,
        assetsByType,
        recentActivity
      };
    } catch (error) {
      console.error('Error getting user asset summary:', error);
      return {
        totalAssets: 0,
        verifiedAssets: 0,
        attestedAssets: 0,
        averageConfidenceScore: 0,
        assetsByType: {},
        recentActivity: []
      };
    }
  }

  /**
   * Reprocess asset with updated verification rules
   */
  async reprocessAsset(documentId: string, userAccountId: string): Promise<AssetIntelligenceResult> {
    try {
      // Retrieve original processing result
      const db = this.mongoClient.db();
      const collection = db.collection('asset_intelligence_results');
      const originalResult = await collection.findOne({ 
        'uploadResult.documentId': documentId,
        userAccountId 
      });

      if (!originalResult) {
        throw new Error('Original asset processing result not found');
      }

      // Retrieve document from storage
      const documentBuffer = await this.documentUploadService.retrieveDocument(
        originalResult.uploadResult.encryptedFileId
      );

      // Recreate document object
      const document: UploadedDocument = {
        buffer: documentBuffer,
        filename: originalResult.uploadResult.metadata.filename,
        mimeType: originalResult.uploadResult.metadata.mimeType
      };

      // Reprocess with original parameters
      const reprocessRequest: AssetProcessingRequest = {
        document,
        assetType: originalResult.assetType || 'other',
        jurisdiction: originalResult.jurisdiction || 'US',
        assetDescription: originalResult.assetDescription || 'Reprocessed asset',
        userAccountId,
        createAttestation: !!originalResult.attestationNFT
      };

      return await this.processAsset(reprocessRequest);
    } catch (error) {
      throw new Error(`Reprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private isEligibleForAttestation(verificationResult: AssetVerificationResult): boolean {
    return ['verified', 'manual_review'].includes(verificationResult.verificationStatus) &&
           verificationResult.confidenceScore >= 60;
  }

  private async findExactHashMatches(documentHash: string): Promise<Array<{
    documentHash: string;
    attestationId?: string;
    uploadedAt: Date;
    owner: string;
  }>> {
    const db = this.mongoClient.db();
    const collection = db.collection('asset_intelligence_results');

    const matches = await collection.find({ 
      'uploadResult.hash': documentHash 
    }).toArray();

    return matches.map(match => ({
      documentHash: match.uploadResult.hash,
      attestationId: match.attestationNFT?.attestationId,
      uploadedAt: new Date(match.uploadResult.metadata.uploadedAt),
      owner: match.userAccountId
    }));
  }

  private async findSimilarDocuments(documentHash: string, userAccountId: string): Promise<Array<{
    documentHash: string;
    attestationId?: string;
    uploadedAt: Date;
    owner: string;
  }>> {
    // Placeholder for similarity analysis
    // In production, would use more sophisticated document similarity algorithms
    return [];
  }

  private deduplicateMatches(matches: Array<{
    documentHash: string;
    attestationId?: string;
    uploadedAt: Date;
    owner: string;
  }>): Array<{
    documentHash: string;
    attestationId?: string;
    uploadedAt: Date;
    owner: string;
  }> {
    const seen = new Set<string>();
    return matches.filter(match => {
      const key = `${match.documentHash}-${match.owner}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private calculateMaxSimilarity(matches: any[]): number {
    // Placeholder - would calculate actual similarity scores
    return matches.length > 0 ? 100 : 0;
  }

  private async storeProcessingResult(result: {
    uploadResult: DocumentUploadResult;
    verificationResult: AssetVerificationResult;
    attestationNFT: RWAAttestationNFT | null;
    userAccountId: string;
    duplicateCheck: DuplicateCheckResult;
  }): Promise<void> {
    const db = this.mongoClient.db();
    const collection = db.collection('asset_intelligence_results');

    await collection.insertOne({
      ...result,
      processedAt: new Date(),
      version: '1.0'
    });
  }
}