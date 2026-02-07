/**
 * Tests for Comprehensive Off-Chain Data Management
 */

import { assetWorkflowService } from '../../src/services/database/asset-workflow-service';
import { userAnalyticsService } from '../../src/services/database/user-analytics-service';
import { crossWalletCorrelationService } from '../../src/services/database/cross-wallet-correlation-service';

// Mock database connection
jest.mock('@/lib/database/connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined)
}));

// Mock database models
jest.mock('@/lib/database/models', () => ({
  Asset: {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      }),
      sort: jest.fn().mockResolvedValue([])
    }),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([])
  },
  User: {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      }),
      sort: jest.fn().mockResolvedValue([])
    }),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([])
  },
  Transaction: {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      }),
      sort: jest.fn().mockResolvedValue([])
    }),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([])
  },
  Wallet: {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      }),
      sort: jest.fn().mockResolvedValue([])
    }),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([])
  }
}));

const { Asset, User, Transaction, Wallet } = require('@/lib/database/models');
describe('Comprehensive Off-Chain Data Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Asset Workflow Service', () => {
    test('should initialize workflow for new asset', async () => {
      Asset.updateOne.mockResolvedValue({ acknowledged: true });

      const workflow = await assetWorkflowService.initializeWorkflow('asset_123', 'user_456');

      expect(workflow.assetId).toBe('asset_123');
      expect(workflow.currentStage).toBe('submission');
      expect(workflow.completedStages).toEqual([]);
      expect(workflow.stageHistory).toHaveLength(1);
      expect(workflow.stageHistory[0].stage).toBe('submission');
      expect(workflow.stageHistory[0].performedBy).toBe('user_456');
      expect(Asset.updateOne).toHaveBeenCalled();
    });

    test('should get workflow progress', async () => {
      const mockAsset = {
        tokenId: 'asset_123',
        workflow: {
          assetId: 'asset_123',
          currentStage: 'document_review',
          completedStages: ['submission'],
          stageHistory: [],
          blockers: [],
          estimatedCompletion: new Date()
        }
      };

      Asset.findOne.mockResolvedValue(mockAsset);

      const workflow = await assetWorkflowService.getWorkflowProgress('asset_123');

      expect(workflow).toBeDefined();
      expect(workflow?.currentStage).toBe('document_review');
      expect(workflow?.completedStages).toContain('submission');
    });

    test('should return null for non-existent asset workflow', async () => {
      Asset.findOne.mockResolvedValue(null);

      const workflow = await assetWorkflowService.getWorkflowProgress('non_existent');

      expect(workflow).toBeNull();
    });
  });

  describe('User Analytics Service', () => {
    test('should get comprehensive user metrics', async () => {
      const mockUser = {
        _id: 'user_123',
        walletAddress: '0x123',
        connectedWallets: [
          { address: '0x123', walletType: 'sui_wallet' }
        ],
        activityLog: [
          { timestamp: new Date(), action: 'login' }
        ],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        compliance: {
          riskRating: 'low'
        }
      };

      const mockAssets = [
        { assetType: 'real_estate', owner: '0x123' },
        { assetType: 'commodity', owner: '0x123' }
      ];

      const mockTransactions = [
        { initiator: '0x123', amount: 1000, createdAt: new Date() },
        { recipient: '0x123', amount: 500, createdAt: new Date() }
      ];

      const mockWallets = [
        { address: '0x123', userId: 'user_123' }
      ];

      User.findOne.mockResolvedValue(mockUser);
      Asset.find.mockResolvedValue(mockAssets);
      Transaction.find.mockResolvedValue(mockTransactions);
      Wallet.find.mockResolvedValue(mockWallets);

      const metrics = await userAnalyticsService.getUserMetrics('0x123');

      expect(metrics).toBeDefined();
      expect(metrics?.userId).toBe('user_123');
      expect(metrics?.walletAddress).toBe('0x123');
      expect(metrics?.totalAssets).toBe(2);
      expect(metrics?.totalTransactions).toBe(2);
      expect(metrics?.totalVolume).toBe(1500);
      expect(metrics?.averageTransactionSize).toBe(750);
      expect(metrics?.activityScore).toBeGreaterThan(0);
      expect(metrics?.preferredAssetTypes).toHaveLength(2);
      expect(metrics?.riskProfile).toBeDefined();
    });

    test('should return null for non-existent user', async () => {
      User.findOne.mockResolvedValue(null);

      const metrics = await userAnalyticsService.getUserMetrics('0x999');

      expect(metrics).toBeNull();
    });
  });

  describe('Cross-Wallet Correlation Service', () => {
    test('should analyze wallet relationships', async () => {
      const mockUser = {
        _id: 'user_123',
        walletAddress: '0x123',
        connectedWallets: [
          { address: '0x456', walletType: 'ledger' }
        ],
        compliance: {
          amlStatus: 'clear',
          riskRating: 'low'
        }
      };

      const mockTransactions = [
        {
          initiator: '0x123',
          recipient: '0x789',
          amount: 1000,
          createdAt: new Date(),
          transactionId: 'tx_1'
        },
        {
          initiator: '0x789',
          recipient: '0x123',
          amount: 500,
          createdAt: new Date(),
          transactionId: 'tx_2'
        },
        {
          initiator: '0x123',
          recipient: '0x789',
          amount: 1200,
          createdAt: new Date(),
          transactionId: 'tx_3'
        }
      ];

      User.findOne.mockResolvedValue(mockUser);
      Transaction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockTransactions)
      });

      const analysis = await crossWalletCorrelationService.analyzeWalletRelationships('0x123');

      expect(analysis).toBeDefined();
      expect(analysis.walletAddress).toBe('0x123');
      expect(analysis.relatedWallets).toBeDefined();
      expect(analysis.transactionFlows).toBeDefined();
      expect(analysis.riskAssessment).toBeDefined();
      expect(analysis.insights).toBeDefined();
    });

    test('should detect suspicious patterns', async () => {
      const mockTransactions = [
        // Rapid back-and-forth pattern
        { initiator: '0x123', recipient: '0x456', amount: 1000, createdAt: new Date(), transactionId: 'tx_1' },
        { initiator: '0x456', recipient: '0x123', amount: 1000, createdAt: new Date(), transactionId: 'tx_2' },
        { initiator: '0x123', recipient: '0x456', amount: 1000, createdAt: new Date(), transactionId: 'tx_3' },
        { initiator: '0x456', recipient: '0x123', amount: 1000, createdAt: new Date(), transactionId: 'tx_4' },
        { initiator: '0x123', recipient: '0x456', amount: 1000, createdAt: new Date(), transactionId: 'tx_5' },
        { initiator: '0x456', recipient: '0x123', amount: 1000, createdAt: new Date(), transactionId: 'tx_6' }
      ];

      Transaction.find.mockResolvedValue(mockTransactions);

      const patterns = await crossWalletCorrelationService.detectSuspiciousPatterns();

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);

      // Should detect rapid back-and-forth pattern
      const rapidPattern = patterns.find(p => p.pattern === 'rapid_back_and_forth');
      expect(rapidPattern).toBeDefined();
      expect(rapidPattern?.wallets).toContain('0x123');
      expect(rapidPattern?.wallets).toContain('0x456');
      expect(rapidPattern?.riskScore).toBeGreaterThan(0);
    });
  });
});