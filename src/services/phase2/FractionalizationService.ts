// PHASE 2: Asset Tokenization and Fractionalization
// Service for managing fractionalization business logic

import { FractionalToken, IFractionalToken } from '../../models/phase2/FractionalToken';
import { Asset } from '../../models/Asset';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export class FractionalizationService {
  // Validation constants
  private static readonly MINIMUM_SUPPLY = 100;
  private static readonly MAXIMUM_SUPPLY = 10000000;
  private static readonly MINIMUM_VALUE = 10000; // $10,000
  private static readonly FRACTIONALIZATION_FEE = 25; // $25

  /**
   * Validate fractionalization request
   */
  static validateFractionalizationRequest(
    supply: number,
    price: number
  ): { valid: boolean; error?: string } {
    if (supply < this.MINIMUM_SUPPLY || supply > this.MAXIMUM_SUPPLY) {
      return {
        valid: false,
        error: `Supply must be between ${this.MINIMUM_SUPPLY} and ${this.MAXIMUM_SUPPLY}`
      };
    }

    if (price <= 0) {
      return {
        valid: false,
        error: 'Price per token must be greater than 0'
      };
    }

    const totalValue = supply * price;
    if (totalValue < this.MINIMUM_VALUE) {
      return {
        valid: false,
        error: `Total asset value must be at least $${this.MINIMUM_VALUE}`
      };
    }

    return { valid: true };
  }

  /**
   * Check if asset can be fractionalized
   */
  static async canFractionalize(assetId: string): Promise<{
    canFractionalize: boolean;
    reason?: string;
  }> {
    // Check if asset exists
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return { canFractionalize: false, reason: 'Asset not found' };
    }

    // Check if already fractionalized
    const existing = await FractionalToken.findOne({ originalAssetId: assetId });
    if (existing) {
      return { canFractionalize: false, reason: 'Asset already fractionalized' };
    }

    // Check asset verification status
    if (asset.verification.status !== 'approved') {
      return {
        canFractionalize: false,
        reason: 'Asset must be verified before fractionalization'
      };
    }

    return { canFractionalize: true };
  }

  /**
   * Create fractionalization request
   */
  static async createFractionalizationRequest(
    assetId: string,
    userId: string,
    supply: number,
    price: number,
    assetName?: string,
    assetDescription?: string
  ): Promise<IFractionalToken> {
    // Validate request
    const validation = this.validateFractionalizationRequest(supply, price);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if can fractionalize
    const canFractionalize = await this.canFractionalize(assetId);
    if (!canFractionalize.canFractionalize) {
      throw new Error(canFractionalize.reason);
    }

    // Get asset details
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Verify ownership
    if (asset.owner.toString() !== userId) {
      throw new Error('Not authorized to fractionalize this asset');
    }

    // Calculate values
    const assetValue = supply * price;

    // Create fractional token
    const fractionalToken = new FractionalToken({
      originalAssetId: assetId,
      assetName: assetName || asset.metadata.title,
      assetDescription: assetDescription || asset.metadata.description,
      assetType: this.mapAssetType(asset.assetType),
      totalSupply: supply,
      circulatingSupply: supply,
      pricePerToken: price,
      tradingEnabled: false,
      status: 'pending',
      createdBy: userId,
      holders: [{
        userId: new mongoose.Types.ObjectId(userId),
        balance: supply,
        percentage: 100,
        acquiredAt: new Date(),
        totalDividendsReceived: 0
      }],
      assetValue,
      lastValuationUpdate: new Date()
    });

    await fractionalToken.save();

    logger.info('Fractionalization request created', {
      tokenId: fractionalToken._id,
      assetId,
      supply,
      price
    });

    return fractionalToken;
  }

  /**
   * Approve fractionalization and activate trading
   */
  static async approveFractionalization(
    tokenId: string,
    adminId: string
  ): Promise<IFractionalToken> {
    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      throw new Error('Fractional token not found');
    }

    if (token.status !== 'pending') {
      throw new Error('Token is not in pending status');
    }

    token.status = 'active';
    token.tradingEnabled = true;
    await token.save();

    logger.info('Fractionalization approved', {
      tokenId,
      approvedBy: adminId
    });

    return token;
  }

  /**
   * Transfer tokens between holders
   */
  static async transferTokens(
    tokenId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<IFractionalToken> {
    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      throw new Error('Fractional token not found');
    }

    if (!token.tradingEnabled) {
      throw new Error('Trading is not enabled for this token');
    }

    // Find sender's holding
    const senderHolding = token.holders.find(
      h => h.userId.toString() === fromUserId
    );

    if (!senderHolding || senderHolding.balance < amount) {
      throw new Error('Insufficient token balance');
    }

    // Update sender's balance
    senderHolding.balance -= amount;
    senderHolding.percentage = (senderHolding.balance / token.totalSupply) * 100;

    // Find or create receiver's holding
    let receiverHolding = token.holders.find(
      h => h.userId.toString() === toUserId
    );

    if (receiverHolding) {
      receiverHolding.balance += amount;
      receiverHolding.percentage = (receiverHolding.balance / token.totalSupply) * 100;
    } else {
      token.holders.push({
        userId: new mongoose.Types.ObjectId(toUserId),
        balance: amount,
        percentage: (amount / token.totalSupply) * 100,
        acquiredAt: new Date(),
        totalDividendsReceived: 0
      });
    }

    // Remove holders with zero balance
    token.holders = token.holders.filter(h => h.balance > 0);

    await token.save();

    logger.info('Tokens transferred', {
      tokenId,
      from: fromUserId,
      to: toUserId,
      amount
    });

    return token;
  }

  /**
   * Update asset valuation
   */
  static async updateValuation(
    tokenId: string,
    newAssetValue: number
  ): Promise<IFractionalToken> {
    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      throw new Error('Fractional token not found');
    }

    const oldValue = token.assetValue;
    token.assetValue = newAssetValue;
    token.pricePerToken = Math.floor(newAssetValue / token.totalSupply);
    token.lastValuationUpdate = new Date();

    await token.save();

    logger.info('Asset valuation updated', {
      tokenId,
      oldValue,
      newValue: newAssetValue,
      newPricePerToken: token.pricePerToken
    });

    return token;
  }

  /**
   * Get token statistics
   */
  static async getTokenStatistics(tokenId: string) {
    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      throw new Error('Fractional token not found');
    }

    return {
      totalSupply: token.totalSupply,
      circulatingSupply: token.circulatingSupply,
      pricePerToken: token.pricePerToken,
      assetValue: token.assetValue,
      marketCap: token.totalSupply * token.pricePerToken,
      totalHolders: token.holders.length,
      tradingEnabled: token.tradingEnabled,
      status: token.status,
      totalDividendsDistributed: token.totalDividendsDistributed
    };
  }

  /**
   * Get holder portfolio
   */
  static async getHolderPortfolio(userId: string) {
    const tokens = await FractionalToken.find({
      'holders.userId': userId
    }).populate('originalAssetId');

    return tokens.map(token => {
      const holding = token.holders.find(h => h.userId.toString() === userId);
      return {
        tokenId: token._id,
        assetName: token.assetName,
        assetType: token.assetType,
        balance: holding?.balance || 0,
        percentage: holding?.percentage || 0,
        value: (holding?.balance || 0) * token.pricePerToken,
        totalDividends: holding?.totalDividendsReceived || 0,
        acquiredAt: holding?.acquiredAt
      };
    });
  }

  /**
   * Map asset type to fractional token type
   */
  private static mapAssetType(assetType: string): 'property' | 'equipment' | 'vehicle' | 'invoice' | 'other' {
    const typeMap: Record<string, 'property' | 'equipment' | 'vehicle' | 'invoice' | 'other'> = {
      'real-estate': 'property',
      'property': 'property',
      'equipment': 'equipment',
      'vehicle': 'vehicle',
      'invoice': 'invoice'
    };

    return typeMap[assetType.toLowerCase()] || 'other';
  }
}
