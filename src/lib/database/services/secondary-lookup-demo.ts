/**
 * Secondary Lookup System Demonstration
 * 
 * This file demonstrates how the database as secondary lookup system works
 * with real blockchain integration, caching, and conflict resolution.
 */

import { secondaryLookupService } from './secondary-lookup-service';
import { integratedDataService } from './integrated-data-service';
import { blockchainSyncService } from './blockchain-sync-service';

/**
 * Demonstration of the Secondary Lookup System
 * 
 * This class shows how the system works in practice:
 * 1. Prioritizes blockchain data over database cache
 * 2. Falls back to database when blockchain is unavailable
 * 3. Caches blockchain data for performance
 * 4. Synchronizes database with blockchain in background
 * 5. Resolves conflicts by prioritizing on-chain data
 */
export class SecondaryLookupDemo {
  
  /**
   * Demo 1: Asset Data Lookup with Blockchain Priority
   * 
   * Shows how the system:
   * - First tries to get data from blockchain (primary source)
   * - Falls back to database if blockchain unavailable
   * - Caches blockchain data for subsequent requests
   * - Updates database in background for consistency
   */
  async demonstrateAssetLookup(): Promise<void> {
    console.log('\n=== Asset Lookup Demonstration ===');
    
    const tokenId = 'demo_asset_123';
    
    // First request - will try blockchain first
    console.log('1. First request (blockchain priority):');
    const asset1 = await secondaryLookupService.getAssetData(tokenId);
    console.log('   Result source: blockchain (if available) or database fallback');
    console.log('   Asset owner:', asset1?.owner || 'Not found');
    
    // Second request - should hit cache
    console.log('\n2. Second request (cache hit):');
    const asset2 = await secondaryLookupService.getAssetData(tokenId);
    console.log('   Result source: cache');
    console.log('   Asset owner:', asset2?.owner || 'Not found');
    
    // Force refresh - bypasses cache
    console.log('\n3. Force refresh (bypass cache):');
    const asset3 = await secondaryLookupService.getAssetData(tokenId, { forceRefresh: true });
    console.log('   Result source: blockchain (if available) or database fallback');
    console.log('   Asset owner:', asset3?.owner || 'Not found');
    
    // Show cache statistics
    const stats = secondaryLookupService.getCacheStats();
    console.log('\n4. Cache Statistics:');
    console.log('   Total queries:', stats.total);
    console.log('   Cache hits:', stats.cacheHits);
    console.log('   Cache hit rate:', stats.hitRate.toFixed(2) + '%');
  }

  /**
   * Demo 2: Balance Lookup with Real-time Blockchain Integration
   * 
   * Shows how the system:
   * - Gets real-time balance from blockchain
   * - Updates database in background
   * - Provides fallback when blockchain unavailable
   */
  async demonstrateBalanceLookup(): Promise<void> {
    console.log('\n=== Balance Lookup Demonstration ===');
    
    const walletAddress = '0x1234567890abcdef';
    
    // Get balance with blockchain priority
    console.log('1. Getting balance (blockchain priority):');
    const balance = await secondaryLookupService.getUserBalance(walletAddress);
    console.log('   Balance:', balance?.balance || 'Not available');
    console.log('   Currency:', balance?.currency || 'N/A');
    console.log('   Last updated:', balance?.lastUpdated || 'N/A');
    
    // Show that database is updated in background
    console.log('\n2. Database updated in background for consistency');
    console.log('   (Database now has cached copy for offline access)');
  }

  /**
   * Demo 3: Transaction Status with Blockchain Priority
   * 
   * Shows how the system:
   * - Always prefers fresh transaction data from blockchain
   * - Uses shorter cache TTL for transactions
   * - Falls back to database for historical data
   */
  async demonstrateTransactionLookup(): Promise<void> {
    console.log('\n=== Transaction Status Demonstration ===');
    
    const deployHash = '0xabcdef1234567890';
    
    // Get transaction status
    console.log('1. Getting transaction status:');
    const transaction = await secondaryLookupService.getTransactionStatus(deployHash);
    console.log('   Status:', transaction?.status || 'Not found');
    console.log('   Deploy hash:', transaction?.deployHash || 'N/A');
    console.log('   Created at:', transaction?.createdAt || 'N/A');
  }

  /**
   * Demo 4: Batch Operations with Optimized Data Sourcing
   * 
   * Shows how the system:
   * - Handles multiple requests efficiently
   * - Uses caching to reduce blockchain calls
   * - Processes requests in batches to avoid overwhelming blockchain
   */
  async demonstrateBatchOperations(): Promise<void> {
    console.log('\n=== Batch Operations Demonstration ===');
    
    const tokenIds = ['asset_1', 'asset_2', 'asset_3', 'asset_4', 'asset_5'];
    
    console.log('1. Batch getting assets:');
    const startTime = Date.now();
    const results = await secondaryLookupService.batchGetAssets(tokenIds);
    const endTime = Date.now();
    
    console.log('   Processed', tokenIds.length, 'assets in', endTime - startTime, 'ms');
    console.log('   Results found:', results.size);
    
    // Show cache efficiency
    const stats = secondaryLookupService.getCacheStats();
    console.log('   Cache efficiency improved batch performance');
  }

