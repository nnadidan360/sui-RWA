/**
 * Comprehensive Off-Chain Data Management Service
 * 
 * Integrates all off-chain data management capabilities:
 * - Asset tokenization workflow tracking
 * - User activity analytics and search
 * - Document version control and history
 * - Cross-wallet transaction correlation
 */

import { connectToDatabase } from '../connection';
import { Asset, User, Transaction, Wallet } from '../models/index';
import type { IAsset, IUser, ITransaction, IWallet } from '../models/index';
import type { Model } from 'mongoose';

export interface ComprehensiveSearchFilters {
  assetTypes?: string[];
  verificationStatus?: string[];
  valueRange?: { min: number; max: number };
  walletAddresses?: string[];
  kycStatus?: string[];
  riskLevels?: string[];
  transactionTypes?: string[];
  amountRange?: { min: number; max: number };
  workflowStages?: string[];
  dateRange?: { start: Date; end: Date };
  searchText?: string;
  keywords?: string[];
  tags?: string[];
}

export interface PlatformMetrics {
  totalAssets: number;
  totalUsers: number;
  totalTransactions: number;
  totalVolume: number;
  activeWorkflows: number;
  completedWorkflows: number;
  topAssetTypes: Array<{ type: string; count: number; percentage: number }>;
  userGrowthRate: number;
  transactionGrowthRate: number;
  riskDistribution: Record<string, number>;
}

export class ComprehensiveDataManagementService {
  constructor() {}

  /**
   * Perform comprehensive search across all data types
   */
  async comprehensiveSearch(
    filters: ComprehensiveSearchFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    assets: IAsset[];
    users: IUser[];
    transactions: ITransaction[];
    wallets: IWallet[];
    total: {
      assets: number;
      users: number;
      transactions: number;
      wallets: number;
    };
  }> {
    await connectToDatabase();

    // Build queries for each data type
    const assetQuery = this.buildAssetQuery(filters);
    const userQuery = this.buildUserQuery(filters);
    const transactionQuery = this.buildTransactionQuery(filters);
    const walletQuery = this.buildWalletQuery(filters);

    // Execute searches in parallel
    const assetPromise = Asset.find(assetQuery).skip(offset).limit(limit).sort({ createdAt: -1 });
    const userPromise = User.find(userQuery).skip(offset).limit(limit).sort({ createdAt: -1 });
    const transactionPromise = Transaction.find(transactionQuery).skip(offset).limit(limit).sort({ createdAt: -1 });
    const walletPromise = Wallet.find(walletQuery).skip(offset).limit(limit).sort({ createdAt: -1 });

    const [assets, users, transactions, wallets] = await Promise.all([
      assetPromise,
      userPromise,
      transactionPromise,
      walletPromise
    ]);

    // Get totals
    const [totalAssets, totalUsers, totalTransactions, totalWallets] = await Promise.all([
      Asset.countDocuments(assetQuery),
      User.countDocuments(userQuery),
      Transaction.countDocuments(transactionQuery),
      Wallet.countDocuments(walletQuery)
    ]);

    return {
      assets,
      users,
      transactions,
      wallets,
      total: {
        assets: totalAssets,
        users: totalUsers,
        transactions: totalTransactions,
        wallets: totalWallets
      }
    };
  }

