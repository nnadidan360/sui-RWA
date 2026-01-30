/**
 * Casper Gas Fee Estimation and Optimization
 * Handles gas price calculation, fee estimation, and optimization strategies
 */

import { RuntimeArgs, type RuntimeArgsType } from './sdk-compat';

// Mock CLValue for compatibility
const CLValue = {
  String: (value: string) => ({ value, type: 'String' }),
  U256: (value: string) => ({ value, type: 'U256' }),
  U512: (value: string) => ({ value, type: 'U512' }),
  PublicKey: (value: string) => ({ value, type: 'PublicKey' }),
};
import { getCasperClient } from './client';
import { getCasperConfig, GAS_ESTIMATES, CONTRACT_ENTRY_POINTS } from '@/config/casper';

export interface GasEstimate {
  gasLimit: string;
  gasPrice: number;
  estimatedCost: string;
  maxCost: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface GasOptimizationOptions {
  priority: 'low' | 'standard' | 'high';
  maxGasPrice?: number;
  maxTotalCost?: string;
}

export interface NetworkGasInfo {
  averageGasPrice: number;
  recommendedGasPrice: number;
  networkCongestion: 'low' | 'medium' | 'high';
  lastUpdated: number;
}

export class GasEstimator {
  private config = getCasperConfig();
  private client = getCasperClient();
  private gasInfoCache: NetworkGasInfo | null = null;
  private cacheExpiry = 60000; // 1 minute

  /**
   * Estimate gas for a contract call
   */
  public async estimateContractCall(
    contractHash: string,
    entryPoint: string,
    args: RuntimeArgsType,
    options: GasOptimizationOptions = { priority: 'standard' }
  ): Promise<GasEstimate> {
    try {
      // Get base estimate from predefined values
      const baseEstimate = this.getBaseGasEstimate(entryPoint);
      
      // Adjust based on arguments complexity
      const argsComplexity = this.calculateArgsComplexity(args);
      const adjustedGasLimit = this.adjustGasForComplexity(baseEstimate, argsComplexity);
      
      // Get current network gas info
      const networkInfo = await this.getNetworkGasInfo();
      const gasPrice = this.calculateOptimalGasPrice(networkInfo, options);
      
      // Calculate costs
      const estimatedCost = this.calculateCost(adjustedGasLimit, gasPrice);
      const maxCost = this.calculateCost(this.config.maxGasLimit, gasPrice);
      
      // Determine confidence based on network conditions
      const confidence = this.determineConfidence(networkInfo, argsComplexity);

      return {
        gasLimit: adjustedGasLimit,
        gasPrice,
        estimatedCost,
        maxCost,
        confidence,
      };
    } catch (error) {
      console.warn('Gas estimation failed, using defaults:', error);
      return this.getDefaultGasEstimate(options);
    }
  }

  /**
   * Estimate gas for a transfer
   */
  public async estimateTransfer(
    amount: string,
    options: GasOptimizationOptions = { priority: 'standard' }
  ): Promise<GasEstimate> {
    const networkInfo = await this.getNetworkGasInfo();
    const gasPrice = this.calculateOptimalGasPrice(networkInfo, options);
    const gasLimit = GAS_ESTIMATES.transfer;
    
    return {
      gasLimit,
      gasPrice,
      estimatedCost: this.calculateCost(gasLimit, gasPrice),
      maxCost: this.calculateCost(gasLimit, gasPrice * 1.5), // 50% buffer
      confidence: 'high',
    };
  }

