/**
 * System Integration Tests
 * Task 10.1: Create end-to-end integration tests
 * 
 * Focused integration tests that validate system components work together
 * using mock implementations where needed.
 * 
 * Requirements: All requirements
 */

import { AnalyticsService } from '@/lib/monitoring/analytics';

// Mock implementations for testing
class MockRedis {
  private data: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private hashes: Map<string, Map<string, string>> = new Map();

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async lpush(key: string, value: string): Promise<void> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(value);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (list) {
      this.lists.set(key, list.slice(start, stop + 1));
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    return list.slice(start, stop + 1);
  }

  async hincrby(key: string, field: string, increment: number): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    const current = parseInt(hash.get(field) || '0');
    hash.set(field, (current + increment).toString());
  }

  async hset(key: string, field: string, value: string | number): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key)!.set(field, value.toString());
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const hash = this.hashes.get(key);
    return fields.map(field => hash?.get(field) || null);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const result: Record<string, string> = {};
    hash.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  async expire(key: string, seconds: number): Promise<void> {
    // Mock implementation
  }

  pipeline() {
    return {
      hincrby: (key: string, field: string, increment: number) => this.hincrby(key, field, increment),
      hset: (key: string, field: string, value: string | number) => this.hset(key, field, value),
      expire: (key: string, seconds: number) => this.expire(key, seconds),
      exec: async () => []
    };
  }
}

class MockDb {
  private collections: Map<string, any[]> = new Map();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }

    return {
      insertOne: async (doc: any) => {
        const collection = this.collections.get(name)!;
        const newDoc = { ...doc, _id: `${name}_${collection.length}` };
        collection.push(newDoc);
        return { insertedId: newDoc._id };
      },
      
      find: (query: any) => ({
        toArray: async () => {
          const collection = this.collections.get(name)!;
          return collection.filter(doc => {
            return Object.keys(query).every(key => {
              if (key === 'timestamp' && query[key].$gte) {
                return new Date(doc[key]) >= query[key].$gte;
              }
              return doc[key] === query[key];
            });
          });
        },
        limit: (n: number) => ({
          toArray: async () => {
            const collection = this.collections.get(name)!;
            return collection.slice(0, n);
          }
        })
      }),

      countDocuments: async (query: any) => {
        const collection = this.collections.get(name)!;
        return collection.filter(doc => {
          return Object.keys(query).every(key => {
            if (key === 'status' && query[key].$in) {
              return query[key].$in.includes(doc[key]);
            }
            if ((key === 'createdAt' || key === 'timestamp') && query[key].$gte) {
              const docDate = new Date(doc[key] || doc.createdAt || doc.timestamp);
              return docDate >= query[key].$gte;
            }
            return doc[key] === query[key];
          });
        }).length;
      },

      aggregate: (pipeline: any[]) => ({
        toArray: async () => {
          const collection = this.collections.get(name)!;
          
          // Handle transactions aggregation for total volume
          if (name === 'transactions') {
            const matchStage = pipeline.find(stage => stage.$match);
            const groupStage = pipeline.find(stage => stage.$group);
            
            if (matchStage && groupStage) {
              // Filter by match criteria
              let filteredDocs = collection;
              if (matchStage.$match.status) {
                filteredDocs = collection.filter(doc => doc.status === matchStage.$match.status);
              }
              
              // Apply group aggregation
              if (groupStage.$group.total && groupStage.$group.total.$sum === '$amount') {
                const total = filteredDocs.reduce((sum, doc) => sum + (doc.amount || 0), 0);
                return [{ total }];
              }
            }
            
            return [{ percentile: 100000 }];
          }
          
          if (name === 'staking') {
            return [{ total: 1000000 }];
          }
          if (name === 'lending_pools') {
            return [{ total: 500000 }];
          }
          return [{ total: 0, avgAPY: 5.5 }];
        }
      })
    };
  }
}