  /**
   * Get platform-wide metrics and analytics
   */
  async getPlatformMetrics(dateRange?: { start: Date; end: Date }): Promise<PlatformMetrics> {
    await connectToDatabase();

    const query: any = {};
    if (dateRange) {
      query.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    // Get basic counts
    const [totalAssets, totalUsers, totalTransactions] = await Promise.all([
      Asset.countDocuments(query),
      User.countDocuments(query),
      Transaction.countDocuments(query)
    ]);

    // Get total volume
    const volumeResult = await Transaction.aggregate([
      { $match: query },
      { $group: { _id: null, totalVolume: { $sum: '$amount' } } }
    ]);
    const totalVolume = volumeResult[0]?.totalVolume || 0;

    // Get workflow counts
    const [activeWorkflows, completedWorkflows] = await Promise.all([
      Asset.countDocuments({ 'workflow.currentStage': { $ne: 'completed' } }),
      Asset.countDocuments({ 'workflow.currentStage': 'completed' })
    ]);

    // Get asset type distribution
    const assetTypeResult = await Asset.aggregate([
      { $match: query },
      { $group: { _id: '$assetType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const topAssetTypes = assetTypeResult.map(item => ({
      type: item._id,
      count: item.count,
      percentage: totalAssets > 0 ? (item.count / totalAssets) * 100 : 0
    }));

    // Calculate growth rates
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentUsers, recentTransactions] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Transaction.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    const userGrowthRate = totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0;
    const transactionGrowthRate = totalTransactions > 0 ? (recentTransactions / totalTransactions) * 100 : 0;

    // Get risk distribution
    const riskResult = await User.aggregate([
      { $match: query },
      { $group: { _id: '$compliance.riskRating', count: { $sum: 1 } } }
    ]);

    const riskDistribution = riskResult.reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssets,
      totalUsers,
      totalTransactions,
      totalVolume,
      activeWorkflows,
      completedWorkflows,
      topAssetTypes,
      userGrowthRate,
      transactionGrowthRate,
      riskDistribution
    };
  }

  /**
   * Private helper methods
   */
  private buildAssetQuery(filters: ComprehensiveSearchFilters): any {
    const query: any = {};

    if (filters.assetTypes && filters.assetTypes.length > 0) {
      query.assetType = { $in: filters.assetTypes };
    }

    if (filters.verificationStatus && filters.verificationStatus.length > 0) {
      query['verification.status'] = { $in: filters.verificationStatus };
    }

    if (filters.valueRange) {
      query['financialData.currentValue'] = {
        $gte: filters.valueRange.min,
        $lte: filters.valueRange.max
      };
    }

    if (filters.workflowStages && filters.workflowStages.length > 0) {
      query['workflow.currentStage'] = { $in: filters.workflowStages };
    }

    if (filters.searchText) {
      query.$text = { $search: filters.searchText };
    }

    if (filters.keywords && filters.keywords.length > 0) {
      query['metadata.searchKeywords'] = { $in: filters.keywords };
    }

    if (filters.tags && filters.tags.length > 0) {
      query['metadata.tags'] = { $in: filters.tags };
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return query;
  }

  private buildUserQuery(filters: ComprehensiveSearchFilters): any {
    const query: any = {};

    if (filters.walletAddresses && filters.walletAddresses.length > 0) {
      query.$or = [
        { walletAddress: { $in: filters.walletAddresses } },
        { 'connectedWallets.address': { $in: filters.walletAddresses } }
      ];
    }

    if (filters.kycStatus && filters.kycStatus.length > 0) {
      query['kyc.status'] = { $in: filters.kycStatus };
    }

    if (filters.riskLevels && filters.riskLevels.length > 0) {
      query['compliance.riskRating'] = { $in: filters.riskLevels };
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return query;
  }

  private buildTransactionQuery(filters: ComprehensiveSearchFilters): any {
    const query: any = {};

    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      query.type = { $in: filters.transactionTypes };
    }

    if (filters.amountRange) {
      query.amount = {
        $gte: filters.amountRange.min,
        $lte: filters.amountRange.max
      };
    }

    if (filters.walletAddresses && filters.walletAddresses.length > 0) {
      query.$or = [
        { initiator: { $in: filters.walletAddresses } },
        { recipient: { $in: filters.walletAddresses } }
      ];
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return query;
  }

  private buildWalletQuery(filters: ComprehensiveSearchFilters): any {
    const query: any = {};

    if (filters.walletAddresses && filters.walletAddresses.length > 0) {
      query.address = { $in: filters.walletAddresses };
    }

    if (filters.riskLevels && filters.riskLevels.length > 0) {
      query['security.riskLevel'] = { $in: filters.riskLevels };
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    return query;
  }
}

export const comprehensiveDataManagementService = new ComprehensiveDataManagementService();