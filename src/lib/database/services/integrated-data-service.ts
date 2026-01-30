/**
 * Integrated Data Service
 * 
 * Demonstrates the complete database as secondary lookup system integration
 * with real-time synchronization, conflict resolution, and automated reconciliation.
 */

import { connectToDatabase } from '../connection';
import { secondaryLookupService, type LookupOptions } from './secondary-lookup-service';
import { blockchainSyncService } from './blockchain-sync-service';
import { reconciliationService } from './reconciliation-service';
import { enhancedDatabaseService } from './enhanced-database-service';
import type { IAsset, IUser, ITransaction, IWallet } from '../models/index';

export interface DataServiceConfig {
  enableRealTimeSync: boolean;
  enableReconciliation: boolean;
  cachePreferences: {
    defaultTtl: number;
    preferCache: boolean;
    fallbackToDatabase: boolean;
  };
  syncIntervals: {
    blockchain: number;
    reconciliation: number;
  };
}

export interface ServiceHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    blockchain: 'connected' | 'disconnected' | 'error';
    database: 'connected' | 'disconnected' | 'error';
    cache: 'active' | 'inactive' | 'error';
    sync: 'running' | 'stopped' | 'error';
  };
  metrics: {
    cacheHitRate: number;
    syncLatency: number;
    conflictCount: number;
    lastSuccessfulSync: Date;
  };
}

/**
 * Integrated Data Service
 * 
 * This service orchestrates all database and blockchain integration services
 * to provide a unified data access layer with secondary lookup capabilities.
 */
export class IntegratedDataService {
  private config: DataServiceConfig;
  private isInitialized = false;

  constructor(config?: Partial<DataServiceConfig>) {
    this.config = {
      enableRealTimeSync: true,
      enableReconciliation: true,
      cachePreferences: {
        defaultTtl: 300000, // 5 minutes
        preferCache: true,
        fallbackToDatabase: true
      },
      syncIntervals: {
        blockchain: 30000, // 30 seconds
        reconciliation: 3600000 // 1 hour
      },
      ...config
    };
  }

  /**
   * Initialize the integrated data service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Integrated data service already initialized');
      return;
    }

    try {
      console.log('Initializing integrated data service...');

      // Ensure database connection
      await connectToDatabase();

      // Start blockchain synchronization if enabled
      if (this.config.enableRealTimeSync) {
        await blockchainSyncService.startSync();
        console.log('Blockchain synchronization started');
      }

      // Start reconciliation service if enabled
      if (this.config.enableReconciliation) {
        await reconciliationService.startReconciliation();
        console.log('Reconciliation service started');
      }

      this.isInitialized = true;
      console.log('Integrated data service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize integrated data service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the integrated data service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      console.log('Shutting down integrated data service...');

      // Stop synchronization services
      await blockchainSyncService.stopSync();
      await reconciliationService.stopReconciliation();

      this.isInitialized = false;
      console.log('Integrated data service shut down successfully');
    } catch (error) {
      console.error('Error during integrated data service shutdown:', error);
    }
  }

  /**
   * Get asset with intelligent data sourcing
   * Demonstrates the secondary lookup system in action
   */
  async getAsset(tokenId: string, options?: Partial<LookupOptions>): Promise<any> {
    this.ensureInitialized();

    const lookupOptions: LookupOptions = {
      preferCache: this.config.cachePreferences.preferCache,
      maxAge: this.config.cachePreferences.defaultTtl,
      fallbackToDatabase: this.config.cachePreferences.fallbackToDatabase,
      ...options
    };

    return await secondaryLookupService.getAssetData(tokenId, lookupOptions);
  }

  /**
   * Get user balance with real-time blockchain integration
   */
  async getUserBalance(walletAddress: string, options?: Partial<LookupOptions>): Promise<any> {
    this.ensureInitialized();

    const lookupOptions: LookupOptions = {
      preferCache: this.config.cachePreferences.preferCache,
      maxAge: this.config.cachePreferences.defaultTtl,
      fallbackToDatabase: this.config.cachePreferences.fallbackToDatabase,
      ...options
    };

    return await secondaryLookupService.getUserBalance(walletAddress, lookupOptions);
  }

  /**
   * Get transaction status with blockchain priority
   */
  async getTransactionStatus(deployHash: string, options?: Partial<LookupOptions>): Promise<ITransaction | null> {
    this.ensureInitialized();

    const lookupOptions: LookupOptions = {
      preferCache: false, // Always prefer fresh data for transactions
      maxAge: 60000, // 1 minute cache for transactions
      fallbackToDatabase: this.config.cachePreferences.fallbackToDatabase,
      ...options
    };

    return await secondaryLookupService.getTransactionStatus(deployHash, lookupOptions);
  }