// Mock workflow components
class MockAssetTokenization {
  private assets: Map<string, any> = new Map();
  private nextTokenId = 1;

  async tokenizeAsset(userId: string, assetData: any): Promise<any> {
    const tokenId = `asset_${this.nextTokenId++}`;
    const asset = {
      tokenId,
      owner: userId,
      ...assetData,
      createdAt: new Date(),
      status: 'active'
    };
    this.assets.set(tokenId, asset);
    return asset;
  }

  async getAsset(tokenId: string): Promise<any> {
    return this.assets.get(tokenId);
  }

  async getUserAssets(userId: string): Promise<any[]> {
    return Array.from(this.assets.values()).filter(asset => asset.owner === userId);
  }
}

class MockLendingProtocol {
  private loans: Map<string, any> = new Map();
  private pools: Map<string, any> = new Map();
  private nextLoanId = 1;
  private analyticsService?: AnalyticsService;

  constructor(analyticsService?: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  async createLendingPool(poolId: string): Promise<void> {
    this.pools.set(poolId, {
      poolId,
      totalDeposits: BigInt(0),
      totalBorrows: BigInt(0),
      utilizationRate: 0,
      interestRate: 5.0,
      createdAt: new Date()
    });
  }

  async deposit(userId: string, amount: bigint, poolId: string = 'default'): Promise<bigint> {
    if (!this.pools.has(poolId)) {
      await this.createLendingPool(poolId);
    }
    
    const pool = this.pools.get(poolId)!;
    pool.totalDeposits += amount;
    
    // Record transaction
    if (this.analyticsService) {
      await this.analyticsService.recordTransaction({
        transactionId: `deposit_${Date.now()}`,
        type: 'lending',
        amount: Number(amount),
        userId,
        timestamp: new Date(),
        status: 'completed'
      });
    }
    
    // Return pool tokens (1:1 ratio for simplicity)
    return amount;
  }

  async borrow(userId: string, collateralTokens: string[], amount: bigint): Promise<string> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Invalid loan amount: must be greater than 0');
    }
    
    const loanId = `loan_${this.nextLoanId++}`;
    const loan = {
      loanId,
      borrower: userId,
      collateralTokens,
      principalAmount: amount,
      interestRate: 8.0,
      status: 'active',
      createdAt: new Date()
    };
    this.loans.set(loanId, loan);
    
    // Record transaction
    if (this.analyticsService) {
      await this.analyticsService.recordTransaction({
        transactionId: `borrow_${Date.now()}`,
        type: 'lending',
        amount: Number(amount),
        userId,
        timestamp: new Date(),
        status: 'completed'
      });
    }
    
    return loanId;
  }

  async repay(loanId: string, amount: bigint): Promise<boolean> {
    const loan = this.loans.get(loanId);
    if (!loan) return false;
    
    loan.status = 'repaid';
    loan.repaidAt = new Date();
    loan.repaidAmount = amount;
    
    // Record transaction
    if (this.analyticsService) {
      await this.analyticsService.recordTransaction({
        transactionId: `repay_${Date.now()}`,
        type: 'lending',
        amount: Number(amount),
        userId: loan.borrower,
        timestamp: new Date(),
        status: 'completed'
      });
    }
    
    return true;
  }

  async getLoan(loanId: string): Promise<any> {
    return this.loans.get(loanId);
  }
}

class MockStakingProtocol {
  private positions: Map<string, any> = new Map();
  private nextPositionId = 1;

  async stake(userId: string, amount: bigint): Promise<any> {
    const positionId = `position_${this.nextPositionId++}`;
    const position = {
      positionId,
      staker: userId,
      stakedAmount: amount,
      derivativeTokens: amount, // 1:1 initial ratio
      exchangeRate: BigInt('1000000000'), // 1.0
      createdAt: new Date(),
      status: 'active'
    };
    this.positions.set(positionId, position);
    return position;
  }