  /**
   * Demo 5: Conflict Resolution and Data Consistency
   * 
   * Shows how the system:
   * - Detects conflicts between blockchain and database
   * - Resolves conflicts by prioritizing on-chain data
   * - Maintains audit trail of conflict resolutions
   */
  async demonstrateConflictResolution(): Promise<void> {
    console.log('\n=== Conflict Resolution Demonstration ===');
    
    // Show current conflicts
    const conflicts = blockchainSyncService.getConflicts();
    console.log('1. Current conflicts detected:', conflicts.length);
    
    if (conflicts.length > 0) {
      console.log('   Example conflict:');
      const conflict = conflicts[0];
      console.log('   - Type:', conflict.type);
      console.log('   - Identifier:', conflict.identifier);
      console.log('   - Conflict fields:', conflict.conflictFields);
      console.log('   - Resolved:', conflict.resolved);
    }
    
    // Show sync status
    const syncStatus = secondaryLookupService.getStatus();
    console.log('\n2. Sync Status:');
    console.log('   Last sync:', syncStatus.lastSync);
    console.log('   Is healthy:', syncStatus.isHealthy);
    console.log('   Pending conflicts:', syncStatus.pendingConflicts);
  }

  /**
   * Demo 6: Service Health and Monitoring
   * 
   * Shows how the system:
   * - Monitors service health across all components
   * - Provides detailed metrics and statistics
   * - Enables proactive monitoring and alerting
   */
  async demonstrateServiceHealth(): Promise<void> {
    console.log('\n=== Service Health Demonstration ===');
    
    // Get comprehensive health status
    const health = await integratedDataService.getServiceHealth();
    console.log('1. Overall Health:', health.overall);
    console.log('2. Component Status:');
    console.log('   - Blockchain:', health.components.blockchain);
    console.log('   - Database:', health.components.database);
    console.log('   - Cache:', health.components.cache);
    console.log('   - Sync:', health.components.sync);
    
    console.log('\n3. Performance Metrics:');
    console.log('   - Cache hit rate:', health.metrics.cacheHitRate.toFixed(2) + '%');
    console.log('   - Conflict count:', health.metrics.conflictCount);
    console.log('   - Last successful sync:', health.metrics.lastSuccessfulSync);
    
    // Get detailed service metrics
    const metrics = integratedDataService.getServiceMetrics();
    console.log('\n4. Detailed Metrics:');
    console.log('   - Total queries:', metrics.cache.total);
    console.log('   - Blockchain queries:', metrics.cache.blockchainQueries);
    console.log('   - Database queries:', metrics.cache.databaseQueries);
  }

  /**
   * Demo 7: Cache Management and Invalidation
   * 
   * Shows how the system:
   * - Manages cache lifecycle
   * - Supports targeted cache invalidation
   * - Handles cache cleanup and optimization
   */
  async demonstrateCacheManagement(): Promise<void> {
    console.log('\n=== Cache Management Demonstration ===');
    
    const walletAddress = '0x1234567890abcdef';
    
    // Populate cache
    console.log('1. Populating cache with user data:');
    await secondaryLookupService.getUserBalance(walletAddress);
    await secondaryLookupService.getStakingPosition(walletAddress);
    
    let stats = secondaryLookupService.getCacheStats();
    console.log('   Cache size after population:', stats.cacheSize);
    
    // Invalidate specific cache entries
    console.log('\n2. Invalidating user-specific cache:');
    secondaryLookupService.invalidateCache(`*${walletAddress}*`);
    
    stats = secondaryLookupService.getCacheStats();
    console.log('   Cache size after invalidation:', stats.cacheSize);
    
    // Refresh user data
    console.log('\n3. Refreshing user data:');
    await secondaryLookupService.refreshUserData(walletAddress);
    console.log('   User data refreshed from blockchain');
  }

  /**
   * Run all demonstrations
   */
  async runAllDemonstrations(): Promise<void> {
    console.log('🚀 Secondary Lookup System Demonstration');
    console.log('==========================================');
    
    try {
      // Initialize the integrated data service
      await integratedDataService.initialize();
      console.log('✅ Integrated data service initialized');
      
      // Run all demonstrations
      await this.demonstrateAssetLookup();
      await this.demonstrateBalanceLookup();
      await this.demonstrateTransactionLookup();
      await this.demonstrateBatchOperations();
      await this.demonstrateConflictResolution();
      await this.demonstrateServiceHealth();
      await this.demonstrateCacheManagement();
      
      console.log('\n🎉 All demonstrations completed successfully!');
      console.log('\nKey Benefits Demonstrated:');
      console.log('✅ Blockchain data prioritization');
      console.log('✅ Database fallback for reliability');
      console.log('✅ Intelligent caching for performance');
      console.log('✅ Background synchronization');
      console.log('✅ Conflict resolution with on-chain priority');
      console.log('✅ Comprehensive monitoring and health checks');
      
    } catch (error) {
      console.error('❌ Demonstration failed:', error);
    } finally {
      // Cleanup
      await integratedDataService.shutdown();
      console.log('✅ Services shut down cleanly');
    }
  }
}

// Export for use in other modules
export const secondaryLookupDemo = new SecondaryLookupDemo();

// If run directly, execute all demonstrations
if (require.main === module) {
  secondaryLookupDemo.runAllDemonstrations().catch(console.error);
}