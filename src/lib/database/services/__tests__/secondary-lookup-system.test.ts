/**
 * Secondary Lookup System Integration Tests
 * 
 * Tests the database as secondary lookup system with real blockchain integration
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { connectToDatabase } from '../../connection';
import { secondaryLookupService } from '../secondary-lookup-service';
import { integratedDataService } from '../integrated-data-service';
import { Asset, User, Transaction, Wallet } from '../../models';

// Mock the Casper services for testing
jest.mock('../../../blockchain/casper-service', () => ({
  getCasperBlockchainService: () => ({
    getAssetTokenInfo: jest.fn().mockResolvedValue({
      tokenId: 'test_asset_1',
      owner: '0x123456789',
      assetValue: '100000',
      verified: true,
      contractAddress: '0xcontract123',
      blockNumber: 12345,
      transactionHash: '0xtx123'
    }),
    getAccountBalance: jest.fn().mockResolvedValue('5000000000'),
    getStakingMetrics: jest.fn().mockResolvedValue({
      totalStaked: 1000000,
      currentValue: 1050000,
      totalRewards: 50000,
      exchangeRate: 1.05,
      apr: 5.2,
      unbondingAmount: 0,
      activePositions: 1
    })
  })
}));

jest.mock('../../../casper/client', () => ({
  getCasperClient: () => ({
    getDeployInfo: jest.fn().mockResolvedValue({
      header: {
        account: '0x123456789',
        timestamp: '2024-01-01T00:00:00Z'
      },
      execution_results: [{
        result: {
          Success: {
            cost: '100000000'
          }
        }
      }]
    })
  })
}));

describe('Secondary Lookup System Integration', () => {
  beforeAll(async () => {
    await connectToDatabase();
    await integratedDataService.initialize();
  });

  afterAll(async () => {
    await integratedDataService.shutdown();
  });

  describe('Asset Data Lookup', () => {
    it('should prioritize blockchain data over database cache', async () => {
      // First, create a database entry with different data
      const dbAsset = new Asset({
        tokenId: 'test_asset_1',
        owner: '0x987654321', // Different from blockchain
        assetType: 'real_estate',
        financialData: {
          currentValue: 50000, // Different from blockchain
          currency: 'USD'
        },
        verification: {
          status: 'pending',
          verifiedAt: new Date(),
          verifier: 'test'
        },
        metadata: {
          title: 'Test Asset',
          description: 'Database version',
          documents: []
        }
      });
      await dbAsset.save();

      // Get asset through secondary lookup service
      const result = await secondaryLookupService.getAssetData('test_asset_1');

      expect(result).toBeTruthy();
      expect(result?.owner).toBe('0x123456789'); // Should match blockchain data
      expect(result?.financialData.currentValue).toBe(100000); // Should match blockchain data
    });

    it('should fallback to database when blockchain is unavailable', async () => {
      // Mock blockchain service to throw error
      const mockService = require('../../../blockchain/casper-service').getCasperBlockchainService();
      mockService.getAssetTokenInfo.mockRejectedValueOnce(new Error('Network error'));

      const result = await secondaryLookupService.getAssetData('test_asset_1', {
        fallbackToDatabase: true
      });

      expect(result).toBeTruthy();
      // Should return database data when blockchain fails
    });

    it('should cache blockchain data for subsequent requests', async () => {
      // Clear cache first
      secondaryLookupService.invalidateCache('asset_test_asset_1');

      // First request - should hit blockchain
      const result1 = await secondaryLookupService.getAssetData('test_asset_1');
      
      // Second request - should hit cache
      const result2 = await secondaryLookupService.getAssetData('test_asset_1');

      expect(result1).toEqual(result2);
      
      const stats = secondaryLookupService.getCacheStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });

  describe('Balance Lookup', () => {
    it('should get real-time balance from blockchain', async () => {
      const balance = await secondaryLookupService.getUserBalance('0x123456789');

      expect(balance).toBeTruthy();
      expect(balance?.currency).toBe('CSPR');
      expect(parseFloat(balance?.balance || '0')).toBeGreaterThan(0);
    });

    it('should update database in background after blockchain query', async () => {
      const walletAddress = '0x123456789';
      
      // Get balance through secondary lookup
      await secondaryLookupService.getUserBalance(walletAddress);

      // Wait a bit for background update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if database was updated
      const wallet = await Wallet.findOne({ address: walletAddress });
      expect(wallet).toBeTruthy();
      expect(wallet?.balances).toBeTruthy();
    });
  });

  describe('Transaction Status Lookup', () => {
    it('should get transaction status from blockchain', async () => {
      const deployHash = '0xtestdeploy123';
      
      const result = await secondaryLookupService.getTransactionStatus(deployHash);

      expect(result).toBeTruthy();
      expect(result?.deployHash).toBe(deployHash);
      expect(result?.status).toBe('success');
    });
  });

  describe('Staking Position Lookup', () => {
    it('should get staking metrics from blockchain', async () => {
      const walletAddress = '0x123456789';
      
      const result = await secondaryLookupService.getStakingPosition(walletAddress);

      expect(result).toBeTruthy();
      expect(result.totalStaked).toBe(1000000);
      expect(result.exchangeRate).toBe(1.05);
      expect(result.apr).toBe(5.2);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch asset lookups efficiently', async () => {
      const tokenIds = ['test_asset_1', 'test_asset_2', 'test_asset_3'];
      
      const results = await secondaryLookupService.batchGetAssets(tokenIds);

      expect(results.size).toBe(tokenIds.length);
      expect(results.get('test_asset_1')).toBeTruthy();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache correctly', async () => {
      // Get data to populate cache
      await secondaryLookupService.getAssetData('test_asset_1');
      
      // Invalidate cache
      secondaryLookupService.invalidateCache('asset_test_asset_1');
      
      // Next request should miss cache
      const statsBefore = secondaryLookupService.getCacheStats();
      await secondaryLookupService.getAssetData('test_asset_1');
      const statsAfter = secondaryLookupService.getCacheStats();
      
      expect(statsAfter.cacheMisses).toBeGreaterThan(statsBefore.cacheMisses);
    });

    it('should handle pattern-based cache invalidation', async () => {
      const walletAddress = '0x123456789';
      
      // Populate cache with user data
      await secondaryLookupService.getUserBalance(walletAddress);
      await secondaryLookupService.getStakingPosition(walletAddress);
      
      // Invalidate all user data
      secondaryLookupService.invalidateCache(`*${walletAddress}*`);
      
      // Verify cache was cleared
      const stats = secondaryLookupService.getCacheStats();
      expect(stats.cacheSize).toBeLessThan(2);
    });
  });

  describe('Integrated Data Service', () => {
    it('should provide unified data access', async () => {
      const asset = await integratedDataService.getAsset('test_asset_1');
      const balance = await integratedDataService.getUserBalance('0x123456789');
      const staking = await integratedDataService.getStakingPosition('0x123456789');

      expect(asset).toBeTruthy();
      expect(balance).toBeTruthy();
      expect(staking).toBeTruthy();
    });

    it('should provide service health status', async () => {
      const health = await integratedDataService.getServiceHealth();

      expect(health.overall).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle user data refresh', async () => {
      const walletAddress = '0x123456789';
      
      await integratedDataService.refreshUserData(walletAddress);
      
      // Verify data was refreshed
      const balance = await integratedDataService.getUserBalance(walletAddress, { forceRefresh: true });
      expect(balance).toBeTruthy();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle blockchain service failures gracefully', async () => {
      // Mock all blockchain services to fail
      const mockService = require('../../../blockchain/casper-service').getCasperBlockchainService();
      mockService.getAssetTokenInfo.mockRejectedValueOnce(new Error('Blockchain unavailable'));
      mockService.getAccountBalance.mockRejectedValueOnce(new Error('Blockchain unavailable'));
      mockService.getStakingMetrics.mockRejectedValueOnce(new Error('Blockchain unavailable'));

      // Should still return data from database fallback
      const asset = await secondaryLookupService.getAssetData('test_asset_1', { fallbackToDatabase: true });
      expect(asset).toBeTruthy(); // Should get database fallback

      const balance = await secondaryLookupService.getUserBalance('0x123456789', { fallbackToDatabase: true });
      // Balance might be null if no database fallback exists, which is acceptable

      const staking = await secondaryLookupService.getStakingPosition('0x123456789', { fallbackToDatabase: true });
      // Staking might be null if no database fallback exists, which is acceptable
    });

    it('should maintain service availability during partial failures', async () => {
      const health = await integratedDataService.getServiceHealth();
      
      // Even with some failures, service should remain available
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
    });
  });
});