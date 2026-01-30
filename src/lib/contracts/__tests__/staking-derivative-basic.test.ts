import { StakingDerivative, StakingDerivativeError } from '../staking-derivative';
import { ExternalWalletService } from '@/lib/wallet/external-wallet-service';
import { AccessControl } from '@/lib/auth/access-control';
import { UserRole } from '@/types/auth';

describe('StakingDerivative - Basic Unit Tests', () => {
  let stakingDerivative: StakingDerivative;
  let externalWalletService: ExternalWalletService;
  let walletId: string;

  beforeEach(async () => {
    // Create external wallet service
    externalWalletService = new ExternalWalletService({
      balanceThreshold: BigInt('1000000000'),
      transactionAgeThreshold: 3600,
      inactivityThreshold: 86400,
      emailRecipients: ['test@example.com'],
    });

    // Create test wallet
    walletId = await externalWalletService.createWallet({
      requiredSignatures: 3,
      totalSigners: 5,
      timelockConfig: {
        smallAmountThreshold: BigInt('1000000000'),
        mediumAmountThreshold: BigInt('10000000000'),
        smallAmountDelay: 300,
        mediumAmountDelay: 3600,
        largeAmountDelay: 86400,
      },
      alertConfig: {
        balanceThreshold: BigInt('1000000000'),
        transactionAgeThreshold: 3600,
        inactivityThreshold: 86400,
        emailRecipients: ['test@example.com'],
      },
    });

    // Set up wallet balance
    const internalWalletManager = (externalWalletService as any).walletManager;
    internalWalletManager.updateWalletBalance(walletId, BigInt('100000000000')); // 100 CSPR

    // Create staking derivative contract
    stakingDerivative = new StakingDerivative(externalWalletService, walletId);
  });

  afterEach(() => {
    externalWalletService.shutdown();
  });

  describe('Staking Operations', () => {
    test('should stake tokens and mint derivatives at 1:1 ratio initially', async () => {
      const stakeAmount = BigInt('10000000000'); // 10 CSPR
      
      const result = await stakingDerivative.stake('user1', stakeAmount);
      
      expect(result.positionId).toBeDefined();
      expect(result.derivativeTokens).toBe(stakeAmount); // 1:1 ratio initially
      
      // Verify position was created
      const position = stakingDerivative.getStakingPosition(result.positionId);
      expect(position.staker).toBe('user1');
      expect(position.stakedAmount).toBe(stakeAmount);
      expect(position.derivativeTokens).toBe(stakeAmount);
    });

    test('should reject staking below minimum amount', async () => {
      const smallAmount = BigInt('500000000'); // 0.5 CSPR (below 1 CSPR minimum)
      
      await expect(
        stakingDerivative.stake('user1', smallAmount)
      ).rejects.toThrow(StakingDerivativeError);
    });

    test('should reject staking above maximum amount', async () => {
      const largeAmount = BigInt('2000000000000000'); // 2M CSPR (above 1M CSPR maximum)
      
      await expect(
        stakingDerivative.stake('user1', largeAmount)
      ).rejects.toThrow(StakingDerivativeError);
    });

    test('should handle multiple staking operations', async () => {
      const stake1 = BigInt('5000000000'); // 5 CSPR
      const stake2 = BigInt('3000000000'); // 3 CSPR
      
      const result1 = await stakingDerivative.stake('user1', stake1);
      const result2 = await stakingDerivative.stake('user1', stake2);
      
      expect(result1.derivativeTokens).toBe(stake1);
      expect(result2.derivativeTokens).toBe(stake2);
      
      // Verify user has multiple positions
      const userPositions = stakingDerivative.getUserStakingPositions('user1');
      expect(userPositions).toHaveLength(2);
      
      const totalDerivatives = userPositions.reduce(
        (sum, pos) => sum + pos.derivativeTokens, 
        BigInt(0)
      );
      expect(totalDerivatives).toBe(stake1 + stake2);
    });
  });

  describe('Unstaking Operations', () => {
    beforeEach(async () => {
      // Set up initial staking position
      await stakingDerivative.stake('user1', BigInt('20000000000')); // 20 CSPR
    });

    test('should initiate unstaking and create unbonding request', async () => {
      const unstakeAmount = BigInt('5000000000'); // 5 CSPR worth of derivatives
      
      const result = await stakingDerivative.unstake('user1', unstakeAmount);
      
      expect(result.unbondingId).toBeDefined();
      expect(result.casperAmount).toBe(unstakeAmount); // 1:1 ratio initially
      expect(result.completesAt).toBeInstanceOf(Date);
      
      // Verify unbonding period (7 days)
      const now = new Date();
      const expectedCompletion = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result.completesAt.getTime() - expectedCompletion.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    test('should reject unstaking more than available derivatives', async () => {
      const excessiveAmount = BigInt('50000000000'); // 50 CSPR (more than staked)
      
      await expect(
        stakingDerivative.unstake('user1', excessiveAmount)
      ).rejects.toThrow(StakingDerivativeError);
    });

    test('should update derivative token balance after unstaking', async () => {
      const initialPositions = stakingDerivative.getUserStakingPositions('user1');
      const initialDerivatives = initialPositions.reduce(
        (sum, pos) => sum + pos.derivativeTokens, 
        BigInt(0)
      );
      
      const unstakeAmount = BigInt('5000000000');
      await stakingDerivative.unstake('user1', unstakeAmount);
      
      const finalPositions = stakingDerivative.getUserStakingPositions('user1');
      const finalDerivatives = finalPositions.reduce(
        (sum, pos) => sum + pos.derivativeTokens, 
        BigInt(0)
      );
      
      expect(finalDerivatives).toBe(initialDerivatives - unstakeAmount);
    });
  });

  describe('Exchange Rate Management', () => {
    test('should start with 1:1 exchange rate', async () => {
      const exchangeRate = await stakingDerivative.getExchangeRate();
      
      expect(exchangeRate.rate).toBe(BigInt('1000000000000000000')); // 1e18 = 1:1 ratio
      expect(exchangeRate.totalStaked).toBe(BigInt(0));
      expect(exchangeRate.totalDerivativeSupply).toBe(BigInt(0));
      expect(exchangeRate.totalRewards).toBe(BigInt(0));
    });

    test('should update exchange rate after staking', async () => {
      const stakeAmount = BigInt('10000000000');
      await stakingDerivative.stake('user1', stakeAmount);
      
      const exchangeRate = await stakingDerivative.getExchangeRate();
      
      expect(exchangeRate.totalStaked).toBe(stakeAmount);
      expect(exchangeRate.totalDerivativeSupply).toBe(stakeAmount);
    });

    test('should calculate derivative tokens correctly with exchange rate', async () => {
      // Stake initial amount
      await stakingDerivative.stake('user1', BigInt('10000000000'));
      
      // Simulate rewards by updating external wallet balance
      externalWalletService.simulateStakingRewards(walletId);
      
      // Force exchange rate update by getting it
      await stakingDerivative.getExchangeRate();
      
      // Stake again - should get fewer derivatives due to improved exchange rate
      const result = await stakingDerivative.stake('user2', BigInt('10000000000'));
      
      // With rewards, exchange rate should be better than 1:1, so fewer derivatives
      expect(result.derivativeTokens).toBeLessThanOrEqual(BigInt('10000000000'));
    });
  });

  describe('Position Management', () => {
    test('should track staking positions correctly', async () => {
      const stakeAmount = BigInt('15000000000');
      const result = await stakingDerivative.stake('user1', stakeAmount);
      
      const position = stakingDerivative.getStakingPosition(result.positionId);
      
      expect(position.id).toBe(result.positionId);
      expect(position.staker).toBe('user1');
      expect(position.stakedAmount).toBe(stakeAmount);
      expect(position.derivativeTokens).toBe(result.derivativeTokens);
      expect(position.externalWalletId).toBe(walletId);
      expect(position.delegatedValidators).toHaveLength(1);
      expect(position.rewardsEarned).toBe(BigInt(0));
      expect(position.unbondingRequests).toHaveLength(0);
      expect(position.createdAt).toBeInstanceOf(Date);
      expect(position.lastUpdated).toBeInstanceOf(Date);
    });

    test('should return user-specific positions', async () => {
      await stakingDerivative.stake('user1', BigInt('10000000000'));
      await stakingDerivative.stake('user1', BigInt('5000000000'));
      await stakingDerivative.stake('user2', BigInt('8000000000'));
      
      const user1Positions = stakingDerivative.getUserStakingPositions('user1');
      const user2Positions = stakingDerivative.getUserStakingPositions('user2');
      
      expect(user1Positions).toHaveLength(2);
      expect(user2Positions).toHaveLength(1);
      
      user1Positions.forEach(pos => expect(pos.staker).toBe('user1'));
      user2Positions.forEach(pos => expect(pos.staker).toBe('user2'));
    });

    test('should throw error for non-existent position', () => {
      expect(() => {
        stakingDerivative.getStakingPosition('non_existent_id');
      }).toThrow(StakingDerivativeError);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide accurate staking statistics', async () => {
      await stakingDerivative.stake('user1', BigInt('10000000000'));
      await stakingDerivative.stake('user2', BigInt('15000000000'));
      
      const stats = await stakingDerivative.getStakingStats();
      
      expect(stats.totalStaked).toBe(BigInt('25000000000'));
      expect(stats.totalDerivativeSupply).toBe(BigInt('25000000000'));
      expect(stats.activePositions).toBe(2);
      expect(stats.pendingUnbonding).toBe(BigInt(0));
      expect(stats.exchangeRate).toBe(BigInt('1000000000000000000')); // 1:1 initially
    });

    test('should track pending unbonding in statistics', async () => {
      await stakingDerivative.stake('user1', BigInt('20000000000'));
      await stakingDerivative.unstake('user1', BigInt('5000000000'));
      
      const stats = await stakingDerivative.getStakingStats();
      
      expect(stats.pendingUnbonding).toBe(BigInt('5000000000'));
    });
  });

  describe('Access Control', () => {
    test('should reject unauthorized staking', async () => {
      await expect(
        stakingDerivative.stake('', BigInt('10000000000'))
      ).rejects.toThrow('User not authorized to stake');
    });

    test('should reject unauthorized unstaking', async () => {
      await stakingDerivative.stake('user1', BigInt('10000000000'));
      
      await expect(
        stakingDerivative.unstake('', BigInt('5000000000'))
      ).rejects.toThrow('User not authorized to unstake');
    });
  });

  describe('Error Handling', () => {
    test('should handle external wallet service errors gracefully', async () => {
      // Mock external wallet service to throw error
      const originalDelegate = externalWalletService.delegateToValidator;
      externalWalletService.delegateToValidator = jest.fn().mockRejectedValue(
        new Error('External wallet error')
      );
      
      await expect(
        stakingDerivative.stake('user1', BigInt('10000000000'))
      ).rejects.toThrow(StakingDerivativeError);
      
      // Restore original method
      externalWalletService.delegateToValidator = originalDelegate;
    });

    test('should maintain consistency on partial failures', async () => {
      const initialStats = await stakingDerivative.getStakingStats();
      
      // Mock external wallet service to throw error after some operations
      const originalDelegate = externalWalletService.delegateToValidator;
      externalWalletService.delegateToValidator = jest.fn().mockRejectedValue(
        new Error('Network error')
      );
      
      try {
        await stakingDerivative.stake('user1', BigInt('10000000000'));
      } catch (error) {
        // Expected to fail
      }
      
      const finalStats = await stakingDerivative.getStakingStats();
      
      // Statistics should remain unchanged after failed operation
      expect(finalStats.totalStaked).toBe(initialStats.totalStaked);
      expect(finalStats.totalDerivativeSupply).toBe(initialStats.totalDerivativeSupply);
      expect(finalStats.activePositions).toBe(initialStats.activePositions);
      
      // Restore original method
      externalWalletService.delegateToValidator = originalDelegate;
    });
  });
});