/**
 * Secondary Lookup Service
 * 
 * Implements database as secondary lookup system with:
 * - Database caching layer for blockchain data
 * - Real-time synchronization with on-chain state
 * - Conflict resolution prioritizing on-chain data
 * - Automated reconciliation and audit processes
 */

import { connectToDatabase } from '../connection';
import { Asset, User, Transaction, Wallet } from '../models/index';
import type { IAsset, IUser, ITransaction, IWallet } from '../models/index';
import { getCasperBlockchainService } from '../../blockchain/casper-service';
import { getCasperClient } from '../../casper/client';
import { blockchainSyncService } from './blockchain-sync-service';

export interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  source: 'blockchain' | 'database' | 'hybrid';
  isStale: boolean;
}

export interface LookupOptions {
  preferCache?: boolean;
  maxAge?: number; // milliseconds
  fallbackToDatabase?: boolean;
  forceRefresh?: boolean;
}

export interface SyncStatus {
  lastSync: Date;
  isHealthy: boolean;
  pendingConflicts: number;
  cacheHitRate: number;
  totalQueries: number;
}

/**
 * Secondary Lookup Service
 * 
 * This service implements the database as a secondary lookup system,
 * providing fast access to blockchain data while maintaining consistency
 * with the on-chain state.
 */
