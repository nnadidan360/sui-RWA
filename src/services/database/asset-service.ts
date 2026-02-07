/**
 * Asset Database Service
 * 
 * Handles all database operations for assets
 */

import { Asset, IAsset } from '../../models/Asset';
import { PaginationParams } from '../../types/api';
import { logger } from '../../utils/logger';

export interface CreateAssetRequest {
  tokenId: string;
  assetType: IAsset['assetType'];
  owner: string;
  metadata: {
    title: string;
    description: string;
    location?: IAsset['metadata']['location'];
    valuation: IAsset['metadata']['valuation'];
    documents?: IAsset['metadata']['documents'];
    specifications?: Record<string, any>;
    tags?: string[];
  };
}

export interface UpdateAssetRequest {
  metadata?: Partial<IAsset['metadata']>;
  verification?: Partial<IAsset['verification']>;
  financialData?: Partial<IAsset['financialData']>;
}

export class AssetService {
  /**
   * Create a new asset
   */
  static async createAsset(data: CreateAssetRequest): Promise<IAsset> {
    try {
      const existingAsset = await Asset.findOne({ tokenId: data.tokenId });
      
      if (existingAsset) {
        throw new Error('Asset with this token ID already exists');
      }

      const asset = new Asset({
        tokenId: data.tokenId,
        assetType: data.assetType,
        owner: data.owner.toLowerCase(),
        metadata: {
          ...data.metadata,
          searchKeywords: this.extractKeywords(data.metadata.title, data.metadata.description),
          tags: data.metadata.tags || [],
          documents: data.metadata.documents || [],
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
          currentValue: data.metadata.valuation.amount,
          valueHistory: [{
            value: data.metadata.valuation.amount,
            date: new Date(),
            source: 'initial_valuation',
          }],
          utilizationInLoans: [],
        },
        auditTrail: [{
          action: 'asset_created',
          performedBy: data.owner,
          timestamp: new Date(),
          details: { assetType: data.assetType },
        }],
      });

      await asset.save();
      
      logger.info('Asset created', { assetId: asset._id, tokenId: data.tokenId, owner: data.owner });
      return asset;
    } catch (error) {
      logger.error('Failed to create asset', { error: error.message, tokenId: data.tokenId });
      throw error;
    }
  }

  /**
   * Get asset by token ID
   */
  static async getAssetByTokenId(tokenId: string): Promise<IAsset | null> {
    try {
      const asset = await Asset.findOne({ tokenId });
      return asset;
    } catch (error) {
      logger.error('Failed to get asset by token ID', { error: error.message, tokenId });
      throw error;
    }
  }

  /**
   * Get asset by ID
   */
  static async getAssetById(assetId: string): Promise<IAsset | null> {
    try {
      const asset = await Asset.findById(assetId);
      return asset;
    } catch (error) {
      logger.error('Failed to get asset by ID', { error: error.message, assetId });
      throw error;
    }
  }

  /**
   * Get assets by owner
   */
  static async getAssetsByOwner(
    owner: string,
    params: PaginationParams & { status?: string; assetType?: string }
  ): Promise<{ assets: IAsset[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status,
        assetType,
      } = params;

      const filter: any = { owner: owner.toLowerCase() };
      
      if (status) {
        filter['verification.status'] = status;
      }
      
      if (assetType) {
        filter.assetType = assetType;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [assets, total] = await Promise.all([
        Asset.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Asset.countDocuments(filter),
      ]);

      return { assets, total };
    } catch (error) {
      logger.error('Failed to get assets by owner', { error: error.message, owner });
      throw error;
    }
  }

  /**
   * Update asset
   */
  static async updateAsset(assetId: string, data: UpdateAssetRequest, updatedBy: string): Promise<IAsset | null> {
    try {
      const updateData: any = {};
      
      if (data.metadata) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.metadata).forEach(key => {
          if (key === 'title' || key === 'description') {
            // Update search keywords when title or description changes
            const asset = Asset.findById(assetId);
            // This would need to be handled properly in a real implementation
          }
          updateData.$set[`metadata.${key}`] = data.metadata![key as keyof typeof data.metadata];
        });
      }
      
