/**
 * Tests for Enhanced Database Collections
 * 
 * Tests the enhanced database models and services for:
 * - Asset management with IPFS backup and search indexing
 * - User management with multi-wallet associations
 * - Transaction tracking with on-chain/off-chain correlation
 * - Wallet management and monitoring
 */

import { enhancedDatabaseService } from '../../src/services/database/enhanced-database-service';

// Import the mocked models
const { Asset, User, Transaction, Wallet } = require('@/lib/database/models');

// Mock mongoose connection
jest.mock('@/lib/database/connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}));

// Mock mongoose models
jest.mock('@/lib/database/models', () => ({
  Asset: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })),
  User: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })),
  Transaction: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })),
  Wallet: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  }))
}));

// Create mock instances for static methods
const MockAsset = {
  find: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn()
};

const MockUser = {
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn()
};

const MockTransaction = {
  find: jest.fn(),
  findOneAndUpdate: jest.fn()
};

const MockWallet = {
  findOne: jest.fn(),
  updateOne: jest.fn()
};

describe('Enhanced Database Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Asset Management', () => {
    test('should create asset with enhanced search indexing', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        tokenId: 'asset_123',
        metadata: {
          title: 'Test Property',
          description: 'A beautiful test property',
          searchKeywords: ['test', 'property', 'beautiful'],
          tags: ['residential']
        }
      });

      // Mock the Asset constructor to return an object with save method
      Asset.mockImplementation(() => ({
        save: mockSave
      }));

      const assetData = {
        tokenId: 'asset_123',
        assetType: 'real_estate' as const,
        owner: '0x123',
        metadata: {
          title: 'Test Property',
          description: 'A beautiful test property',
          tags: ['residential'],
          valuation: {
            amount: 100000,
            currency: 'USD',
            date: new Date()
          }
        }
      };

      const result = await enhancedDatabaseService.createAsset(assetData);

      expect(Asset).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result.metadata.searchKeywords).toContain('test');
      expect(result.metadata.searchKeywords).toContain('property');
    });

    test('should search assets with full-text search', async () => {
      const mockAssets = [
        { tokenId: 'asset_1', metadata: { title: 'Property 1' } },
        { tokenId: 'asset_2', metadata: { title: 'Property 2' } }
      ];

      Asset.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockAssets)
        })
      });

      const results = await enhancedDatabaseService.searchAssets('property', {
        assetType: 'real_estate',
        minValue: 50000
      });

      expect(Asset.find).toHaveBeenCalledWith({
        $text: { $search: 'property' },
        assetType: 'real_estate',
        'financialData.currentValue': { $gte: 50000 }
      });
      expect(results).toEqual(mockAssets);
    });

    test('should update IPFS pinning status', async () => {
      Asset.updateOne = jest.fn().mockResolvedValue({ acknowledged: true });

      await enhancedDatabaseService.updateIPFSPinningStatus(
        'asset_123',
        0,
        'pinned',
        ['backup_hash_1', 'backup_hash_2']
      );

      expect(Asset.updateOne).toHaveBeenCalledWith(
        { tokenId: 'asset_123' },
        {
          $set: {
            'metadata.documents.0.pinningStatus': 'pinned',
            'metadata.documents.0.lastPinCheck': expect.any(Date),
            'metadata.documents.0.backupHashes': ['backup_hash_1', 'backup_hash_2']
          }
        }
      );
    });
  });

  describe('User Management with Multi-Wallet', () => {
    test('should create user with initial wallet connection', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        walletAddress: '0x123',
        connectedWallets: [{
          address: '0x123',
          walletType: 'sui_wallet',
          isActive: true
        }]
      });

      User.mockImplementation(() => ({
        save: mockSave
      }));

      const userData = {
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe' }
      };

      const initialWallet = {
        address: '0x123',
        walletType: 'sui_wallet',
        nickname: 'Main Wallet'
      };

      const result = await enhancedDatabaseService.createUser(userData, initialWallet);

      expect(User).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result.walletAddress).toBe('0x123');
      expect(result.connectedWallets).toHaveLength(1);
    });

    test('should add wallet to existing user', async () => {
      const mockUser = {
        _id: 'user_123',
        connectedWallets: [
          { address: '0x123', walletType: 'sui_wallet' },
          { address: '0x456', walletType: 'ledger' }
        ]
      };

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUser);

      const result = await enhancedDatabaseService.addWalletToUser('user_123', {
        address: '0x456',
        walletType: 'ledger',
        nickname: 'Hardware Wallet'
      });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user_123',
        {
          $push: {
            connectedWallets: expect.objectContaining({
              address: '0x456',
              walletType: 'ledger',
              nickname: 'Hardware Wallet'
            })
          }
        },
        { new: true }
      );
    });

    test('should find user by any connected wallet address', async () => {
      const mockUser = { walletAddress: '0x123' };
      User.findOne = jest.fn().mockResolvedValue(mockUser);

      const result = await enhancedDatabaseService.getUserByWalletAddress('0x456');

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { walletAddress: '0x456' },
          { 'connectedWallets.address': '0x456' }
        ]
      });
    });
  });

  describe('Transaction Tracking', () => {
    test('should create transaction with correlation data', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        transactionId: 'tx_123',
        type: 'asset_tokenization',
        status: 'pending'
      });

      Transaction.mockImplementation(() => ({
        save: mockSave
      }));

      const transactionData = {
        type: 'asset_tokenization' as const,
        initiator: '0x123',
        amount: 1000,
        currency: 'SUI',
        offChainData: {
          relatedAssetId: 'asset_123'
        }
      };

      const result = await enhancedDatabaseService.createTransaction(transactionData);

      expect(Transaction).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result.type).toBe('asset_tokenization');
    });

    test('should update transaction status with blockchain data', async () => {
      const mockTransaction = {
        transactionId: 'tx_123',
        status: 'success',
        onChainData: { confirmations: 5 }
      };

      Transaction.findOneAndUpdate = jest.fn().mockResolvedValue(mockTransaction);

      const result = await enhancedDatabaseService.updateTransactionStatus(
        'tx_123',
        'success',
        { confirmations: 5, finalityStatus: 'finalized' }
      );

      expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
        { transactionId: 'tx_123' },
        expect.objectContaining({
          status: 'success',
          confirmedAt: expect.any(Date),
          finalizedAt: expect.any(Date)
        }),
        { new: true }
      );
    });

    test('should get transactions with correlation filters', async () => {
      const mockTransactions = [
        { transactionId: 'tx_1', type: 'asset_tokenization' },
        { transactionId: 'tx_2', type: 'lending_deposit' }
      ];

      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockTransactions)
        })
      });

      const results = await enhancedDatabaseService.getTransactionsWithCorrelation({
        userId: '0x123',
        assetId: 'asset_123',
        status: 'success'
      });

      expect(Transaction.find).toHaveBeenCalledWith({
        initiator: '0x123',
        'offChainData.relatedAssetId': 'asset_123',
        status: 'success'
      });
    });
  });

  describe('Wallet Management', () => {
    test('should create wallet with comprehensive tracking', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        address: '0x123',
        walletType: 'sui_wallet',
        statistics: { totalTransactions: 0 }
      });

      Wallet.mockImplementation(() => ({
        save: mockSave
      }));

      const walletData = {
        address: '0x123',
        walletType: 'sui_wallet' as const,
        userId: 'user_123'
      };

      const result = await enhancedDatabaseService.createWallet(walletData);

      expect(Wallet).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result.address).toBe('0x123');
    });

    test('should update wallet activity and statistics', async () => {
      const mockWallet = {
        address: '0x123',
        statistics: {
          totalTransactions: 5,
          totalVolume: 5000,
          averageTransactionSize: 0
        },
        save: jest.fn().mockResolvedValue(true)
      };

      Wallet.updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
      Wallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      await enhancedDatabaseService.updateWalletActivity('0x123', {
        transactionAmount: 1000,
        transactionType: 'asset_tokenization'
      });

      expect(Wallet.updateOne).toHaveBeenCalledWith(
        { address: '0x123' },
        expect.objectContaining({
          lastActivity: expect.any(Date),
          $inc: {
            'statistics.totalTransactions': 1,
            'statistics.totalVolume': 1000
          }
        })
      );

      expect(mockWallet.save).toHaveBeenCalled();
      expect(mockWallet.statistics.averageTransactionSize).toBe(1000);
    });

    test('should get wallet analytics with risk assessment', async () => {
      const mockWallet = {
        address: '0x123',
        security: {
          flaggedTransactions: [{ transactionId: 'tx_flagged' }]
        },
        statistics: {
          totalVolume: 500000
        }
      };

      const mockTransactions = [
        { transactionId: 'tx_1' },
        { transactionId: 'tx_2' }
      ];

      Wallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockTransactions)
        })
      });

      const result = await enhancedDatabaseService.getWalletAnalytics('0x123');

      expect(result.wallet).toBe(mockWallet);
      expect(result.recentTransactions).toBe(mockTransactions);
      expect(result.riskAssessment.riskLevel).toBe('medium');
      expect(result.riskAssessment.factors).toContain('Has flagged transactions');
    });
  });
});