export class SecondaryLookupService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private casperService = getCasperBlockchainService();
  private casperClient = getCasperClient();
  private queryStats = {
    total: 0,
    cacheHits: 0,
    cacheMisses: 0,
    blockchainQueries: 0,
    databaseQueries: 0
  };

  constructor(
    private defaultCacheTtl: number = 300000, // 5 minutes
    private maxCacheSize: number = 10000
  ) {
    this.startCacheCleanup();
  }

  /**
   * Get asset data with secondary lookup
   * Prioritizes on-chain data but falls back to database cache
   */
  async getAssetData(
    tokenId: string, 
    options: LookupOptions = {}
  ): Promise<any> {
    this.queryStats.total++;
    const cacheKey = `asset_${tokenId}`;

    try {
      // Check cache first if not forcing refresh
      if (!options.forceRefresh) {
        const cached = this.getCachedData<IAsset>(cacheKey, options.maxAge);
        if (cached) {
          this.queryStats.cacheHits++;
          return cached.data;
        }
      }

      this.queryStats.cacheMisses++;

      // Try to get from blockchain first (primary source)
      let blockchainData: IAsset | null = null;
      try {
        const onChainAsset = await this.casperService.getAssetTokenInfo(tokenId);
        if (onChainAsset) {
          // Convert blockchain data to database format
          blockchainData = await this.convertBlockchainAssetToDb(onChainAsset);
          this.queryStats.blockchainQueries++;
        }
      } catch (error) {
        console.warn(`Blockchain query failed for asset ${tokenId}:`, error);
      }

      // If blockchain data available, cache and return it
      if (blockchainData) {
        this.setCachedData(cacheKey, blockchainData, 'blockchain');
        
        // Update database in background for consistency
        this.updateDatabaseAssetInBackground(blockchainData);
        
        return blockchainData;
      }

      // Fallback to database if blockchain unavailable
      if (options.fallbackToDatabase !== false) {
        this.queryStats.databaseQueries++;
        const dbAsset = await Asset.findOne({ tokenId });
        
        if (dbAsset) {
          // Cache database result with shorter TTL since it might be stale
          this.setCachedData(cacheKey, dbAsset, 'database', this.defaultCacheTtl / 2);
          return dbAsset;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in secondary lookup for asset ${tokenId}:`, error);
      
      // Last resort: try database
      try {
        const dbAsset = await Asset.findOne({ tokenId });
        return dbAsset || null;
      } catch (dbError) {
        console.error(`Database fallback failed for asset ${tokenId}:`, dbError);
        return null;
      }
    }
  }

  /**
   * Get user balance with secondary lookup
   */
  async getUserBalance(
    walletAddress: string,
    options: LookupOptions = {}
  ): Promise<{ balance: string; currency: string; lastUpdated: Date } | null> {
    this.queryStats.total++;
    const cacheKey = `balance_${walletAddress}`;

    try {
      // Check cache first
      if (!options.forceRefresh) {
        const cached = this.getCachedData<any>(cacheKey, options.maxAge);
        if (cached) {
          this.queryStats.cacheHits++;
          return cached.data;
        }
      }

      this.queryStats.cacheMisses++;

      // Try blockchain first
      try {
        const balance = await this.casperService.getAccountBalance(walletAddress);
        const balanceData = {
          balance,
          currency: 'CSPR',
          lastUpdated: new Date()
        };

        this.queryStats.blockchainQueries++;
        this.setCachedData(cacheKey, balanceData, 'blockchain');
        
        // Update database in background
        this.updateDatabaseBalanceInBackground(walletAddress, balanceData);
        
        return balanceData;
      } catch (error) {
        console.warn(`Blockchain balance query failed for ${walletAddress}:`, error);
      }

      // Fallback to database
      if (options.fallbackToDatabase !== false) {
        this.queryStats.databaseQueries++;
        const wallet = await Wallet.findOne({ address: walletAddress });
        
        if (wallet && wallet.balances && wallet.balances.length > 0) {
          const balanceData = {
            balance: wallet.balances[0].amount.toString(),
            currency: wallet.balances[0].currency,
            lastUpdated: wallet.lastBalanceCheck || new Date()
          };
          
          this.setCachedData(cacheKey, balanceData, 'database', this.defaultCacheTtl / 2);
          return balanceData;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in balance lookup for ${walletAddress}:`, error);
      return null;
    }
  }

  /**
   * Get transaction status with secondary lookup
   */
  async getTransactionStatus(
    deployHash: string,
    options: LookupOptions = {}
  ): Promise<ITransaction | null> {
    this.queryStats.total++;
    const cacheKey = `transaction_${deployHash}`;

    try {
      // Check cache first
      if (!options.forceRefresh) {
        const cached = this.getCachedData<ITransaction>(cacheKey, options.maxAge);
        if (cached) {
          this.queryStats.cacheHits++;
          return cached.data;
        }
      }

      this.queryStats.cacheMisses++;

      // Try blockchain first
      try {
        const deployInfo = await this.casperClient.getDeployInfo(deployHash);
        const transactionData = await this.convertBlockchainTransactionToDb(deployInfo, deployHash);
        
        this.queryStats.blockchainQueries++;
        this.setCachedData(cacheKey, transactionData, 'blockchain');
        
        // Update database in background
        this.updateDatabaseTransactionInBackground(transactionData);
        
        return transactionData;
      } catch (error) {
        console.warn(`Blockchain transaction query failed for ${deployHash}:`, error);
      }

      // Fallback to database
      if (options.fallbackToDatabase !== false) {
        this.queryStats.databaseQueries++;
        const dbTransaction = await Transaction.findOne({ deployHash });
        
        if (dbTransaction) {
          this.setCachedData(cacheKey, dbTransaction, 'database', this.defaultCacheTtl / 2);
          return dbTransaction;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in transaction lookup for ${deployHash}:`, error);
      return null;
    }
  }

  /**
   * Get user staking position with secondary lookup
   */
  async getStakingPosition(
    walletAddress: string,
    options: LookupOptions = {}
  ): Promise<any | null> {
    this.queryStats.total++;
    const cacheKey = `staking_${walletAddress}`;

    try {
      // Check cache first
      if (!options.forceRefresh) {
        const cached = this.getCachedData<any>(cacheKey, options.maxAge);
        if (cached) {
          this.queryStats.cacheHits++;
          return cached.data;
        }
      }

      this.queryStats.cacheMisses++;

      // Try blockchain first
      try {
        const stakingMetrics = await this.casperService.getStakingMetrics(walletAddress);
        
        this.queryStats.blockchainQueries++;
        this.setCachedData(cacheKey, stakingMetrics, 'blockchain');
        
        // Update database in background
        this.updateDatabaseStakingInBackground(walletAddress, stakingMetrics);
        
        return stakingMetrics;
      } catch (error) {
        console.warn(`Blockchain staking query failed for ${walletAddress}:`, error);
      }

      // Fallback to database
      if (options.fallbackToDatabase !== false) {
        this.queryStats.databaseQueries++;
        const wallet = await Wallet.findOne({ address: walletAddress });
        
        if (wallet && wallet.statistics) {
          const stakingData = {
            totalStaked: wallet.statistics.totalVolume,
            currentValue: wallet.statistics.totalVolume,
            totalRewards: 0,
            exchangeRate: 1.0,
            apr: 0,
            unbondingAmount: 0,
            activePositions: wallet.statistics.totalTransactions
          };
          
          this.setCachedData(cacheKey, stakingData, 'database', this.defaultCacheTtl / 2);
          return stakingData;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error in staking lookup for ${walletAddress}:`, error);
      return null;
    }
  }

  /**
   * Batch lookup for multiple assets
   */
  async batchGetAssets(
    tokenIds: string[],
    options: LookupOptions = {}
  ): Promise<Map<string, IAsset | null>> {
    const results = new Map<string, IAsset | null>();
    
    // Process in batches to avoid overwhelming the blockchain
    const batchSize = 10;
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      const batchPromises = batch.map(tokenId => 
        this.getAssetData(tokenId, options).then(result => ({ tokenId, result }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          const { tokenId, result } = promiseResult.value;
          results.set(tokenId, result);
        }
      }
    }
    
    return results;
  }

  /**
   * Invalidate cache for specific key or pattern
   */
  invalidateCache(keyOrPattern: string): void {
    if (keyOrPattern.includes('*')) {
      // Pattern matching
      const pattern = keyOrPattern.replace('*', '');
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Exact key
      this.cache.delete(keyOrPattern);
    }
  }

  /**
   * Force refresh of all cached data for a user
   */
  async refreshUserData(walletAddress: string): Promise<void> {
    // Invalidate all cache entries for this user
    this.invalidateCache(`*${walletAddress}*`);
    
    // Force refresh key data
    await Promise.allSettled([
      this.getUserBalance(walletAddress, { forceRefresh: true }),
      this.getStakingPosition(walletAddress, { forceRefresh: true })
    ]);
  }

  /**
   * Get service status and statistics
   */
  getStatus(): SyncStatus {
    const cacheHitRate = this.queryStats.total > 0 
      ? (this.queryStats.cacheHits / this.queryStats.total) * 100 
      : 0;

    return {
      lastSync: blockchainSyncService.getLastSyncTime(),
      isHealthy: blockchainSyncService.isServiceRunning(),
      pendingConflicts: blockchainSyncService.getUnresolvedConflicts().length,
      cacheHitRate,
      totalQueries: this.queryStats.total
    };
  }

  /**
   * Get detailed cache statistics
   */
  getCacheStats() {
    return {
      ...this.queryStats,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      hitRate: this.queryStats.total > 0 
        ? (this.queryStats.cacheHits / this.queryStats.total) * 100 
        : 0
    };
  }

  // Private helper methods

  private getCachedData<T>(key: string, maxAge?: number): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = new Date();
    const age = now.getTime() - entry.cachedAt.getTime();
    const effectiveMaxAge = maxAge || this.defaultCacheTtl;

    if (age > effectiveMaxAge || now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  private setCachedData<T>(
    key: string, 
    data: T, 
    source: CacheEntry<T>['source'],
    ttl?: number
  ): void {
    const now = new Date();
    const effectiveTtl = ttl || this.defaultCacheTtl;
    
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + effectiveTtl),
      source,
      isStale: source === 'database'
    };

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  private async convertBlockchainAssetToDb(onChainAsset: any): Promise<any> {
    // Convert blockchain asset format to database format
    return {
      tokenId: onChainAsset.tokenId,
      owner: onChainAsset.owner,
      assetType: 'real_estate', // Default, would need to be determined from contract
      financialData: {
        currentValue: parseFloat(onChainAsset.assetValue),
        currency: 'USD'
      },
      verification: {
        status: onChainAsset.verified ? 'approved' : 'pending',
        verifiedAt: new Date(),
        verifier: 'blockchain'
      },
      onChainData: {
        contractAddress: onChainAsset.contractAddress,
        blockNumber: onChainAsset.blockNumber,
        transactionHash: onChainAsset.transactionHash
      },
      metadata: {
        title: `Asset ${onChainAsset.tokenId}`,
        description: 'Asset retrieved from blockchain',
        documents: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
  }

  private async convertBlockchainTransactionToDb(deployInfo: any, deployHash: string): Promise<ITransaction> {
    let status = 'pending';
    let gasUsed = 0;

    if (deployInfo.execution_results && deployInfo.execution_results.length > 0) {
      const result = deployInfo.execution_results[0];
      if (result.result.Success) {
        status = 'success';
        gasUsed = parseInt(result.result.Success.cost);
      } else if (result.result.Failure) {
        status = 'failed';
        gasUsed = parseInt(result.result.Failure.cost);
      } else {
        status = 'processing';
      }
    }

    return {
      transactionId: `tx_${deployHash}`,
      deployHash,
      type: 'blockchain_transaction',
      status,
      amount: 0, // Would need to parse from deploy
      currency: 'CSPR',
      initiator: deployInfo.header.account,
      recipient: '', // Would need to parse from deploy
      onChainData: {
        gasUsed,
        blockNumber: 0, // Would need to get from block info
        confirmations: status === 'success' ? 1 : 0
      },
      createdAt: new Date(deployInfo.header.timestamp),
      updatedAt: new Date(),
      submittedAt: new Date(deployInfo.header.timestamp),
      confirmedAt: status === 'success' ? new Date() : undefined
    } as ITransaction;
  }

  private async updateDatabaseAssetInBackground(assetData: IAsset): Promise<void> {
    try {
      await Asset.updateOne(
        { tokenId: assetData.tokenId },
        { $set: assetData },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating database asset in background:', error);
    }
  }

  private async updateDatabaseBalanceInBackground(
    walletAddress: string, 
    balanceData: any
  ): Promise<void> {
    try {
      await Wallet.updateOne(
        { address: walletAddress },
        {
          $set: {
            'balances.0': {
              currency: balanceData.currency,
              amount: parseFloat(balanceData.balance),
              lastUpdated: balanceData.lastUpdated
            },
            lastBalanceCheck: balanceData.lastUpdated
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating database balance in background:', error);
    }
  }

  private async updateDatabaseTransactionInBackground(transactionData: ITransaction): Promise<void> {
    try {
      await Transaction.updateOne(
        { deployHash: transactionData.deployHash },
        { $set: transactionData },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating database transaction in background:', error);
    }
  }

  private async updateDatabaseStakingInBackground(
    walletAddress: string, 
    stakingData: any
  ): Promise<void> {
    try {
      await Wallet.updateOne(
        { address: walletAddress },
        {
          $set: {
            'statistics.totalVolume': stakingData.totalStaked,
            'statistics.totalTransactions': stakingData.activePositions,
            lastActivity: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating database staking in background:', error);
    }
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }
}

// Export singleton instance
export const secondaryLookupService = new SecondaryLookupService();