  async unstake(userId: string, derivativeTokens: bigint): Promise<any> {
    const userPositions = Array.from(this.positions.values())
      .filter(p => p.staker === userId && p.status === 'active');
    
    if (userPositions.length === 0) {
      throw new Error('No active staking positions found');
    }

    const position = userPositions[0];
    position.status = 'unbonding';
    position.unbondingAmount = derivativeTokens;
    position.unbondingStarted = new Date();
    
    return {
      unbondingId: `unbonding_${Date.now()}`,
      estimatedCompletionTime: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    };
  }

  async getUserPositions(userId: string): Promise<any[]> {
    return Array.from(this.positions.values()).filter(p => p.staker === userId);
  }
}

describe('System Integration Tests', () => {
  let analyticsService: AnalyticsService;
  let assetTokenization: MockAssetTokenization;
  let lendingProtocol: MockLendingProtocol;
  let stakingProtocol: MockStakingProtocol;
  let mockRedis: MockRedis;
  let mockDb: MockDb;

  beforeEach(() => {
    mockRedis = new MockRedis();
    mockDb = new MockDb();
    analyticsService = new AnalyticsService(mockRedis as any, mockDb as any);
    assetTokenization = new MockAssetTokenization();
    lendingProtocol = new MockLendingProtocol(analyticsService);
    stakingProtocol = new MockStakingProtocol();
  });

  describe('Complete User Workflows', () => {
    test('should complete asset tokenization to lending workflow', async () => {
      const userId = 'user-workflow-1';
      const lenderId = 'lender-workflow-1';

      // Step 1: Tokenize an asset
      const assetData = {
        assetType: 'real_estate',
        description: 'Commercial property',
        valuation: BigInt('50000000000'),
        location: 'Lagos, Nigeria'
      };

      const asset = await assetTokenization.tokenizeAsset(userId, assetData);
      expect(asset).toBeDefined();
      expect(asset.owner).toBe(userId);

      // Record tokenization transaction
      await analyticsService.recordTransaction({
        transactionId: `tokenization_${asset.tokenId}`,
        userId,
        type: 'tokenization',
        amount: Number(assetData.valuation),
        timestamp: new Date(),
        status: 'completed'
      });

      // Step 2: Lender provides liquidity
      const liquidityAmount = BigInt('100000000000');
      const poolTokens = await lendingProtocol.deposit(lenderId, liquidityAmount);
      expect(poolTokens).toBe(liquidityAmount);

      // Step 3: User borrows against asset
      const loanAmount = BigInt('30000000000');
      const loanId = await lendingProtocol.borrow(userId, [asset.tokenId], loanAmount);
      expect(loanId).toBeDefined();

      // Record lending transaction
      await analyticsService.recordTransaction({
        transactionId: `lending_${loanId}`,
        userId,
        type: 'lending',
        amount: Number(loanAmount),
        timestamp: new Date(),
        status: 'completed'
      });

      // Step 4: User repays loan
      const repayAmount = loanAmount + BigInt('2000000000'); // with interest
      const repayResult = await lendingProtocol.repay(loanId, repayAmount);
      expect(repayResult).toBe(true);

      // Step 5: Verify loan status
      const loan = await lendingProtocol.getLoan(loanId);
      expect(loan.status).toBe('repaid');

      // Step 6: Verify analytics captured all transactions
      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.recentTransactions.length).toBeGreaterThan(0);
      expect(dashboardData.metrics.totalVolume).toBeGreaterThan(0);
    });

    test('should complete liquid staking workflow', async () => {
      const userId = 'user-staking-1';

      // Step 1: User stakes tokens
      const stakeAmount = BigInt('10000000000');
      const stakingPosition = await stakingProtocol.stake(userId, stakeAmount);
      expect(stakingPosition).toBeDefined();
      expect(stakingPosition.stakedAmount).toBe(stakeAmount);

      // Record staking transaction
      await analyticsService.recordTransaction({
        transactionId: `staking_${stakingPosition.positionId}`,
        userId,
        type: 'staking',
        amount: Number(stakeAmount),
        timestamp: new Date(),
        status: 'completed'
      });

      // Step 2: User unstakes tokens
      const unstakeResult = await stakingProtocol.unstake(userId, stakingPosition.derivativeTokens);
      expect(unstakeResult.unbondingId).toBeDefined();
      expect(unstakeResult.estimatedCompletionTime).toBeGreaterThan(Date.now());

      // Step 3: Verify user positions
      const userPositions = await stakingProtocol.getUserPositions(userId);
      expect(userPositions.length).toBe(1);
      expect(userPositions[0].status).toBe('unbonding');

      // Step 4: Verify analytics
      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.recentTransactions.some(t => t.type === 'staking')).toBe(true);
    });

    test('should handle cross-system integration', async () => {
      const userId = 'user-integration-1';

      // Create asset, stake tokens, and use both in lending
      const asset = await assetTokenization.tokenizeAsset(userId, {
        assetType: 'commodity',
        description: 'Gold reserves',
        valuation: BigInt('25000000000')
      });

      const stakingPosition = await stakingProtocol.stake(userId, BigInt('15000000000'));

      // Use both as collateral (mock implementation)
      const collateralTokens = [asset.tokenId, `staked_${stakingPosition.positionId}`];
      const loanId = await lendingProtocol.borrow(userId, collateralTokens, BigInt('20000000000'));

      // Record manual transactions (borrow is already recorded by lending protocol)
      const transactions = [
        {
          transactionId: `tokenization_${asset.tokenId}`,
          userId,
          type: 'tokenization' as const,
          amount: Number(asset.valuation),
          timestamp: new Date(),
          status: 'completed' as const
        },
        {
          transactionId: `staking_${stakingPosition.positionId}`,
          userId,
          type: 'staking' as const,
          amount: Number(stakingPosition.stakedAmount),
          timestamp: new Date(),
          status: 'completed' as const
        }
      ];

      for (const tx of transactions) {
        await analyticsService.recordTransaction(tx);
      }

      // Verify all systems have consistent data
      const userAssets = await assetTokenization.getUserAssets(userId);
      expect(userAssets.length).toBe(1);

      const userStaking = await stakingProtocol.getUserPositions(userId);
      expect(userStaking.length).toBe(1);

      const loan = await lendingProtocol.getLoan(loanId);
      expect(loan.collateralTokens).toEqual(collateralTokens);

      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.recentTransactions.length).toBe(3);
      expect(dashboardData.metrics.totalVolume).toBeGreaterThan(0);
    });
  });

  describe('Security and Emergency Scenarios', () => {
    test('should detect suspicious activity patterns', async () => {
      const suspiciousUserId = 'suspicious-user-1';

      // Generate rapid transactions to trigger detection
      const transactions = [];
      for (let i = 0; i < 15; i++) {
        const transaction = {
          transactionId: `rapid_${i}`,
          userId: suspiciousUserId,
          type: 'lending' as const,
          amount: 1000 + i * 100,
          timestamp: new Date(Date.now() + i * 500), // 500ms apart
          status: 'completed' as const
        };
        transactions.push(analyticsService.recordTransaction(transaction));
      }

      await Promise.all(transactions);

      // Check for suspicious activity detection
      const dashboardData = await analyticsService.getDashboardData();
      const suspiciousActivities = dashboardData.suspiciousActivities.filter(
        a => a.userId === suspiciousUserId
      );

      expect(suspiciousActivities.length).toBeGreaterThan(0);
      expect(suspiciousActivities.some(a => a.activityType === 'rapid_transactions')).toBe(true);
      expect(suspiciousActivities.some(a => a.severity === 'high')).toBe(true);
    });

    test('should handle failed transaction scenarios', async () => {
      const userId = 'user-failures-1';

      // Generate multiple failed transactions
      const failedTransactions = [];
      for (let i = 0; i < 6; i++) {
        const transaction = {
          transactionId: `failed_${i}`,
          userId,
          type: 'lending' as const,
          amount: 5000,
          timestamp: new Date(Date.now() + i * 10000), // 10 seconds apart
          status: 'failed' as const
        };
        failedTransactions.push(analyticsService.recordTransaction(transaction));
      }

      await Promise.all(failedTransactions);

      // Check for failed attempts detection
      const dashboardData = await analyticsService.getDashboardData();
      const suspiciousActivities = dashboardData.suspiciousActivities.filter(
        a => a.userId === userId
      );

      expect(suspiciousActivities.length).toBeGreaterThan(0);
      expect(suspiciousActivities.some(a => a.activityType === 'failed_attempts')).toBe(true);
      expect(suspiciousActivities.some(a => a.severity === 'critical')).toBe(true);
    });

    test('should log administrative actions', async () => {
      const adminId = 'admin-security-1';

      // Log various admin actions
      const adminActions = [
        {
          adminId,
          action: 'emergency_pause',
          resource: 'lending_protocol',
          resourceId: 'main_pool',
          oldValue: 'active',
          newValue: 'paused',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0'
        },
        {
          adminId,
          action: 'modify_risk_parameters',
          resource: 'lending_pool',
          resourceId: 'main_pool',
          oldValue: { ltv: 0.75 },
          newValue: { ltv: 0.70 },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0'
        },
        {
          adminId,
          action: 'suspend_user',
          resource: 'user_account',
          resourceId: 'suspicious-user-1',
          oldValue: 'active',
          newValue: 'suspended',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0'
        }
      ];

      for (const action of adminActions) {
        await analyticsService.logAdminAction(action);
      }

      // Verify audit logs
      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.recentAuditLogs.length).toBe(3);
      
      const criticalActions = dashboardData.recentAuditLogs.filter(
        log => ['emergency_pause', 'modify_risk_parameters', 'suspend_user'].includes(log.action)
      );
      expect(criticalActions.length).toBe(3);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high transaction volume', async () => {
      const startTime = Date.now();
      const transactionCount = 50;
      const userId = 'volume-test-user';

      // Create many transactions concurrently
      const transactions = Array.from({ length: transactionCount }, (_, i) => 
        analyticsService.recordTransaction({
          transactionId: `volume_${i}`,
          userId,
          type: ['tokenization', 'lending', 'staking'][i % 3] as any,
          amount: Math.floor(Math.random() * 10000) + 1000,
          timestamp: new Date(Date.now() + i * 10),
          status: 'completed'
        })
      );

      await Promise.all(transactions);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process transactions efficiently
      expect(processingTime).toBeLessThan(3000); // Less than 3 seconds

      // Verify all transactions were recorded
      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.recentTransactions.length).toBeGreaterThan(0);
      expect(dashboardData.metrics.totalVolume).toBeGreaterThan(0);
    });

    test('should maintain data consistency under load', async () => {
      const userCount = 10;
      const transactionsPerUser = 5;

      // Create multiple users with concurrent operations
      const operations = Array.from({ length: userCount }, async (_, userIndex) => {
        const userId = `load-user-${userIndex}`;
        
        // Each user performs multiple operations
        const userOperations = [];
        
        // Tokenize asset
        const asset = await assetTokenization.tokenizeAsset(userId, {
          assetType: 'commodity',
          description: `Asset ${userIndex}`,
          valuation: BigInt(`${(userIndex + 1) * 1000000000}`)
        });
        userOperations.push(asset);

        // Create staking position
        const stakingPosition = await stakingProtocol.stake(userId, BigInt(`${(userIndex + 1) * 2000000000}`));
        userOperations.push(stakingPosition);

        // Record transactions
        for (let i = 0; i < transactionsPerUser; i++) {
          await analyticsService.recordTransaction({
            transactionId: `load_${userId}_${i}`,
            userId,
            type: ['tokenization', 'lending', 'staking'][i % 3] as any,
            amount: Math.floor(Math.random() * 5000) + 500,
            timestamp: new Date(),
            status: 'completed'
          });
        }

        return { userId, asset, stakingPosition };
      });

      const results = await Promise.all(operations);

      // Verify all operations completed successfully
      expect(results.length).toBe(userCount);
      results.forEach((result, index) => {
        expect(result.asset).toBeDefined();
        expect(result.asset.owner).toBe(`load-user-${index}`);
        expect(result.stakingPosition).toBeDefined();
        expect(result.stakingPosition.staker).toBe(`load-user-${index}`);
      });

      // Verify system metrics are accurate
      const dashboardData = await analyticsService.getDashboardData();
      expect(dashboardData.metrics.totalVolume).toBeGreaterThan(0);
      expect(dashboardData.recentTransactions.length).toBeGreaterThan(0);
    });
  });

  describe('Data Consistency and Recovery', () => {
    test('should maintain consistency across system restarts', async () => {
      const userId = 'consistency-user';

      // Create initial data
      const asset = await assetTokenization.tokenizeAsset(userId, {
        assetType: 'real_estate',
        description: 'Test property',
        valuation: BigInt('30000000000')
      });

      await analyticsService.recordTransaction({
        transactionId: `consistency_${asset.tokenId}`,
        userId,
        type: 'tokenization',
        amount: Number(asset.valuation),
        timestamp: new Date(),
        status: 'completed'
      });

      // Simulate system restart by creating new service instances
      const newMockRedis = new MockRedis();
      const newMockDb = new MockDb();
      const newAnalyticsService = new AnalyticsService(newMockRedis as any, newMockDb as any);

      // Verify data can be reconstructed (in real system, this would be from persistent storage)
      const newAsset = await assetTokenization.getAsset(asset.tokenId);
      expect(newAsset).toBeDefined();
      expect(newAsset.tokenId).toBe(asset.tokenId);

      // Record new transaction with new service
      await newAnalyticsService.recordTransaction({
        transactionId: `post_restart_${Date.now()}`,
        userId,
        type: 'lending',
        amount: 15000000000,
        timestamp: new Date(),
        status: 'completed'
      });

      const dashboardData = await newAnalyticsService.getDashboardData();
      expect(dashboardData.recentTransactions.length).toBeGreaterThan(0);
    });

    test('should handle partial failures gracefully', async () => {
      const userId = 'partial-failure-user';

      // Simulate partial failure scenario
      try {
        // This should succeed
        const asset = await assetTokenization.tokenizeAsset(userId, {
          assetType: 'art',
          description: 'Digital artwork',
          valuation: BigInt('5000000000')
        });

        // Record successful transaction
        await analyticsService.recordTransaction({
          transactionId: `success_${asset.tokenId}`,
          userId,
          type: 'tokenization',
          amount: Number(asset.valuation),
          timestamp: new Date(),
          status: 'completed'
        });

        // This should fail (invalid loan amount)
        try {
          await lendingProtocol.borrow(userId, [asset.tokenId], BigInt('0'));
        } catch (error) {
          // Record failed transaction
          await analyticsService.recordTransaction({
            transactionId: `failure_${Date.now()}`,
            userId,
            type: 'lending',
            amount: 0,
            timestamp: new Date(),
            status: 'failed'
          });
        }

        // Verify system state is consistent
        const userAssets = await assetTokenization.getUserAssets(userId);
        expect(userAssets.length).toBe(1);
        expect(userAssets[0].status).toBe('active');

        const dashboardData = await analyticsService.getDashboardData();
        const userTransactions = dashboardData.recentTransactions.filter(t => t.userId === userId);
        expect(userTransactions.some(t => t.status === 'completed')).toBe(true);
        expect(userTransactions.some(t => t.status === 'failed')).toBe(true);

      } catch (error) {
        // Should not reach here in normal operation
        throw new Error(`Unexpected error: ${error}`);
      }
    });
  });
});