  /**
   * Get staking position with external wallet integration
   */
  async getStakingPosition(walletAddress: string, options?: Partial<LookupOptions>): Promise<any> {
    this.ensureInitialized();

    const lookupOptions: LookupOptions = {
      preferCache: this.config.cachePreferences.preferCache,
      maxAge: this.config.cachePreferences.defaultTtl,
      fallbackToDatabase: this.config.cachePreferences.fallbackToDatabase,
      ...options
    };

    return await secondaryLookupService.getStakingPosition(walletAddress, lookupOptions);
  }

  /**
   * Batch operations with optimized data sourcing
   */
  async batchGetAssets(tokenIds: string[], options?: Partial<LookupOptions>): Promise<Map<string, IAsset | null>> {
    this.ensureInitialized();

    const lookupOptions: LookupOptions = {
      preferCache: this.config.cachePreferences.preferCache,
      maxAge: this.config.cachePreferences.defaultTtl,
      fallbackToDatabase: this.config.cachePreferences.fallbackToDatabase,
      ...options
    };

    return await secondaryLookupService.batchGetAssets(tokenIds, lookupOptions);
  }

  /**
   * Force refresh user data across all services
   */
  async refreshUserData(walletAddress: string): Promise<void> {
    this.ensureInitialized();

    // Refresh in secondary lookup service
    await secondaryLookupService.refreshUserData(walletAddress);

    // Force blockchain sync for this user
    await blockchainSyncService.forceSync();

    // Update enhanced database service
    const user = await enhancedDatabaseService.getUserByWalletAddress(walletAddress);
    if (user) {
      // Update user activity
      await enhancedDatabaseService.updateWalletActivity(walletAddress, {
        transactionType: 'data_refresh'
      });
    }
  }

  /**
   * Get comprehensive service health status
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const syncStatus = secondaryLookupService.getStatus();
    const cacheStats = secondaryLookupService.getCacheStats();
    const conflicts = blockchainSyncService.getUnresolvedConflicts();

    // Test database connection
    let databaseStatus: ServiceHealth['components']['database'] = 'connected';
    try {
      await connectToDatabase();
    } catch (error) {
      databaseStatus = 'error';
    }

    // Test blockchain connection
    let blockchainStatus: ServiceHealth['components']['blockchain'] = 'connected';
    try {
      // This would test actual blockchain connectivity
      blockchainStatus = 'connected';
    } catch (error) {
      blockchainStatus = 'error';
    }

    // Determine overall health
    let overall: ServiceHealth['overall'] = 'healthy';
    if (databaseStatus === 'error' || blockchainStatus === 'error') {
      overall = 'unhealthy';
    } else if (conflicts.length > 10 || cacheStats.hitRate < 50) {
      overall = 'degraded';
    }

    return {
      overall,
      components: {
        blockchain: blockchainStatus,
        database: databaseStatus,
        cache: 'active',
        sync: blockchainSyncService.isServiceRunning() ? 'running' : 'stopped'
      },
      metrics: {
        cacheHitRate: cacheStats.hitRate,
        syncLatency: 0, // Would measure actual sync latency
        conflictCount: conflicts.length,
        lastSuccessfulSync: syncStatus.lastSync
      }
    };
  }

  /**
   * Get detailed service metrics
   */
  getServiceMetrics() {
    return {
      cache: secondaryLookupService.getCacheStats(),
      sync: secondaryLookupService.getStatus(),
      conflicts: blockchainSyncService.getConflicts(),
      reconciliation: {
        lastRun: reconciliationService.getLastReconciliationTime(),
        isRunning: reconciliationService.isServiceRunning(),
        unresolvedIssues: reconciliationService.getUnresolvedIssues().length
      }
    };
  }

  /**
   * Manual conflict resolution
   */
  async resolveConflicts(): Promise<void> {
    this.ensureInitialized();

    // Force reconciliation
    await reconciliationService.forceReconciliation();

    // Force blockchain sync
    await blockchainSyncService.forceSync();

    console.log('Manual conflict resolution completed');
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<DataServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Service configuration updated:', newConfig);
  }

  /**
   * Get current service configuration
   */
  getConfig(): DataServiceConfig {
    return { ...this.config };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Integrated data service not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const integratedDataService = new IntegratedDataService();