/**
 * Server-side Integration Service
 * Handles the integration between blockchain data and MongoDB
 * Only runs on the server side
 */

import { getCasperBlockchainService } from '@/lib/blockchain/casper-service';
import { MongoClient, Db, Collection } from 'mongodb';
import { User, Asset, StakingPosition, Loan, Transaction, LendingPool, LendingPosition } from '@/lib/database/models';

export interface UserData {
  walletAddress: string;
  stakingMetrics: {
    totalStaked: number;
    currentValue: number;
    totalRewards: number;
    exchangeRate: number;
    apr: number;
    unbondingAmount: number;
    activePositions: number;
  };
  lendingPosition: {
    deposits: string;
    borrows: string;
    collateral: string;
    healthFactor: number;
    liquidationThreshold: number;
  };
  assets: Asset[];
  transactions: Transaction[];
}

export interface OverviewData {
  totalValueLocked: number;
  totalStakers: number;
  averageAPR: number;
  activeValidators: number;
  networkStakingRatio: number;
  lendingPools: {
    totalDeposits: string;
    totalBorrows: string;
    utilizationRate: number;
    depositAPY: number;
    borrowAPY: number;
    availableLiquidity: string;
  };
}

class IntegrationService {
  private blockchainService = getCasperBlockchainService();
  private db: Db | null = null;
  private isConnected = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      const client = new MongoClient(process.env.MONGODB_URI!);
      await client.connect();
      this.db = client.db(process.env.MONGODB_DB_NAME);
      this.isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
    }
  }

  async getUserData(walletAddress: string): Promise<UserData> {
    try {
      const [stakingMetrics, lendingPosition] = await Promise.allSettled([
        this.blockchainService.getStakingMetrics(walletAddress),
        this.blockchainService.getUserPosition(walletAddress)
      ]);

      const [assets, transactions] = await Promise.all([
        this.getUserAssets(walletAddress),
        this.getUserTransactions(walletAddress)
      ]);

      return {
        walletAddress,
        stakingMetrics: stakingMetrics.status === 'fulfilled' ? stakingMetrics.value : this.getDefaultStakingMetrics(),
        lendingPosition: lendingPosition.status === 'fulfilled' ? lendingPosition.value : this.getDefaultLendingPosition(),
        assets,
        transactions
      };
    } catch (error) {
      console.error('Error getting user data:', error);
      return this.getFallbackUserData(walletAddress);
    }
  }

  async getOverviewData(): Promise<OverviewData> {
    try {
      const [networkStats, lendingPoolInfo] = await Promise.allSettled([
        this.blockchainService.getNetworkStats(),
        this.blockchainService.getLendingPoolInfo()
      ]);

      return {
        totalValueLocked: networkStats.status === 'fulfilled' ? networkStats.value.totalValueLocked : 0,
        totalStakers: networkStats.status === 'fulfilled' ? networkStats.value.totalStakers : 0,
        averageAPR: networkStats.status === 'fulfilled' ? networkStats.value.averageAPR : 0,
        activeValidators: networkStats.status === 'fulfilled' ? networkStats.value.activeValidators : 0,
        networkStakingRatio: networkStats.status === 'fulfilled' ? networkStats.value.networkStakingRatio : 0,
        lendingPools: lendingPoolInfo.status === 'fulfilled' ? lendingPoolInfo.value : this.getDefaultLendingPoolInfo()
      };
    } catch (error) {
      console.error('Error getting overview data:', error);
      return this.getFallbackOverviewData();
    }
  }

  private async getUserAssets(walletAddress: string): Promise<Asset[]> {
    if (!this.isConnected || !this.db) return [];
    const assetsCollection = this.db.collection<Asset>('assets');
    return await assetsCollection.find({ owner: walletAddress }).toArray();
  }

  private async getUserTransactions(walletAddress: string): Promise<Transaction[]> {
    if (!this.isConnected || !this.db) return [];
    const transactionsCollection = this.db.collection<Transaction>('transactions');
    return await transactionsCollection
      .find({ userId: walletAddress })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
  }

  private async getFallbackUserData(walletAddress: string): Promise<UserData> {
    const [assets, transactions] = await Promise.all([
      this.getUserAssets(walletAddress),
      this.getUserTransactions(walletAddress)
    ]);

    return {
      walletAddress,
      stakingMetrics: this.getDefaultStakingMetrics(),
      lendingPosition: this.getDefaultLendingPosition(),
      assets,
      transactions
    };
  }

  private async getFallbackOverviewData(): Promise<OverviewData> {
    return {
      totalValueLocked: 0,
      totalStakers: 0,
      averageAPR: 0,
      activeValidators: 0,
      networkStakingRatio: 0,
      lendingPools: this.getDefaultLendingPoolInfo()
    };
  }

  private getDefaultStakingMetrics() {
    return {
      totalStaked: 0,
      currentValue: 0,
      totalRewards: 0,
      exchangeRate: 1.0,
      apr: 0,
      unbondingAmount: 0,
      activePositions: 0
    };
  }

  private getDefaultLendingPosition() {
    return {
      deposits: '0',
      borrows: '0',
      collateral: '0',
      healthFactor: 0,
      liquidationThreshold: 0
    };
  }

  async createAsset(assetData: Omit<Asset, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }

    const assetsCollection = this.db.collection<Asset>('assets');
    const result = await assetsCollection.insertOne({
      ...assetData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return result.insertedId.toString();
  }

  async updateAssetStatus(tokenId: string, status: Asset['status'], verificationData?: Asset['verificationData']): Promise<void> {
    if (!this.isConnected || !this.db) return;

    const assetsCollection = this.db.collection<Asset>('assets');
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (verificationData) {
      updateData.verificationData = verificationData;
    }

    await assetsCollection.updateOne(
      { tokenId },
      { $set: updateData }
    );
  }

  async recordTransaction(transactionData: Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.isConnected || !this.db) return;

    const transactionsCollection = this.db.collection<Transaction>('transactions');
    await transactionsCollection.insertOne({
      ...transactionData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async syncUserDataToMongoDB(walletAddress: string): Promise<void> {
    if (!this.isConnected || !this.db) return;

    try {
      const [stakingMetrics, lendingPosition] = await Promise.all([
        this.blockchainService.getStakingMetrics(walletAddress),
        this.blockchainService.getUserPosition(walletAddress)
      ]);

      const usersCollection = this.db.collection<User>('users');
      await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            walletAddress,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date(),
            kycStatus: 'pending',
            preferences: {
              language: 'en',
              currency: 'USD',
              notifications: true
            }
          }
        },
        { upsert: true }
      );

      console.log(`Synced data for user ${walletAddress}`);
    } catch (error) {
      console.error('Error syncing user data to MongoDB:', error);
    }
  }

  private getDefaultLendingPoolInfo() {
    return {
      totalDeposits: '0',
      totalBorrows: '0',
      utilizationRate: 0,
      depositAPY: 0,
      borrowAPY: 0,
      availableLiquidity: '0'
    };
  }
}

let integrationService: IntegrationService | null = null;

export function getIntegrationService(): IntegrationService {
  if (!integrationService) {
    integrationService = new IntegrationService();
  }
  return integrationService;
}