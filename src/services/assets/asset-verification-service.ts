/**
 * Asset Verification Service for Credit OS
 * 
 * Manages asset verification workflow with manual override capabilities
 */

import { logger } from '../../utils/logger';
import { Asset, IAsset } from '../../models/Asset';
import { AssetConfidenceScoringService, AssetVerificationData } from './asset-confidence-scoring-service';

export interface VerificationRequest {
  assetId: string;
  userId: string;
  verifiedBy: string;
  action: 'approve' | 'reject' | 'request_update';
  notes?: string;
  rejectionReason?: string;
}

export interface VerificationResult {
  success: boolean;
  assetId: string;
  newStatus: string;
  confidenceScore?: number;
  message: string;
}

export interface RegistryCheckResult {
  passed: boolean;
  registryName: string;
  matchConfidence: number;
  details?: any;
  timestamp: Date;
}

export class AssetVerificationService {
  private scoringService: AssetConfidenceScoringService;

  constructor() {
    this.scoringService = new AssetConfidenceScoringService();
  }

  /**
   * Submit asset for verification
   */
  async submitForVerification(assetId: string, userId: string): Promise<VerificationResult> {
    try {
      const asset = await Asset.findOne({ tokenId: assetId, owner: userId });

      if (!asset) {
        return {
          success: false,
          assetId,
          newStatus: 'not_found',
          message: 'Asset not found'
        };
      }

      // Check if asset has minimum required documents
      if (asset.metadata.documents.length === 0) {
        return {
          success: false,
          assetId,
          newStatus: asset.verification.status,
          message: 'Asset must have at least one document to submit for verification'
        };
      }

      // Update status to under_review
      asset.verification.status = 'under_review';
      asset.auditTrail.push({
        action: 'submitted_for_verification',
        performedBy: userId,
        timestamp: new Date(),
        details: {
          documentCount: asset.metadata.documents.length
        }
      });

      await asset.save();

      // Calculate initial confidence score
      const verificationData = this.extractVerificationData(asset);
      const confidenceScore = await this.scoringService.calculateConfidenceScore(verificationData);

      logger.info('Asset submitted for verification', {
        assetId,
        userId,
        confidenceScore: confidenceScore.overallScore
      });

      return {
        success: true,
        assetId,
        newStatus: 'under_review',
        confidenceScore: confidenceScore.overallScore,
        message: 'Asset submitted for verification successfully'
      };
    } catch (error: any) {
      logger.error('Failed to submit asset for verification', {
        error: error.message,
        assetId,
        userId
      });

      return {
        success: false,
        assetId,
        newStatus: 'error',
        message: error.message
      };
    }
  }

  /**
   * Perform manual verification (approve/reject)
   */
  async performVerification(request: VerificationRequest): Promise<VerificationResult> {
    try {
      const asset = await Asset.findOne({ 
        tokenId: request.assetId,
        owner: request.userId 
      });

      if (!asset) {
        return {
          success: false,
          assetId: request.assetId,
          newStatus: 'not_found',
          message: 'Asset not found'
        };
      }

      // Update verification status based on action
      switch (request.action) {
        case 'approve':
          asset.verification.status = 'approved';
          asset.verification.verifiedBy = request.verifiedBy;
          asset.verification.verificationDate = new Date();
          asset.verification.notes = request.notes;
          break;

        case 'reject':
          asset.verification.status = 'rejected';
          asset.verification.verifiedBy = request.verifiedBy;
          asset.verification.verificationDate = new Date();
          asset.verification.rejectionReason = request.rejectionReason;
          asset.verification.notes = request.notes;
          break;

        case 'request_update':
          asset.verification.status = 'requires_update';
          asset.verification.notes = request.notes;
          break;
      }

      // Add audit trail
      asset.auditTrail.push({
        action: `verification_${request.action}`,
        performedBy: request.verifiedBy,
        timestamp: new Date(),
        details: {
          notes: request.notes,
          rejectionReason: request.rejectionReason
        }
      });

      await asset.save();

      // Recalculate confidence score
      const verificationData = this.extractVerificationData(asset);
      const confidenceScore = await this.scoringService.calculateConfidenceScore(verificationData);

      logger.info('Asset verification performed', {
        assetId: request.assetId,
        action: request.action,
        verifiedBy: request.verifiedBy,
        confidenceScore: confidenceScore.overallScore
      });

      return {
        success: true,
        assetId: request.assetId,
        newStatus: asset.verification.status,
        confidenceScore: confidenceScore.overallScore,
        message: `Asset ${request.action}d successfully`
      };
    } catch (error: any) {
      logger.error('Failed to perform verification', {
        error: error.message,
        assetId: request.assetId
      });

      return {
        success: false,
        assetId: request.assetId,
        newStatus: 'error',
        message: error.message
      };
    }
  }