  /**
   * Get current network gas information
   */
  public async getNetworkGasInfo(): Promise<NetworkGasInfo> {
    // Return cached info if still valid
    if (this.gasInfoCache && Date.now() - this.gasInfoCache.lastUpdated < this.cacheExpiry) {
      return this.gasInfoCache;
    }

    try {
      // In a real implementation, this would query recent blocks for gas prices
      // For now, we'll use network status to estimate congestion
      const networkStatus = await this.client.getNetworkStatus();
      
      // Estimate congestion based on peer count and other factors
      const congestion = this.estimateNetworkCongestion(networkStatus);
      
      // Calculate gas prices based on congestion
      const baseGasPrice = this.config.gasPrice;
      const averageGasPrice = this.adjustGasPriceForCongestion(baseGasPrice, congestion);
      const recommendedGasPrice = Math.ceil(averageGasPrice * 1.1); // 10% above average
      
      this.gasInfoCache = {
        averageGasPrice,
        recommendedGasPrice,
        networkCongestion: congestion,
        lastUpdated: Date.now(),
      };

      return this.gasInfoCache;
    } catch (error) {
      console.warn('Failed to get network gas info, using defaults:', error);
      
      // Return default values on error
      return {
        averageGasPrice: this.config.gasPrice,
        recommendedGasPrice: this.config.gasPrice,
        networkCongestion: 'medium',
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Optimize gas parameters for multiple transactions
   */
  public async optimizeBatchTransactions(
    transactions: Array<{
      type: 'contract_call' | 'transfer';
      contractHash?: string;
      entryPoint?: string;
      args?: RuntimeArgsType;
      amount?: string;
    }>,
    options: GasOptimizationOptions = { priority: 'standard' }
  ): Promise<GasEstimate[]> {
    const estimates = await Promise.all(
      transactions.map(async (tx) => {
        if (tx.type === 'transfer') {
          return this.estimateTransfer(tx.amount || '0', options);
        } else if (tx.contractHash && tx.entryPoint && tx.args) {
          return this.estimateContractCall(tx.contractHash, tx.entryPoint, tx.args, options);
        } else {
          return this.getDefaultGasEstimate(options);
        }
      })
    );

    // Apply batch optimization (e.g., use consistent gas price)
    const networkInfo = await this.getNetworkGasInfo();
    const optimalGasPrice = this.calculateOptimalGasPrice(networkInfo, options);
    
    return estimates.map(estimate => ({
      ...estimate,
      gasPrice: optimalGasPrice,
      estimatedCost: this.calculateCost(estimate.gasLimit, optimalGasPrice),
      maxCost: this.calculateCost(estimate.gasLimit, optimalGasPrice * 1.5),
    }));
  }

  /**
   * Get base gas estimate for an entry point
   */
  private getBaseGasEstimate(entryPoint: string): string {
    // Map entry points to gas estimates
    const entryPointGasMap: Record<string, string> = {
      // Access Control
      [CONTRACT_ENTRY_POINTS.ACCESS_CONTROL.GRANT_ROLE]: GAS_ESTIMATES.grantRole,
      [CONTRACT_ENTRY_POINTS.ACCESS_CONTROL.REVOKE_ROLE]: GAS_ESTIMATES.revokeRole,
      [CONTRACT_ENTRY_POINTS.ACCESS_CONTROL.EMERGENCY_PAUSE]: GAS_ESTIMATES.emergencyPause,
      
      // Asset Token Factory
      [CONTRACT_ENTRY_POINTS.ASSET_TOKEN_FACTORY.CREATE_ASSET_TOKEN]: GAS_ESTIMATES.createAsset,
      [CONTRACT_ENTRY_POINTS.ASSET_TOKEN_FACTORY.TRANSFER_OWNERSHIP]: GAS_ESTIMATES.transferAsset,
      [CONTRACT_ENTRY_POINTS.ASSET_TOKEN_FACTORY.VERIFY_ASSET]: GAS_ESTIMATES.verifyAsset,
      
      // Lending Pool
      [CONTRACT_ENTRY_POINTS.LENDING_POOL.DEPOSIT]: GAS_ESTIMATES.deposit,
      [CONTRACT_ENTRY_POINTS.LENDING_POOL.WITHDRAW]: GAS_ESTIMATES.withdraw,
      [CONTRACT_ENTRY_POINTS.LENDING_POOL.BORROW]: GAS_ESTIMATES.borrow,
      [CONTRACT_ENTRY_POINTS.LENDING_POOL.REPAY]: GAS_ESTIMATES.repay,
      [CONTRACT_ENTRY_POINTS.LENDING_POOL.LIQUIDATE]: GAS_ESTIMATES.liquidate,
      
      // Staking
      [CONTRACT_ENTRY_POINTS.STAKING.STAKE]: GAS_ESTIMATES.stake,
      [CONTRACT_ENTRY_POINTS.STAKING.UNSTAKE]: GAS_ESTIMATES.unstake,
      [CONTRACT_ENTRY_POINTS.STAKING.CLAIM_REWARDS]: GAS_ESTIMATES.claimRewards,
    };

    return entryPointGasMap[entryPoint] || GAS_ESTIMATES.contractCall;
  }

  /**
   * Calculate complexity of runtime arguments
   */
  private calculateArgsComplexity(args: RuntimeArgsType): number {
    let complexity = 1;
    
    try {
      // Check if args has the expected structure
      if (args && typeof args === 'object') {
        // For casper-js-sdk RuntimeArgs, we'll use a simple heuristic
        const argsString = JSON.stringify(args);
        complexity += argsString.length * 0.001; // Complexity based on serialized size
      }
    } catch (error) {
      console.warn('Failed to calculate args complexity:', error);
    }
    
    return Math.max(1, Math.min(complexity, 3)); // Clamp between 1 and 3
  }

  /**
   * Adjust gas limit based on complexity
   */
  private adjustGasForComplexity(baseGas: string, complexity: number): string {
    const baseAmount = BigInt(baseGas);
    const adjustment = BigInt(Math.floor(Number(baseAmount) * (complexity - 1) * 0.2));
    return (baseAmount + adjustment).toString();
  }

  /**
   * Calculate optimal gas price based on network conditions and options
   */
  private calculateOptimalGasPrice(
    networkInfo: NetworkGasInfo,
    options: GasOptimizationOptions
  ): number {
    let gasPrice = networkInfo.recommendedGasPrice;
    
    // Adjust based on priority
    switch (options.priority) {
      case 'low':
        gasPrice = Math.max(1, Math.floor(gasPrice * 0.8));
        break;
      case 'high':
        gasPrice = Math.ceil(gasPrice * 1.5);
        break;
      default: // standard
        gasPrice = networkInfo.recommendedGasPrice;
    }
    
    // Apply max gas price limit if specified
    if (options.maxGasPrice) {
      gasPrice = Math.min(gasPrice, options.maxGasPrice);
    }
    
    return gasPrice;
  }

  /**
   * Calculate transaction cost
   */
  private calculateCost(gasLimit: string, gasPrice: number): string {
    return (BigInt(gasLimit) * BigInt(Math.floor(gasPrice))).toString();
  }

  /**
   * Estimate network congestion
   */
  private estimateNetworkCongestion(networkStatus: any): 'low' | 'medium' | 'high' {
    // Simple heuristic based on peer count
    const peerCount = networkStatus.peers || 0;
    
    if (peerCount < 10) return 'low';
    if (peerCount < 50) return 'medium';
    return 'high';
  }

  /**
   * Adjust gas price for network congestion
   */
  private adjustGasPriceForCongestion(
    basePrice: number,
    congestion: 'low' | 'medium' | 'high'
  ): number {
    switch (congestion) {
      case 'low':
        return Math.max(1, Math.floor(basePrice * 0.9));
      case 'high':
        return Math.ceil(basePrice * 1.3);
      default:
        return basePrice;
    }
  }

  /**
   * Determine confidence level for gas estimate
   */
  private determineConfidence(
    networkInfo: NetworkGasInfo,
    argsComplexity: number
  ): 'low' | 'medium' | 'high' {
    if (networkInfo.networkCongestion === 'high' || argsComplexity > 2) {
      return 'low';
    }
    if (networkInfo.networkCongestion === 'medium' || argsComplexity > 1.5) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Get default gas estimate when calculation fails
   */
  private getDefaultGasEstimate(options: GasOptimizationOptions): GasEstimate {
    const gasLimit = GAS_ESTIMATES.contractCall;
    const gasPrice = this.config.gasPrice;
    
    return {
      gasLimit,
      gasPrice,
      estimatedCost: this.calculateCost(gasLimit, gasPrice),
      maxCost: this.calculateCost(this.config.maxGasLimit, gasPrice),
      confidence: 'medium',
    };
  }

  /**
   * Clear gas info cache
   */
  public clearCache(): void {
    this.gasInfoCache = null;
  }
}

// Singleton instance
let estimatorInstance: GasEstimator | null = null;

/**
 * Get the singleton gas estimator instance
 */
export function getGasEstimator(): GasEstimator {
  if (!estimatorInstance) {
    estimatorInstance = new GasEstimator();
  }
  return estimatorInstance;
}

/**
 * Utility functions for gas calculations
 */
export const GasUtils = {
  /**
   * Convert motes to CSPR
   */
  motesToCSPR(motes: string): string {
    const motesPerCSPR = BigInt('1000000000'); // 1 CSPR = 1B motes
    const motesAmount = BigInt(motes);
    const cspr = motesAmount / motesPerCSPR;
    const remainder = motesAmount % motesPerCSPR;
    
    if (remainder === BigInt(0)) {
      return cspr.toString();
    }
    
    const decimal = remainder.toString().padStart(9, '0').replace(/0+$/, '');
    return `${cspr}.${decimal}`;
  },

  /**
   * Convert CSPR to motes
   */
  csprToMotes(cspr: string): string {
    const motesPerCSPR = BigInt('1000000000');
    const [whole, decimal = '0'] = cspr.split('.');
    const wholeMotes = BigInt(whole) * motesPerCSPR;
    const decimalMotes = BigInt(decimal.padEnd(9, '0').slice(0, 9));
    return (wholeMotes + decimalMotes).toString();
  },

  /**
   * Format gas cost for display
   */
  formatGasCost(motes: string): string {
    const cspr = GasUtils.motesToCSPR(motes);
    return `${cspr} CSPR`;
  },

  /**
   * Calculate percentage of balance
   */
  calculatePercentageOfBalance(cost: string, balance: string): number {
    if (balance === '0') return 100;
    const costBig = BigInt(cost);
    const balanceBig = BigInt(balance);
    return Number((costBig * BigInt(100)) / balanceBig);
  },
};