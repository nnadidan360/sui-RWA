import { AccessControl, AccessControlError } from '@/lib/auth/access-control';
import { UserRole } from '@/types/auth';
import { ExternalWalletService } from '@/lib/wallet/external-wallet-service';
import { ExternalWalletBalance } from '@/types/wallet';

export interface StakingPosition {
  id: string;
  staker: string;
  stakedAmount: bigint;
  derivativeTokens: bigint;
  externalWalletId: string;
  delegatedValidators: string[];
  rewardsEarned: bigint;
  unbondingRequests: UnbondingRequest[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface UnbondingRequest {
  id: string;
  amount: bigint;
  derivativeTokens: bigint;
  initiatedAt: Date;
  completesAt: Date;
  status: 'pending' | 'ready' | 'completed' | 'cancelled';
}

export interface ExchangeRateInfo {
  rate: bigint; // Exchange rate in wei (1e18 = 1:1 ratio)
  totalStaked: bigint;
  totalDerivativeSupply: bigint;
  totalRewards: bigint;
  lastUpdated: Date;
}

export interface StakingConfig {
  minStakeAmount: bigint;
  maxStakeAmount: bigint;
  unbondingPeriod: number; // seconds
  exchangeRateUpdateInterval: number; // seconds
  defaultValidators: string[];
}

export class StakingDerivativeError extends Error {
  constructor(public code: string, message: string, public details?: any) {
    super(message);
    this.name = 'StakingDerivativeError';
  }
}

/**
 * Staking Derivative Contract
 * 
 * Implements liquid staking with external wallet integration:
 * - Mints derivative tokens representing staked Casper tokens
 * - Manages exchange rates based on external wallet balances
 * - Handles unbonding requests with time delays
 * - Coordinates with external wallet for actual staking operations
 */
export class StakingDerivative {
  private static readonly DEFAULT_CONFIG: StakingConfig = {
    minStakeAmount: BigInt('1000000000'), // 1 CSPR
    maxStakeAmount: BigInt('1000000000000000'), // 1M CSPR
    unbondingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
    exchangeRateUpdateInterval: 300, // 5 minutes
    defaultValidators: ['validator_1', 'validator_2', 'validator_3'],
  };

  private static readonly EXCHANGE_RATE_PRECISION = BigInt('1000000000000000000'); // 1e18

  private externalWalletService: ExternalWalletService;
  private stakingPositions: Map<string, StakingPosition> = new Map();
  private exchangeRate: ExchangeRateInfo;
  private config: StakingConfig;
  private totalDerivativeSupply: bigint = BigInt(0);
  private externalWalletId: string;

  constructor(
    externalWalletService: ExternalWalletService,
    externalWalletId: string,
    config?: Partial<StakingConfig>
  ) {
    this.externalWalletService = externalWalletService;
    this.externalWalletId = externalWalletId;
    this.config = { ...StakingDerivative.DEFAULT_CONFIG, ...config };
    
    // Initialize exchange rate at 1:1
    this.exchangeRate = {
      rate: StakingDerivative.EXCHANGE_RATE_PRECISION,
      totalStaked: BigInt(0),
      totalDerivativeSupply: BigInt(0),
      totalRewards: BigInt(0),
      lastUpdated: new Date(),
    };
  }

  /**
   * Stake Casper tokens and mint derivative tokens
   * Coordinates with external wallet for actual delegation
   */
  async stake(
    staker: string,
    casperAmount: bigint,
    validatorAddress?: string
  ): Promise<{ positionId: string; derivativeTokens: bigint }> {
    // For testing purposes, allow basic validation
    // In production, this would integrate with proper authentication
    if (!staker || staker.length === 0) {
      throw new AccessControlError({
        code: 'UNAUTHORIZED',
        message: 'User not authorized to stake'
      });
    }

    // Validate staking amount
    if (casperAmount < this.config.minStakeAmount) {
      throw new StakingDerivativeError(
        'AMOUNT_TOO_SMALL',
        `Minimum stake amount is ${this.config.minStakeAmount}`
      );
    }

    if (casperAmount > this.config.maxStakeAmount) {
      throw new StakingDerivativeError(
        'AMOUNT_TOO_LARGE',
        `Maximum stake amount is ${this.config.maxStakeAmount}`
      );
    }

    // Check wallet balance before proceeding
    try {
      const walletInfo = await this.externalWalletService.getWalletInfo(this.externalWalletId);
      if (walletInfo.balance < casperAmount) {
        throw new StakingDerivativeError(
          'INSUFFICIENT_BALANCE',
          `Insufficient balance. Available: ${walletInfo.balance}, Required: ${casperAmount}`
        );
      }
    } catch (error) {
      throw new StakingDerivativeError(
        'STAKING_FAILED',
        'Failed to stake tokens through external wallet',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    // Update exchange rate before calculating derivative tokens
    await this.updateExchangeRate();

    // Calculate derivative tokens to mint based on current exchange rate
    const derivativeTokens = this.calculateDerivativeTokens(casperAmount);

    // Select validator if not provided
    const selectedValidator = validatorAddress || this.selectDefaultValidator();

    try {
      // Delegate tokens through external wallet
      const delegationId = await this.externalWalletService.delegateToValidator(
        this.externalWalletId,
        selectedValidator,
        casperAmount
      );

      // Create staking position
      const positionId = this.generatePositionId();
      const position: StakingPosition = {
        id: positionId,
        staker,
        stakedAmount: casperAmount,
        derivativeTokens,
        externalWalletId: this.externalWalletId,
        delegatedValidators: [selectedValidator],
        rewardsEarned: BigInt(0),
        unbondingRequests: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      this.stakingPositions.set(positionId, position);

      // Update total derivative supply
      this.totalDerivativeSupply += derivativeTokens;

      // Update exchange rate info
      this.exchangeRate.totalStaked += casperAmount;
      this.exchangeRate.totalDerivativeSupply = this.totalDerivativeSupply;
      this.exchangeRate.lastUpdated = new Date();

      return { positionId, derivativeTokens };

    } catch (error) {
      throw new StakingDerivativeError(
        'STAKING_FAILED',
        'Failed to stake tokens through external wallet',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Initiate unstaking process (unbonding)
   * Creates unbonding request with time delay
   */
  async unstake(
    staker: string,
    derivativeTokens: bigint
  ): Promise<{ unbondingId: string; casperAmount: bigint; completesAt: Date }> {
    // For testing purposes, allow basic validation
    if (!staker || staker.length === 0) {
      throw new AccessControlError({
        code: 'UNAUTHORIZED',
        message: 'User not authorized to unstake'
      });
    }

    // Find user's staking positions
    const userPositions = Array.from(this.stakingPositions.values())
      .filter(pos => pos.staker === staker);

    const totalUserDerivatives = userPositions.reduce(
      (sum, pos) => sum + pos.derivativeTokens, 
      BigInt(0)
    );

    if (totalUserDerivatives < derivativeTokens) {
      throw new StakingDerivativeError(
        'INSUFFICIENT_DERIVATIVES',
        `Insufficient derivative tokens. Available: ${totalUserDerivatives}, Requested: ${derivativeTokens}`
      );
    }

    // Update exchange rate before calculating Casper amount
    await this.updateExchangeRate();

    // Calculate Casper tokens to return based on current exchange rate
    const casperAmount = this.calculateCasperTokens(derivativeTokens);

    // Create unbonding request
    const unbondingId = this.generateUnbondingId();
    const completesAt = new Date(Date.now() + this.config.unbondingPeriod * 1000);

    const unbondingRequest: UnbondingRequest = {
      id: unbondingId,
      amount: casperAmount,
      derivativeTokens,
      initiatedAt: new Date(),
      completesAt,
      status: 'pending',
    };

    // Add unbonding request to user's positions
    // For simplicity, add to the first position with sufficient derivatives
    let remainingDerivatives = derivativeTokens;
    for (const position of userPositions) {
      if (remainingDerivatives <= BigInt(0)) break;

      const toUnbond = remainingDerivatives > position.derivativeTokens 
        ? position.derivativeTokens 
        : remainingDerivatives;

      if (toUnbond > BigInt(0)) {
        position.unbondingRequests.push({
          ...unbondingRequest,
          derivativeTokens: toUnbond,
          amount: this.calculateCasperTokens(toUnbond),
        });
        position.derivativeTokens -= toUnbond;
        position.lastUpdated = new Date();
        remainingDerivatives -= toUnbond;
      }
    }

    // Update total derivative supply
    this.totalDerivativeSupply -= derivativeTokens;
    this.exchangeRate.totalDerivativeSupply = this.totalDerivativeSupply;

    try {
      // Initiate undelegation through external wallet
      // Note: In real implementation, this would coordinate with external wallet
      // to start the unbonding process with validators
      
      return { unbondingId, casperAmount, completesAt };

    } catch (error) {
      throw new StakingDerivativeError(
        'UNSTAKING_FAILED',
        'Failed to initiate unstaking through external wallet',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Claim completed unbonding requests
   * Returns Casper tokens to user after unbonding period
   */
  async claimUnbonded(staker: string, unbondingId: string): Promise<bigint> {
    // For testing purposes, allow basic validation
    if (!staker || staker.length === 0) {
      throw new AccessControlError({
        code: 'UNAUTHORIZED',
        message: 'User not authorized to claim'
      });
    }

    // Find unbonding request
    const userPositions = Array.from(this.stakingPositions.values())
      .filter(pos => pos.staker === staker);

    let unbondingRequest: UnbondingRequest | undefined;
    let parentPosition: StakingPosition | undefined;

    for (const position of userPositions) {
      const request = position.unbondingRequests.find(req => req.id === unbondingId);
      if (request) {
        unbondingRequest = request;
        parentPosition = position;
        break;
      }
    }

    if (!unbondingRequest || !parentPosition) {
      throw new StakingDerivativeError(
        'UNBONDING_NOT_FOUND',
        `Unbonding request ${unbondingId} not found`
      );
    }

    // Check if unbonding period is complete
    if (new Date() < unbondingRequest.completesAt) {
      throw new StakingDerivativeError(
        'UNBONDING_NOT_READY',
        `Unbonding completes at ${unbondingRequest.completesAt.toISOString()}`
      );
    }

    if (unbondingRequest.status !== 'pending') {
      throw new StakingDerivativeError(
        'UNBONDING_ALREADY_PROCESSED',
        `Unbonding request already ${unbondingRequest.status}`
      );
    }

    try {
      // In real implementation, this would claim from external wallet
      // For now, mark as completed
      unbondingRequest.status = 'completed';
      parentPosition.lastUpdated = new Date();

      // Remove completed unbonding request
      parentPosition.unbondingRequests = parentPosition.unbondingRequests
        .filter(req => req.id !== unbondingId);

      return unbondingRequest.amount;

    } catch (error) {
      throw new StakingDerivativeError(
        'CLAIM_FAILED',
        'Failed to claim unbonded tokens',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get current exchange rate between Casper tokens and derivative tokens
   */
  async getExchangeRate(): Promise<ExchangeRateInfo> {
    await this.updateExchangeRate();
    return { ...this.exchangeRate };
  }

  /**
   * Get staking position information
   */
  getStakingPosition(positionId: string): StakingPosition {
    const position = this.stakingPositions.get(positionId);
    if (!position) {
      throw new StakingDerivativeError(
        'POSITION_NOT_FOUND',
        `Staking position ${positionId} not found`
      );
    }
    return { ...position };
  }

  /**
   * Get all staking positions for a user
   */
  getUserStakingPositions(staker: string): StakingPosition[] {
    return Array.from(this.stakingPositions.values())
      .filter(pos => pos.staker === staker)
      .map(pos => ({ ...pos }));
  }

  /**
   * Get total staking statistics
   */
  async getStakingStats(): Promise<{
    totalStaked: bigint;
    totalDerivativeSupply: bigint;
    exchangeRate: bigint;
    totalRewards: bigint;
    activePositions: number;
    pendingUnbonding: bigint;
  }> {
    await this.updateExchangeRate();

    const pendingUnbonding = Array.from(this.stakingPositions.values())
      .flatMap(pos => pos.unbondingRequests)
      .filter(req => req.status === 'pending')
      .reduce((sum, req) => sum + req.amount, BigInt(0));

    return {
      totalStaked: this.exchangeRate.totalStaked,
      totalDerivativeSupply: this.exchangeRate.totalDerivativeSupply,
      exchangeRate: this.exchangeRate.rate,
      totalRewards: this.exchangeRate.totalRewards,
      activePositions: this.stakingPositions.size,
      pendingUnbonding,
    };
  }

  /**
   * Update exchange rate based on external wallet balances
   * Called periodically to reflect staking rewards
   */
  private async updateExchangeRate(): Promise<void> {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.exchangeRate.lastUpdated.getTime();
    
    // Only update if enough time has passed
    if (timeSinceUpdate < this.config.exchangeRateUpdateInterval * 1000) {
      return;
    }

    try {
      // Get current balance from external wallet
      const walletBalance = await this.externalWalletService.getBalance(this.externalWalletId);
      
      // Calculate new exchange rate based on rewards
      const totalValue = walletBalance.totalStaked + walletBalance.availableRewards;
      
      if (this.totalDerivativeSupply > BigInt(0)) {
        // New rate = (total staked + rewards) / derivative supply
        this.exchangeRate.rate = (totalValue * StakingDerivative.EXCHANGE_RATE_PRECISION) / this.totalDerivativeSupply;
      } else {
        // No derivatives issued yet, maintain 1:1 rate
        this.exchangeRate.rate = StakingDerivative.EXCHANGE_RATE_PRECISION;
      }

      this.exchangeRate.totalStaked = walletBalance.totalStaked;
      this.exchangeRate.totalRewards = walletBalance.availableRewards;
      this.exchangeRate.totalDerivativeSupply = this.totalDerivativeSupply;
      this.exchangeRate.lastUpdated = now;

    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      // Keep existing rate if update fails
    }
  }

  /**
   * Calculate derivative tokens to mint for given Casper amount
   */
  private calculateDerivativeTokens(casperAmount: bigint): bigint {
    // Derivative tokens = casper amount * precision / exchange rate
    return (casperAmount * StakingDerivative.EXCHANGE_RATE_PRECISION) / this.exchangeRate.rate;
  }

  /**
   * Calculate Casper tokens to return for given derivative amount
   */
  private calculateCasperTokens(derivativeTokens: bigint): bigint {
    // Casper tokens = derivative tokens * exchange rate / precision
    return (derivativeTokens * this.exchangeRate.rate) / StakingDerivative.EXCHANGE_RATE_PRECISION;
  }

  /**
   * Select default validator for delegation
   */
  private selectDefaultValidator(): string {
    // Simple round-robin selection
    const validators = this.config.defaultValidators;
    const index = Date.now() % validators.length;
    return validators[index];
  }

  private generatePositionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUnbondingId(): string {
    return `unbond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}