  /**
   * Perform registry check (mock implementation)
   */
  async performRegistryCheck(
    assetId: string,
    jurisdiction: string
  ): Promise<RegistryCheckResult> {
    try {
      // Mock implementation - in production would integrate with:
      // - Property registries (land registry, title companies)
      // - Vehicle registries (DMV, VIN databases)
      // - Equipment registries (serial number databases)
      // - Invoice verification services

      const asset = await Asset.findOne({ tokenId: assetId });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Simulate registry check based on asset type
      let passed = false;
      let matchConfidence = 0;
      let registryName = '';

      switch (asset.assetType) {
        case 'real_estate':
          registryName = `${jurisdiction} Land Registry`;
          // Mock: 80% chance of passing for real estate
          passed = Math.random() > 0.2;
          matchConfidence = passed ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.3;
          break;

        case 'equipment':
          registryName = 'Equipment Serial Number Database';
          // Mock: 70% chance of passing for equipment
          passed = Math.random() > 0.3;
          matchConfidence = passed ? 0.75 + Math.random() * 0.25 : 0.2 + Math.random() * 0.4;
          break;

        case 'invoice':
          registryName = 'Invoice Verification Service';
          // Mock: 90% chance of passing for invoices
          passed = Math.random() > 0.1;
          matchConfidence = passed ? 0.90 + Math.random() * 0.10 : 0.1 + Math.random() * 0.3;
          break;

        default:
          registryName = 'General Asset Registry';
          passed = Math.random() > 0.5;
          matchConfidence = 0.5;
      }

      const result: RegistryCheckResult = {
        passed,
        registryName,
        matchConfidence: Math.round(matchConfidence * 100) / 100,
        timestamp: new Date(),
        details: {
          assetType: asset.assetType,
          jurisdiction,
          checkMethod: 'automated'
        }
      };

      // Update asset with registry check result
      await Asset.findOneAndUpdate(
        { tokenId: assetId },
        {
          $push: {
            auditTrail: {
              action: 'registry_check_performed',
              performedBy: 'system',
              timestamp: new Date(),
              details: result
            }
          }
        }
      );

      logger.info('Registry check performed', {
        assetId,
        passed,
        registryName,
        matchConfidence
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to perform registry check', {
        error: error.message,
        assetId,
        jurisdiction
      });

      return {
        passed: false,
        registryName: 'Unknown',
        matchConfidence: 0,
        timestamp: new Date(),
        details: { error: error.message }
      };
    }
  }

  /**
   * Get verification status for an asset
   */
  async getVerificationStatus(assetId: string, userId: string): Promise<{
    status: string;
    confidenceScore?: number;
    recommendations?: string[];
    lastUpdated?: Date;
  }> {
    try {
      const asset = await Asset.findOne({ tokenId: assetId, owner: userId });

      if (!asset) {
        return {
          status: 'not_found'
        };
      }

      // Calculate current confidence score
      const verificationData = this.extractVerificationData(asset);
      const confidenceScore = await this.scoringService.calculateConfidenceScore(verificationData);

      return {
        status: asset.verification.status,
        confidenceScore: confidenceScore.overallScore,
        recommendations: confidenceScore.recommendations,
        lastUpdated: asset.verification.verificationDate || asset.updatedAt
      };
    } catch (error: any) {
      logger.error('Failed to get verification status', {
        error: error.message,
        assetId,
        userId
      });

      return {
        status: 'error'
      };
    }
  }

  /**
   * Extract verification data from asset
   */
  private extractVerificationData(asset: IAsset): AssetVerificationData {
    const documents = asset.metadata.documents;
    
    return {
      documentCount: documents.length,
      hasDeed: documents.some(d => d.type === 'deed'),
      hasAppraisal: documents.some(d => d.type === 'appraisal'),
      hasInsurance: documents.some(d => d.type === 'insurance'),
      verificationStatus: asset.verification.status,
      registryCheckPassed: undefined, // Would be set from actual registry check
      duplicatesFound: 0, // Would be set from duplicate detection
      metadataFields: this.countMetadataFields(asset),
      totalMetadataFields: 10, // Expected metadata fields
      jurisdiction: asset.metadata.location?.address?.split(',').pop()?.trim() || '',
      documentAgeInDays: this.calculateDocumentAge(documents)
    };
  }

  /**
   * Count completed metadata fields
   */
  private countMetadataFields(asset: IAsset): number {
    let count = 0;

    if (asset.metadata.title) count++;
    if (asset.metadata.description) count++;
    if (asset.metadata.location?.address) count++;
    if (asset.metadata.valuation?.amount) count++;
    if (asset.metadata.valuation?.appraiser) count++;
    if (asset.metadata.specifications) count++;
    if (asset.metadata.searchKeywords.length > 0) count++;
    if (asset.metadata.tags.length > 0) count++;
    if (asset.assetType) count++;
    if (asset.metadata.documents.length > 0) count++;

    return count;
  }

  /**
   * Calculate average document age in days
   */
  private calculateDocumentAge(documents: any[]): number {
    if (documents.length === 0) {
      return 0;
    }

    const now = new Date();
    const totalAge = documents.reduce((sum, doc) => {
      const uploadDate = new Date(doc.uploadDate);
      const ageInDays = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + ageInDays;
    }, 0);

    return Math.floor(totalAge / documents.length);
  }

  /**
   * Bulk verification for multiple assets
   */
  async bulkVerification(
    assetIds: string[],
    verifiedBy: string,
    action: 'approve' | 'reject'
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const assetId of assetIds) {
      const result = await this.performVerification({
        assetId,
        userId: '', // Would need to fetch from asset
        verifiedBy,
        action,
        notes: `Bulk ${action} operation`
      });

      results.push(result);
    }

    logger.info('Bulk verification completed', {
      count: assetIds.length,
      action,
      verifiedBy
    });

    return results;
  }
}
