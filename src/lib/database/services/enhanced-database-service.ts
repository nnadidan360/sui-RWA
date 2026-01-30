/**
 * Enhanced Database Service
 * 
 * Provides comprehensive database operations for the enhanced collections:
 * - Asset management with IPFS backup and search
 * - User management with multi-wallet support
 * - Transaction tracking with on-chain/off-chain correlation
 * - Wallet management and monitoring
 */

import { connectToDatabase } from '../connection';
import { Asset, User, Transaction, Wallet } from '../models/index';
import type { IAsset, IUser, ITransaction, IWallet } from '../models/index';

export class EnhancedDatabaseService {
  constructor() {
    // Ensure database connection on service instantiation
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  // ===== ASSET MANAGEMENT =====

  /**
   * Create asset with enhanced search indexing
   */
  async createAsset(assetData: Partial<IAsset>): Promise<IAsset> {
    await this.ensureConnection();
    
    // Extract search keywords from title and description
    const searchKeywords = this.extractSearchKeywords(
      `${assetData.metadata?.title || ''} ${assetData.metadata?.description || ''}`
    );
    
    const asset = new Asset({
      ...assetData,
      metadata: {
        ...assetData.metadata,
        searchKeywords,
        tags: assetData.metadata?.tags || []
      }
    });
    
    return await asset.save();
  }

  /**
   * Search assets with enhanced full-text search
   */
  async searchAssets(query: string, filters?: {
    assetType?: string;
    owner?: string;
    verificationStatus?: string;
    minValue?: number;
    maxValue?: number;
  }): Promise<IAsset[]> {
    await this.ensureConnection();
    
    const searchQuery: any = {};
    
    // Full-text search
    if (query) {
      searchQuery.$text = { $search: query };
    }
    
    // Apply filters
    if (filters?.assetType) {
      searchQuery.assetType = filters.assetType;
    }
    if (filters?.owner) {
      searchQuery.owner = filters.owner;
    }
    if (filters?.verificationStatus) {
      searchQuery['verification.status'] = filters.verificationStatus;
    }
    if (filters?.minValue || filters?.maxValue) {
      searchQuery['financialData.currentValue'] = {};
      if (filters.minValue) {
        searchQuery['financialData.currentValue'].$gte = filters.minValue;
      }
      if (filters.maxValue) {
        searchQuery['financialData.currentValue'].$lte = filters.maxValue;
      }
    }
    
    return await Asset.find(searchQuery)
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .limit(50);
  }

  /**
   * Update IPFS pinning status for asset documents
   */
  async updateIPFSPinningStatus(
    assetId: string, 
    documentIndex: number, 
    status: 'pinned' | 'unpinned' | 'failed' | 'pending',
    backupHashes?: string[]
  ): Promise<void> {
    await this.ensureConnection();
    
    const updateQuery: any = {
      [`metadata.documents.${documentIndex}.pinningStatus`]: status,
      [`metadata.documents.${documentIndex}.lastPinCheck`]: new Date()
    };
    
    if (backupHashes) {
      updateQuery[`metadata.documents.${documentIndex}.backupHashes`] = backupHashes;
    }
    
    await Asset.updateOne({ tokenId: assetId }, { $set: updateQuery });
  }

  // ===== USER MANAGEMENT WITH MULTI-WALLET =====

  /**
   * Create user with initial wallet connection
   */
  async createUser(userData: Partial<IUser>, initialWallet: {
    address: string;
    walletType: string;
    nickname?: string;
  }): Promise<IUser> {
    await this.ensureConnection();
    
    const user = new User({
      ...userData,
      walletAddress: initialWallet.address,
      connectedWallets: [{
        address: initialWallet.address,
        walletType: initialWallet.walletType as any,
        connectionDate: new Date(),
        lastUsed: new Date(),
        isActive: true,
        nickname: initialWallet.nickname
      }]
    });
    
    return await user.save();
  }

  /**
   * Add wallet to user account
   */
  async addWalletToUser(userId: string, walletData: {
    address: string;
    walletType: string;
    nickname?: string;
  }): Promise<IUser | null> {
    await this.ensureConnection();
    
    return await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          connectedWallets: {
            address: walletData.address,
            walletType: walletData.walletType,
            connectionDate: new Date(),
            lastUsed: new Date(),
            isActive: true,
            nickname: walletData.nickname
          }
        }
      },
      { new: true }
    );
  }

  /**
   * Get user by any connected wallet address
   */
  async getUserByWalletAddress(walletAddress: string): Promise<IUser | null> {
    await this.ensureConnection();
    
    return await User.findOne({
      $or: [
        { walletAddress },
        { 'connectedWallets.address': walletAddress }
      ]
    });
  }

  // ===== TRANSACTION TRACKING =====

  /**
   * Create transaction with on-chain/off-chain correlation
   */
  async createTransaction(transactionData: Partial<ITransaction>): Promise<ITransaction> {
    await this.ensureConnection();
    
    const transaction = new Transaction({
      ...transactionData,
      transactionId: transactionData.transactionId || this.generateTransactionId(),
      auditTrail: [{
        action: 'transaction_created',
        timestamp: new Date(),
        details: { status: transactionData.status || 'pending' }
      }]
    });
    
    return await transaction.save();
  }

  /**
   * Update transaction status with blockchain correlation
   */
  async updateTransactionStatus(
    transactionId: string,
    status: string,
    onChainData?: Partial<ITransaction['onChainData']>
  ): Promise<ITransaction | null> {
    await this.ensureConnection();
    
    const updateData: any = {
      status,
      $push: {
        auditTrail: {
          action: `status_updated_to_${status}`,
          timestamp: new Date(),
          details: { previousStatus: status, onChainData }
        }
      }
    };
    
    if (onChainData) {
      Object.keys(onChainData).forEach(key => {
        updateData[`onChainData.${key}`] = onChainData[key as keyof typeof onChainData];
      });
    }
    
    // Update timing fields based on status
    if (status === 'processing') {
      updateData.submittedAt = new Date();
    } else if (status === 'success') {
      updateData.confirmedAt = new Date();
      if (onChainData?.finalityStatus === 'finalized') {
        updateData.finalizedAt = new Date();
      }
    }
    
    return await Transaction.findOneAndUpdate(
      { transactionId },
      updateData,
      { new: true }
    );
  }

  /**
   * Get transactions with correlation data
   */
  async getTransactionsWithCorrelation(filters: {
    userId?: string;
    assetId?: string;
    loanId?: string;
    status?: string;
    type?: string;
    limit?: number;
  }): Promise<ITransaction[]> {
    await this.ensureConnection();
    
    const query: any = {};
    
    if (filters.userId) {
      query.initiator = filters.userId;
    }
    if (filters.assetId) {
      query['offChainData.relatedAssetId'] = filters.assetId;
    }
    if (filters.loanId) {
      query['offChainData.relatedLoanId'] = filters.loanId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    
    return await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);
  }

  // ===== WALLET MANAGEMENT =====

  /**
   * Create wallet record with comprehensive tracking
   */
  async createWallet(walletData: Partial<IWallet>): Promise<IWallet> {
    await this.ensureConnection();
    
    const wallet = new Wallet({
      ...walletData,
      connectionHistory: [{
        connectedAt: new Date(),
        connectionMethod: 'direct'
      }],
      statistics: {
        totalTransactions: 0,
        totalVolume: 0,
        averageTransactionSize: 0
      }
    });
    
    return await wallet.save();
  }

  /**
   * Update wallet activity and statistics
   */
  async updateWalletActivity(
    walletAddress: string,
    activityData: {
      transactionAmount?: number;
      transactionType?: string;
    }
  ): Promise<void> {
    await this.ensureConnection();
    
    const updateData: any = {
      lastActivity: new Date(),
      $inc: {
        'statistics.totalTransactions': 1
      }
    };
    
    if (activityData.transactionAmount) {
      updateData.$inc['statistics.totalVolume'] = activityData.transactionAmount;
    }
    
    await Wallet.updateOne({ address: walletAddress }, updateData);
    
    // Recalculate average transaction size
    const wallet = await Wallet.findOne({ address: walletAddress });
    if (wallet && wallet.statistics.totalTransactions > 0) {
      wallet.statistics.averageTransactionSize = 
        wallet.statistics.totalVolume / wallet.statistics.totalTransactions;
      await wallet.save();
    }
  }

  /**
   * Get wallet analytics and insights
   */
  async getWalletAnalytics(walletAddress: string): Promise<{
    wallet: IWallet | null;
    recentTransactions: ITransaction[];
    riskAssessment: {
      riskLevel: string;
      factors: string[];
    };
  }> {
    await this.ensureConnection();
    
    const wallet = await Wallet.findOne({ address: walletAddress });
    const recentTransactions = await Transaction.find({
      $or: [
        { initiator: walletAddress },
        { recipient: walletAddress }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10);
    
    // Simple risk assessment
    const riskFactors: string[] = [];
    let riskLevel = 'low';
    
    if (wallet?.security.flaggedTransactions.length > 0) {
      riskFactors.push('Has flagged transactions');
      riskLevel = 'medium';
    }
    
    if (wallet?.statistics.totalVolume > 1000000) {
      riskFactors.push('High transaction volume');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    return {
      wallet,
      recentTransactions,
      riskAssessment: {
        riskLevel,
        factors: riskFactors
      }
    };
  }

  // ===== UTILITY METHODS =====

  private extractSearchKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 20); // Limit to 20 keywords
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const enhancedDatabaseService = new EnhancedDatabaseService();