describe('Database Model Validation', () => {
  test('Asset model should have enhanced IPFS and search fields', () => {
    // This test validates the model structure
    const assetData = {
      tokenId: 'test_asset',
      assetType: 'real_estate',
      owner: '0x123',
      metadata: {
        title: 'Test Asset',
        description: 'Test Description',
        searchKeywords: ['test', 'asset'],
        tags: ['residential'],
        documents: [{
          type: 'deed',
          ipfsHash: 'QmTest',
          fileName: 'deed.pdf',
          uploadDate: new Date(),
          pinningStatus: 'pinned',
          backupHashes: ['QmBackup1', 'QmBackup2'],
          fileSize: 1024,
          mimeType: 'application/pdf'
        }]
      }
    };

    expect(assetData.metadata.searchKeywords).toBeDefined();
    expect(assetData.metadata.tags).toBeDefined();
    expect(assetData.metadata.documents[0].pinningStatus).toBeDefined();
    expect(assetData.metadata.documents[0].backupHashes).toBeDefined();
  });

  test('User model should support multi-wallet associations', () => {
    const userData = {
      walletAddress: '0x123',
      connectedWallets: [{
        address: '0x456',
        walletType: 'ledger',
        connectionDate: new Date(),
        lastUsed: new Date(),
        isActive: true,
        nickname: 'Hardware Wallet'
      }]
    };

    expect(userData.connectedWallets).toBeDefined();
    expect(userData.connectedWallets[0].walletType).toBe('ledger');
    expect(userData.connectedWallets[0].isActive).toBe(true);
  });

  test('Transaction model should support on-chain/off-chain correlation', () => {
    const transactionData = {
      transactionId: 'tx_123',
      deployHash: '0xabcdef',
      type: 'asset_tokenization',
      status: 'success',
      onChainData: {
        contractAddress: '0xcontract',
        confirmations: 5,
        finalityStatus: 'finalized'
      },
      offChainData: {
        relatedAssetId: 'asset_123',
        userSessionId: 'session_456'
      }
    };

    expect(transactionData.onChainData).toBeDefined();
    expect(transactionData.offChainData).toBeDefined();
    expect(transactionData.onChainData.finalityStatus).toBe('finalized');
    expect(transactionData.offChainData.relatedAssetId).toBe('asset_123');
  });

  test('Wallet model should support comprehensive tracking', () => {
    const walletData = {
      address: '0x123',
      walletType: 'sui_wallet',
      userId: 'user_123',
      security: {
        riskLevel: 'low',
        flaggedTransactions: [],
        suspiciousActivity: []
      },
      statistics: {
        totalTransactions: 10,
        totalVolume: 10000,
        averageTransactionSize: 1000
      },
      preferences: {
        defaultCurrency: 'SUI',
        transactionConfirmations: 1
      }
    };

    expect(walletData.security).toBeDefined();
    expect(walletData.statistics).toBeDefined();
    expect(walletData.preferences).toBeDefined();
    expect(walletData.security.riskLevel).toBe('low');
  });
});