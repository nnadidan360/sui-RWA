/**
 * User Activity Analytics Service
 * 
 * Provides comprehensive user activity analytics and search capabilities:
 * - User behavior tracking and analysis
 * - Activity pattern recognition
 * - Performance metrics and insights
 * - Advanced search and filtering
 */

import { connectToDatabase } from '../connection';
import { Asset, User, Transaction, Wallet } from '../models';
import type { IAsset, IUser, ITransaction, IWallet } from '../models';

export interface UserActivityMetrics {
  userId: string;
  walletAddress: string;
  totalAssets: number;
  totalTransactions: number;
  totalVolume: number;
  averageTransactionSize: number;
  activityScore: number;
  lastActivity: Date;
  preferredAssetTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  transactionPatterns: {
    hourlyDistribution: number[];
    dailyDistribution: number[];
    monthlyDistribution: number[];
  };
  riskProfile: {
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  };
}

export interface ActivityInsight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedUsers: number;
  recommendation?: string;
  data?: any;
}

export interface SearchFilters {
  walletAddress?: string;
  assetTypes?: string[];
  transactionTypes?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  volumeRange?: {
    min: number;
    max: number;
  };
  activityLevel?: 'low' | 'medium' | 'high';
  riskLevel?: 'low' | 'medium' | 'high';
  kycStatus?: string;
  countries?: string[];
}

export class UserAnalyticsService {
  constructor() {}