      if (data.verification) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.verification).forEach(key => {
          updateData.$set[`verification.${key}`] = data.verification![key as keyof typeof data.verification];
        });
      }
      
      if (data.financialData) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.financialData).forEach(key => {
          updateData.$set[`financialData.${key}`] = data.financialData![key as keyof typeof data.financialData];
        });
      }

      // Add audit trail entry
      updateData.$push = {
        auditTrail: {
          action: 'asset_updated',
          performedBy: updatedBy,
          timestamp: new Date(),
          details: { updatedFields: Object.keys(data) },
        },
      };

      const asset = await Asset.findByIdAndUpdate(
        assetId,
        updateData,
        { new: true, runValidators: true }
      );

      if (asset) {
        logger.info('Asset updated', { assetId, updatedBy });
      }

      return asset;
    } catch (error) {
      logger.error('Failed to update asset', { error: error.message, assetId });
      throw error;
    }
  }

  /**
   * Search assets
   */
  static async searchAssets(
    query: string,
    params: PaginationParams & { assetType?: string; status?: string }
  ): Promise<{ assets: IAsset[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        assetType,
        status,
      } = params;

      const searchFilter: any = {
        $or: [
          { 'metadata.title': { $regex: query, $options: 'i' } },
          { 'metadata.description': { $regex: query, $options: 'i' } },
          { 'metadata.searchKeywords': { $in: [new RegExp(query, 'i')] } },
          { 'metadata.tags': { $in: [new RegExp(query, 'i')] } },
          { tokenId: { $regex: query, $options: 'i' } },
        ],
      };

      if (assetType) {
        searchFilter.assetType = assetType;
      }

      if (status) {
        searchFilter['verification.status'] = status;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [assets, total] = await Promise.all([
        Asset.find(searchFilter)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Asset.countDocuments(searchFilter),
      ]);

      return { assets, total };
    } catch (error) {
      logger.error('Failed to search assets', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Update asset verification status
   */
  static async updateVerificationStatus(
    assetId: string,
    status: IAsset['verification']['status'],
    verifiedBy: string,
    notes?: string,
    rejectionReason?: string
  ): Promise<IAsset | null> {
    try {
      const updateData: any = {
        $set: {
          'verification.status': status,
          'verification.verifiedBy': verifiedBy,
          'verification.verificationDate': new Date(),
        },
        $push: {
          auditTrail: {
            action: 'verification_status_updated',
            performedBy: verifiedBy,
            timestamp: new Date(),
            details: { status, notes, rejectionReason },
          },
        },
      };

      if (notes) {
        updateData.$set['verification.notes'] = notes;
      }

      if (rejectionReason) {
        updateData.$set['verification.rejectionReason'] = rejectionReason;
      }

      const asset = await Asset.findByIdAndUpdate(
        assetId,
        updateData,
        { new: true }
      );

      if (asset) {
        logger.info('Asset verification status updated', { assetId, status, verifiedBy });
      }

      return asset;
    } catch (error) {
      logger.error('Failed to update verification status', { error: error.message, assetId });
      throw error;
    }
  }

  /**
   * Add value history entry
   */
  static async addValueHistory(
    assetId: string,
    value: number,
    source: string
  ): Promise<IAsset | null> {
    try {
      const asset = await Asset.findByIdAndUpdate(
        assetId,
        {
          $set: {
            'financialData.currentValue': value,
          },
          $push: {
            'financialData.valueHistory': {
              value,
              date: new Date(),
              source,
            },
            auditTrail: {
              action: 'value_updated',
              performedBy: 'system',
              timestamp: new Date(),
              details: { newValue: value, source },
            },
          },
        },
        { new: true }
      );

      if (asset) {
        logger.info('Asset value updated', { assetId, value, source });
      }

      return asset;
    } catch (error) {
      logger.error('Failed to add value history', { error: error.message, assetId });
      throw error;
    }
  }

  /**
   * Get assets by verification status
   */
  static async getAssetsByVerificationStatus(
    status: IAsset['verification']['status'],
    params: PaginationParams
  ): Promise<{ assets: IAsset[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const filter = { 'verification.status': status };
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [assets, total] = await Promise.all([
        Asset.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Asset.countDocuments(filter),
      ]);

      return { assets, total };
    } catch (error) {
      logger.error('Failed to get assets by verification status', { error: error.message, status });
      throw error;
    }
  }

  /**
   * Extract keywords from title and description for search indexing
   */
  private static extractKeywords(title: string, description: string): string[] {
    const text = `${title} ${description}`.toLowerCase();
    const words = text.match(/\b\w{3,}\b/g) || [];
    return [...new Set(words)]; // Remove duplicates
  }
}