/**
 * Tests for Database Secondary Lookup System
 * 
 * Tests the database caching layer, blockchain synchronization,
 * and automated reconciliation services.
 */

import { blockchainSyncService } from '@/lib/database/services/blockchain-sync-service';
import { databaseCacheService } from '@/lib/database/services/database-cache-service';
import { reconciliationService } from '@/lib/database/services/reconciliation-service';

// Mock database connection
jest.mock('@/lib/database/connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}));

// Mock database models
jest.mock('@/lib/database/models', () => ({
  Asset: {
    find: jest.fn().mockImplementation((query, projection) => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn()
  },
  User: {
    find: jest.fn().mockImplementation((query, projection) => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn()
  },
  Transaction: {
    find: jest.fn().mockImplementation((query, projection) => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn()
  },
  Wallet: {
    find: jest.fn().mockImplementation((query, projection) => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    })),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn()
  }
}));

const { Asset, User, Transaction, Wallet } = require('@/lib/database/models');
describe('Database Secondary Lookup System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default behavior with proper chaining
    const createMockQuery = () => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    });
    
    Asset.find.mockImplementation(() => createMockQuery());
    User.find.mockImplementation(() => createMockQuery());
    Transaction.find.mockImplementation(() => createMockQuery());
    Wallet.find.mockImplementation(() => createMockQuery());
    
    User.find.mockImplementation(() => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    }));
    
    Transaction.find.mockImplementation(() => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    }));
    
    Wallet.find.mockImplementation(() => ({
      limit: jest.fn().mockResolvedValue([]),
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([])
      })
    }));
  });

  afterEach(async () => {
    // Clean up services
    await blockchainSyncService.stopSync();
    await reconciliationService.stopReconciliation();
    databaseCacheService.stopCleanupProcess();
    databaseCacheService.invalidateAll();
  });

  describe('Blockchain Synchronization Service', () => {
    test('should start and stop sync service', async () => {
      expect(blockchainSyncService.isServiceRunning()).toBe(false);
      
      await blockchainSyncService.startSync();
      expect(blockchainSyncService.isServiceRunning()).toBe(true);
      
      await blockchainSyncService.stopSync();
      expect(blockchainSyncService.isServiceRunning()).toBe(false);
    });

    test('should perform full synchronization', async () => {
      Asset.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([
          {
            tokenId: 'asset_1',
            owner: '0x123',
            financialData: { currentValue: 100000 },
            onChainData: { contractAddress: '0xabc' }
          }
        ])
      });

      User.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([
          {
            walletAddress: '0x123',
            connectedWallets: [{ address: '0x123', walletType: 'casper_wallet' }]
          }
        ])
      });

      Transaction.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([
          {
            transactionId: 'tx_1',
            deployHash: '0xdef',
            status: 'pending'
          }
        ])
      });

      Wallet.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([
          {
            address: '0x123',
            statistics: { totalTransactions: 5 }
          }
        ])
      });

      await blockchainSyncService.performFullSync();

      expect(Asset.find).toHaveBeenCalled();
      expect(User.find).toHaveBeenCalled();
      expect(Transaction.find).toHaveBeenCalled();
      expect(Wallet.find).toHaveBeenCalled();
    });

    test('should detect and record conflicts', async () => {
      const mockAsset = {
        tokenId: 'asset_1',
        owner: '0x123',
        financialData: { currentValue: 100000 },
        onChainData: { contractAddress: '0xabc' }
      };

      Asset.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([mockAsset])
      });
      Asset.updateOne.mockResolvedValue({ acknowledged: true });

      await blockchainSyncService.performFullSync();

      // Check that conflicts are tracked
      const conflicts = blockchainSyncService.getConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    test('should track last sync time', async () => {
      const beforeSync = new Date();
      await blockchainSyncService.performFullSync();
      const afterSync = new Date();

      const lastSyncTime = blockchainSyncService.getLastSyncTime();
      expect(lastSyncTime.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
      expect(lastSyncTime.getTime()).toBeLessThanOrEqual(afterSync.getTime());
    });
  });
  describe('Database Cache Service', () => {
    test('should cache and retrieve assets', async () => {
      const mockAsset = {
        tokenId: 'asset_1',
        owner: '0x123',
        metadata: { title: 'Test Asset' }
      };

      Asset.findOne.mockResolvedValue(mockAsset);

      // First call should hit database
      const result1 = await databaseCacheService.getAsset('asset_1');
      expect(result1).toEqual(mockAsset);
      expect(Asset.findOne).toHaveBeenCalledWith({ tokenId: 'asset_1' });

      // Second call should hit cache
      Asset.findOne.mockClear();
      const result2 = await databaseCacheService.getAsset('asset_1');
      expect(result2).toEqual(mockAsset);
      expect(Asset.findOne).not.toHaveBeenCalled();

      // Verify cache stats
      const stats = databaseCacheService.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    test('should cache users with multi-wallet support', async () => {
      const mockUser = {
        walletAddress: '0x123',
        connectedWallets: [
          { address: '0x123', walletType: 'casper_wallet' },
          { address: '0x456', walletType: 'ledger' }
        ]
      };

      User.findOne.mockResolvedValue(mockUser);

      // Test finding by primary wallet
      const result1 = await databaseCacheService.getUser('0x123');
      expect(result1).toEqual(mockUser);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { walletAddress: '0x123' },
          { 'connectedWallets.address': '0x123' }
        ]
      });
    });

    test('should provide cache statistics and monitoring', async () => {
      const mockAsset = { tokenId: 'asset_1' };
      Asset.findOne.mockResolvedValue(mockAsset);

      // Generate some cache activity
      await databaseCacheService.getAsset('asset_1'); // miss
      await databaseCacheService.getAsset('asset_1'); // hit
      await databaseCacheService.getAsset('asset_2'); // miss

      const stats = databaseCacheService.getCacheStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.33, 2);

      const memoryUsage = databaseCacheService.getMemoryUsage();
      expect(memoryUsage.used).toBeGreaterThan(0);
      expect(memoryUsage.limit).toBeGreaterThan(0);
    });
  });
  describe('Reconciliation Service', () => {
    test('should start and stop reconciliation service', async () => {
      expect(reconciliationService.isServiceRunning()).toBe(false);
      
      await reconciliationService.startReconciliation();
      expect(reconciliationService.isServiceRunning()).toBe(true);
      
      await reconciliationService.stopReconciliation();
      expect(reconciliationService.isServiceRunning()).toBe(false);
    });

    test('should perform full reconciliation and generate report', async () => {
      // Mock database counts
      Asset.countDocuments.mockResolvedValue(100);
      User.countDocuments.mockResolvedValue(50);
      Transaction.countDocuments.mockResolvedValue(200);
      Wallet.countDocuments.mockResolvedValue(75);

      // Mock data for integrity checks
      Asset.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: 'asset1',
              tokenId: 'asset_1',
              owner: '0x123',
              assetType: 'real_estate',
              financialData: { currentValue: 100000 },
              metadata: { valuation: { amount: 100000 } }
            }
          ])
        })
      });

      User.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: 'user1',
              walletAddress: '0x123',
              connectedWallets: [{ address: '0x123', walletType: 'casper_wallet' }]
            }
          ])
        })
      });

      Transaction.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: 'tx1',
              transactionId: 'tx_1',
              type: 'asset_tokenization',
              initiator: '0x123',
              status: 'success',
              confirmedAt: new Date()
            }
          ])
        })
      });

      Wallet.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: 'wallet1',
              address: '0x123',
              walletType: 'casper_wallet',
              userId: 'user1',
              statistics: { totalTransactions: 5, totalVolume: 1000 }
            }
          ])
        })
      });

      const report = await reconciliationService.performFullReconciliation();

      expect(report).toBeDefined();
      expect(report.totalRecords.assets).toBe(100);
      expect(report.totalRecords.users).toBe(50);
      expect(report.totalRecords.transactions).toBe(200);
      expect(report.totalRecords.wallets).toBe(75);
      expect(Array.isArray(report.inconsistencies)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should detect data integrity issues', async () => {
      // Mock asset with missing required fields
      Asset.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              _id: 'asset1',
              tokenId: '', // Missing tokenId
              owner: '0x123',
              assetType: 'real_estate'
            }
          ])
        })
      });

      Asset.countDocuments.mockResolvedValue(1);
      User.countDocuments.mockResolvedValue(0);
      Transaction.countDocuments.mockResolvedValue(0);
      Wallet.countDocuments.mockResolvedValue(0);

      User.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });
      Transaction.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });
      Wallet.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });

      const report = await reconciliationService.performFullReconciliation();

      expect(report.inconsistencies.length).toBeGreaterThan(0);
      
      const integrityIssues = reconciliationService.getIntegrityIssues();
      expect(integrityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should integrate cache invalidation with sync service', async () => {
      const mockAsset = { tokenId: 'asset_1', owner: '0x123' };
      Asset.findOne.mockResolvedValue(mockAsset);

      // Cache an asset
      await databaseCacheService.getAsset('asset_1');
      expect(databaseCacheService.getCacheSize()).toBeGreaterThan(0);

      // Cache should be invalidated after sync
      databaseCacheService.invalidateAsset('asset_1');
      
      // Verify cache was cleared
      const cacheSize = databaseCacheService.getCacheSize();
      expect(cacheSize).toBe(0);
    });

    test('should handle concurrent operations safely', async () => {
      const mockAsset = { tokenId: 'asset_1', owner: '0x123' };
      Asset.findOne.mockResolvedValue(mockAsset);

      // Simulate concurrent cache operations
      const promises = [
        databaseCacheService.getAsset('asset_1'),
        databaseCacheService.getAsset('asset_1'),
        databaseCacheService.getAsset('asset_1')
      ];

      const results = await Promise.all(promises);
      
      // All should return the same result
      results.forEach(result => {
        expect(result).toEqual(mockAsset);
      });

      // Should have appropriate cache statistics
      const stats = databaseCacheService.getCacheStats();
      expect(stats.totalRequests).toBe(3);
    });
  });
});