  /**
   * Get comprehensive user activity metrics
   */
  async getUserMetrics(walletAddress: string): Promise<UserActivityMetrics | null> {
    await connectToDatabase();

    const user = await User.findOne({
      $or: [
        { walletAddress },
        { 'connectedWallets.address': walletAddress }
      ]
    });

    if (!user) {
      return null;
    }

    // Get user's assets
    const assets = await Asset.find({ owner: walletAddress });
    
    // Get user's transactions
    const transactions = await Transaction.find({
      $or: [
        { initiator: walletAddress },
        { recipient: walletAddress }
      ]
    });

    // Get user's wallets
    const wallets = await Wallet.find({
      $or: [
        { address: walletAddress },
        { userId: user._id.toString() }
      ]
    });

    // Calculate metrics
    const totalVolume = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const averageTransactionSize = transactions.length > 0 ? totalVolume / transactions.length : 0;

    // Calculate activity score (0-100)
    const activityScore = this.calculateActivityScore({
      assetCount: assets.length,
      transactionCount: transactions.length,
      totalVolume,
      lastActivity: user.activityLog[user.activityLog.length - 1]?.timestamp || user.createdAt,
      accountAge: Date.now() - user.createdAt.getTime()
    });

    // Analyze asset type preferences
    const assetTypeCounts = assets.reduce((acc, asset) => {
      acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const preferredAssetTypes = Object.entries(assetTypeCounts)
      .map(([type, count]) => ({
        type,
        count: count as number,
        percentage: ((count as number) / assets.length) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // Analyze transaction patterns
    const transactionPatterns = this.analyzeTransactionPatterns(transactions);

    // Calculate risk profile
    const riskProfile = this.calculateRiskProfile(user, assets, transactions, wallets);

    return {
      userId: user._id.toString(),
      walletAddress: user.walletAddress,
      totalAssets: assets.length,
      totalTransactions: transactions.length,
      totalVolume,
      averageTransactionSize,
      activityScore,
      lastActivity: user.activityLog[user.activityLog.length - 1]?.timestamp || user.createdAt,
      preferredAssetTypes,
      transactionPatterns,
      riskProfile
    };
  }

  /**
   * Get platform-wide activity insights
   */
  async getActivityInsights(dateRange?: { start: Date; end: Date }): Promise<ActivityInsight[]> {
    await connectToDatabase();

    const insights: ActivityInsight[] = [];
    const query: any = {};
    
    if (dateRange) {
      query.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    // Get recent data
    const users = await User.find(query);
    const assets = await Asset.find(query);
    const transactions = await Transaction.find(query);

    // Analyze user growth trends
    const userGrowthInsight = this.analyzeUserGrowth(users);
    if (userGrowthInsight) insights.push(userGrowthInsight);

    // Analyze transaction volume trends
    const volumeInsight = this.analyzeVolumePatterns(transactions);
    if (volumeInsight) insights.push(volumeInsight);

    // Detect anomalies
    const anomalies = this.detectAnomalies(users, assets, transactions);
    insights.push(...anomalies);

    // Identify opportunities
    const opportunities = this.identifyOpportunities(users, assets, transactions);
    insights.push(...opportunities);

    // Risk analysis
    const riskInsights = this.analyzeRisks(users, assets, transactions);
    insights.push(...riskInsights);

    return insights.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Advanced user search with filters
   */
  async searchUsers(filters: SearchFilters, limit: number = 50, offset: number = 0): Promise<{
    users: IUser[];
    total: number;
    metrics: {
      totalVolume: number;
      averageActivityScore: number;
      riskDistribution: Record<string, number>;
    };
  }> {
    await connectToDatabase();

    const query: any = {};

    // Apply filters
    if (filters.walletAddress) {
      query.$or = [
        { walletAddress: filters.walletAddress },
        { 'connectedWallets.address': filters.walletAddress }
      ];
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    if (filters.kycStatus) {
      query['kyc.status'] = filters.kycStatus;
    }

    if (filters.countries && filters.countries.length > 0) {
      query['profile.country'] = { $in: filters.countries };
    }

    // Get users
    const users = await User.find(query)
      .skip(offset)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Calculate metrics for filtered users
    const userIds = users.map(u => u.walletAddress);
    
    const userTransactions = await Transaction.find({
      $or: [
        { initiator: { $in: userIds } },
        { recipient: { $in: userIds } }
      ]
    });

    const totalVolume = userTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    
    // Calculate activity scores for filtered users
    const activityScores = await Promise.all(
      users.map(async (user) => {
        const userAssets = await Asset.countDocuments({ owner: user.walletAddress });
        const userTxs = userTransactions.filter(tx => 
          tx.initiator === user.walletAddress || tx.recipient === user.walletAddress
        );
        const userVolume = userTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        return this.calculateActivityScore({
          assetCount: userAssets,
          transactionCount: userTxs.length,
          totalVolume: userVolume,
          lastActivity: user.activityLog[user.activityLog.length - 1]?.timestamp || user.createdAt,
          accountAge: Date.now() - user.createdAt.getTime()
        });
      })
    );

    const averageActivityScore = activityScores.reduce((sum, score) => sum + score, 0) / activityScores.length;

    // Risk distribution
    const riskDistribution = users.reduce((acc, user) => {
      const riskLevel = user.compliance?.riskRating || 'low';
      acc[riskLevel] = (acc[riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      users,
      total,
      metrics: {
        totalVolume,
        averageActivityScore: averageActivityScore || 0,
        riskDistribution
      }
    };
  }

  /**
   * Get user activity timeline
   */
  async getUserActivityTimeline(
    walletAddress: string,
    limit: number = 100
  ): Promise<Array<{
    timestamp: Date;
    type: 'asset_created' | 'transaction' | 'login' | 'kyc_update' | 'other';
    description: string;
    metadata?: any;
  }>> {
    await connectToDatabase();

    const user = await User.findOne({
      $or: [
        { walletAddress },
        { 'connectedWallets.address': walletAddress }
      ]
    });

    if (!user) {
      return [];
    }

    const timeline: Array<{
      timestamp: Date;
      type: 'asset_created' | 'transaction' | 'login' | 'kyc_update' | 'other';
      description: string;
      metadata?: any;
    }> = [];

    // Add user activity log entries
    user.activityLog.forEach((log: any) => {
      timeline.push({
        timestamp: log.timestamp,
        type: this.categorizeActivity(log.action),
        description: log.action,
        metadata: log.details
      });
    });

    // Add asset creation events
    const assets = await Asset.find({ owner: walletAddress });
    assets.forEach(asset => {
      timeline.push({
        timestamp: asset.createdAt,
        type: 'asset_created',
        description: `Created asset: ${asset.metadata.title}`,
        metadata: {
          assetId: asset.tokenId,
          assetType: asset.assetType,
          value: asset.financialData.currentValue
        }
      });
    });

    // Add transaction events
    const transactions = await Transaction.find({
      $or: [
        { initiator: walletAddress },
        { recipient: walletAddress }
      ]
    }).limit(50);

    transactions.forEach(tx => {
      timeline.push({
        timestamp: tx.createdAt,
        type: 'transaction',
        description: `${tx.type} transaction: ${tx.amount} ${tx.currency}`,
        metadata: {
          transactionId: tx.transactionId,
          type: tx.type,
          amount: tx.amount,
          status: tx.status
        }
      });
    });

    // Sort by timestamp and limit
    return timeline
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Private helper methods
   */
  private calculateActivityScore(data: {
    assetCount: number;
    transactionCount: number;
    totalVolume: number;
    lastActivity: Date;
    accountAge: number;
  }): number {
    const weights = {
      assets: 0.3,
      transactions: 0.25,
      volume: 0.25,
      recency: 0.2
    };

    // Normalize values (0-100 scale)
    const assetScore = Math.min(data.assetCount * 10, 100);
    const transactionScore = Math.min(data.transactionCount * 2, 100);
    const volumeScore = Math.min(data.totalVolume / 10000 * 100, 100);
    
    // Recency score (higher for more recent activity)
    const daysSinceActivity = (Date.now() - data.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 100 - daysSinceActivity * 2);

    return Math.round(
      assetScore * weights.assets +
      transactionScore * weights.transactions +
      volumeScore * weights.volume +
      recencyScore * weights.recency
    );
  }

  private analyzeTransactionPatterns(transactions: ITransaction[]): {
    hourlyDistribution: number[];
    dailyDistribution: number[];
    monthlyDistribution: number[];
  } {
    const hourlyDistribution = new Array(24).fill(0);
    const dailyDistribution = new Array(7).fill(0);
    const monthlyDistribution = new Array(12).fill(0);

    transactions.forEach(tx => {
      const date = new Date(tx.createdAt);
      hourlyDistribution[date.getHours()]++;
      dailyDistribution[date.getDay()]++;
      monthlyDistribution[date.getMonth()]++;
    });

    return {
      hourlyDistribution,
      dailyDistribution,
      monthlyDistribution
    };
  }

  private calculateRiskProfile(
    user: IUser,
    assets: IAsset[],
    transactions: ITransaction[],
    wallets: IWallet[]
  ): {
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  } {
    const factors: string[] = [];
    let riskScore = 0;

    // Check compliance status
    if (user.compliance?.amlStatus === 'flagged') {
      factors.push('AML flagged');
      riskScore += 30;
    }

    if (user.compliance?.pepStatus) {
      factors.push('Politically Exposed Person');
      riskScore += 20;
    }

    // Check transaction patterns
    const totalVolume = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    if (totalVolume > 1000000) {
      factors.push('High transaction volume');
      riskScore += 15;
    }

    // Check failed transactions
    const failedTxs = transactions.filter(tx => tx.status === 'failed').length;
    if (failedTxs > transactions.length * 0.1) {
      factors.push('High failure rate');
      riskScore += 10;
    }

    // Check wallet security
    const flaggedWallets = wallets.filter(w => w.security?.riskLevel === 'high').length;
    if (flaggedWallets > 0) {
      factors.push('High-risk wallets');
      riskScore += 25;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 25) {
      riskLevel = 'medium';
    }

    return {
      riskLevel,
      factors,
      score: riskScore
    };
  }

  private analyzeUserGrowth(users: IUser[]): ActivityInsight | null {
    if (users.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentUsers = users.filter(u => u.createdAt >= thirtyDaysAgo);
    
    const growthRate = (recentUsers.length / users.length) * 100;

    return {
      type: 'trend',
      title: 'User Growth Analysis',
      description: `${recentUsers.length} new users in the last 30 days (${growthRate.toFixed(1)}% growth rate)`,
      severity: growthRate > 20 ? 'high' : growthRate > 10 ? 'medium' : 'low',
      affectedUsers: recentUsers.length,
      data: { growthRate, newUsers: recentUsers.length }
    };
  }

  private analyzeVolumePatterns(transactions: ITransaction[]): ActivityInsight | null {
    if (transactions.length === 0) return null;

    const totalVolume = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const averageVolume = totalVolume / transactions.length;

    return {
      type: 'trend',
      title: 'Transaction Volume Analysis',
      description: `Total volume: ${totalVolume.toLocaleString()}, Average: ${averageVolume.toFixed(2)}`,
      severity: 'medium',
      affectedUsers: transactions.length,
      data: { totalVolume, averageVolume }
    };
  }

  private detectAnomalies(users: IUser[], assets: IAsset[], transactions: ITransaction[]): ActivityInsight[] {
    const insights: ActivityInsight[] = [];

    // Detect unusual transaction patterns
    const highValueTxs = transactions.filter(tx => (tx.amount || 0) > 100000);
    if (highValueTxs.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'High-Value Transactions Detected',
        description: `${highValueTxs.length} transactions above $100,000 detected`,
        severity: 'high',
        affectedUsers: new Set(highValueTxs.map(tx => tx.initiator)).size,
        recommendation: 'Review high-value transactions for compliance'
      });
    }

    return insights;
  }

  private identifyOpportunities(users: IUser[], assets: IAsset[], transactions: ITransaction[]): ActivityInsight[] {
    const insights: ActivityInsight[] = [];

    // Identify users with high activity but low asset count
    const activeUsers = users.filter(u => u.activityLog.length > 10);
    const lowAssetUsers = activeUsers.filter(u => {
      const userAssets = assets.filter(a => a.owner === u.walletAddress);
      return userAssets.length < 2;
    });

    if (lowAssetUsers.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Asset Tokenization Opportunity',
        description: `${lowAssetUsers.length} active users with few tokenized assets`,
        severity: 'medium',
        affectedUsers: lowAssetUsers.length,
        recommendation: 'Target these users for asset tokenization campaigns'
      });
    }

    return insights;
  }

  private analyzeRisks(users: IUser[], assets: IAsset[], transactions: ITransaction[]): ActivityInsight[] {
    const insights: ActivityInsight[] = [];

    // Check for users with expired KYC
    const expiredKycUsers = users.filter(u => u.kyc?.status === 'expired');
    if (expiredKycUsers.length > 0) {
      insights.push({
        type: 'risk',
        title: 'Expired KYC Documents',
        description: `${expiredKycUsers.length} users have expired KYC documentation`,
        severity: 'high',
        affectedUsers: expiredKycUsers.length,
        recommendation: 'Contact users to update their KYC documentation'
      });
    }

    return insights;
  }

  private categorizeActivity(action: string): 'asset_created' | 'transaction' | 'login' | 'kyc_update' | 'other' {
    if (action.includes('login')) return 'login';
    if (action.includes('kyc')) return 'kyc_update';
    if (action.includes('asset')) return 'asset_created';
    if (action.includes('transaction')) return 'transaction';
    return 'other';
  }
}

export const userAnalyticsService = new UserAnalyticsService();