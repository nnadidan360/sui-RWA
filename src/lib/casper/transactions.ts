/**
 * Casper Transaction Monitoring and Confirmation Tracking
 * Handles transaction lifecycle, status tracking, and confirmation monitoring
 */

import { DeployUtil, CLPublicKey, RuntimeArgs, type RuntimeArgsType } from './sdk-compat';
import { getCasperClient, CasperClientError } from './client';
import { getCasperConfig, CONTRACT_ENTRY_POINTS, CASPER_ERRORS } from '@/config/casper';

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'timeout';
  timestamp: number;
  confirmations: number;
  blockHeight?: number;
  cost?: string;
  errorMessage?: string;
  result?: any;
}

export interface TransactionOptions {
  gasLimit?: string;
  gasPrice?: number;
  ttl?: number;
  chainName?: string;
}

export interface ContractCallOptions extends TransactionOptions {
  contractHash: string;
  entryPoint: string;
  args: RuntimeArgsType;
  paymentAmount: string;
}

export class TransactionMonitor {
  private activeTransactions = new Map<string, TransactionStatus>();
  private config = getCasperConfig();
  private client = getCasperClient();

  /**
   * Create and deploy a contract call transaction
   */
  public async deployContractCall(
    publicKey: string,
    privateKey: Uint8Array,
    options: ContractCallOptions
  ): Promise<string> {
    try {
      const keyPair = {
        publicKey: CLPublicKey.fromHex(publicKey),
        privateKey,
      };

      // Create the deploy
      const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
          keyPair.publicKey,
          options.chainName || this.config.chainName,
          options.gasPrice || this.config.gasPrice,
          options.ttl || this.config.deployTtl
        ),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
          Uint8Array.from(Buffer.from(options.contractHash, 'hex')),
          options.entryPoint,
          options.args
        ),
        DeployUtil.standardPayment(options.paymentAmount)
      );

      // Sign the deploy
      const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

      // Deploy to network
      const deployHash = await this.client.deploy(signedDeploy);

      // Start monitoring
      this.startMonitoring(deployHash);

      return deployHash;
    } catch (error) {
      throw new CasperClientError(
        'DEPLOY_FAILED',
        `Failed to deploy contract call: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create and deploy a transfer transaction
   */
  public async deployTransfer(
    publicKey: string,
    privateKey: Uint8Array,
    targetPublicKey: string,
    amount: string,
    options: TransactionOptions = {}
  ): Promise<string> {
    try {
      const keyPair = {
        publicKey: CLPublicKey.fromHex(publicKey),
        privateKey,
      };

      const targetKey = CLPublicKey.fromHex(targetPublicKey);

      // Create transfer deploy
      const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
          keyPair.publicKey,
          options.chainName || this.config.chainName,
          options.gasPrice || this.config.gasPrice,
          options.ttl || this.config.deployTtl
        ),
        DeployUtil.ExecutableDeployItem.newTransfer(
          amount,
          targetKey,
          null, // no source URef
          Math.floor(Math.random() * 1000000) // random ID
        ),
        DeployUtil.standardPayment('10000') // 10k motes for transfer
      );

      // Sign the deploy
      const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

      // Deploy to network
      const deployHash = await this.client.deploy(signedDeploy);

      // Start monitoring
      this.startMonitoring(deployHash);

      return deployHash;
    } catch (error) {
      throw new CasperClientError(
        'DEPLOY_FAILED',
        `Failed to deploy transfer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start monitoring a transaction
   */
  public startMonitoring(deployHash: string): void {
    const transaction: TransactionStatus = {
      hash: deployHash,
      status: 'pending',
      timestamp: Date.now(),
      confirmations: 0,
    };

    this.activeTransactions.set(deployHash, transaction);
    this.monitorTransaction(deployHash);
  }

  /**
   * Get transaction status
   */
  public getTransactionStatus(deployHash: string): TransactionStatus | null {
    return this.activeTransactions.get(deployHash) || null;
  }

  /**
   * Get all active transactions
   */
  public getActiveTransactions(): TransactionStatus[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Wait for transaction confirmation
   */
  public async waitForConfirmation(
    deployHash: string,
    requiredConfirmations: number = 1,
    timeout: number = 300000 // 5 minutes
  ): Promise<TransactionStatus> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = this.getTransactionStatus(deployHash);
          
          if (!status) {
            reject(new CasperClientError('INVALID_DEPLOY', 'Transaction not found'));
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            status.status = 'timeout';
            this.activeTransactions.set(deployHash, status);
            reject(new CasperClientError('TIMEOUT', 'Transaction confirmation timeout'));
            return;
          }

          // Check if confirmed
          if (status.status === 'success' && status.confirmations >= requiredConfirmations) {
            resolve(status);
            return;
          }

          // Check if failed
          if (status.status === 'failed') {
            reject(new CasperClientError('DEPLOY_FAILED', status.errorMessage || 'Transaction failed'));
            return;
          }

          // Continue monitoring
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  }

  /**
   * Monitor a specific transaction
   */
  private async monitorTransaction(deployHash: string): Promise<void> {
    try {
      const result = await this.client.waitForDeploy(deployHash);
      const transaction = this.activeTransactions.get(deployHash);
      
      if (!transaction) return;

      if (result.success) {
        transaction.status = 'success';
        transaction.cost = result.cost;
        transaction.result = result.result;
        transaction.confirmations = 1; // Basic confirmation
      } else {
        transaction.status = 'failed';
        transaction.errorMessage = result.error;
        transaction.cost = result.cost;
      }

      this.activeTransactions.set(deployHash, transaction);

      // Continue monitoring for additional confirmations
      if (result.success) {
        this.monitorConfirmations(deployHash);
      }
    } catch (error) {
      const transaction = this.activeTransactions.get(deployHash);
      if (transaction) {
        transaction.status = 'failed';
        transaction.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.activeTransactions.set(deployHash, transaction);
      }
    }
  }

  /**
   * Monitor additional confirmations
   */
  private async monitorConfirmations(deployHash: string): Promise<void> {
    try {
      // Get current block height
      const networkStatus = await this.client.getNetworkStatus();
      const currentHeight = networkStatus.blockHeight;

      // Get deploy info to find block height
      const deployInfo = await this.client.getDeployInfo(deployHash);
      const deployBlockHeight = deployInfo.execution_results?.[0]?.block_hash 
        ? await this.getBlockHeight(deployInfo.execution_results[0].block_hash)
        : currentHeight;

      const transaction = this.activeTransactions.get(deployHash);
      if (transaction) {
        transaction.blockHeight = deployBlockHeight;
        transaction.confirmations = Math.max(1, currentHeight - deployBlockHeight + 1);
        this.activeTransactions.set(deployHash, transaction);
      }
    } catch (error) {
      console.warn(`Failed to monitor confirmations for ${deployHash}:`, error);
    }
  }

  /**
   * Get block height from block hash
   */
  private async getBlockHeight(blockHash: string): Promise<number> {
    try {
      const client = this.client.getClient();
      const block = await client.getBlockInfo(blockHash);
      return block.block?.header.height || 0;
    } catch (error) {
      console.warn('Failed to get block height:', error);
      return 0;
    }
  }

  /**
   * Retry a failed transaction with exponential backoff
   */
  public async retryTransaction(
    deployHash: string,
    maxRetries: number = 3
  ): Promise<string> {
    const transaction = this.activeTransactions.get(deployHash);
    if (!transaction || transaction.status !== 'failed') {
      throw new CasperClientError('INVALID_DEPLOY', 'Transaction not eligible for retry');
    }

    let retryCount = 0;
    let delay = 2000; // Start with 2 seconds

    while (retryCount < maxRetries) {
      try {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Re-monitor the existing transaction
        this.monitorTransaction(deployHash);
        
        return deployHash;
      } catch (error) {
        retryCount++;
        delay *= 2; // Exponential backoff
        
        if (retryCount >= maxRetries) {
          throw new CasperClientError(
            'DEPLOY_FAILED',
            `Transaction retry failed after ${maxRetries} attempts`
          );
        }
      }
    }

    throw new CasperClientError('DEPLOY_FAILED', 'Max retries exceeded');
  }

  /**
   * Clean up old transactions
   */
  public cleanupOldTransactions(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [hash, transaction] of this.activeTransactions) {
      if (now - transaction.timestamp > maxAge) {
        toRemove.push(hash);
      }
    }

    toRemove.forEach(hash => this.activeTransactions.delete(hash));
  }

  /**
   * Get transaction history for storage
   */
  public getTransactionHistory(): TransactionStatus[] {
    return Array.from(this.activeTransactions.values())
      .filter(tx => tx.status === 'success' || tx.status === 'failed')
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Singleton instance
let monitorInstance: TransactionMonitor | null = null;

/**
 * Get the singleton transaction monitor instance
 */
export function getTransactionMonitor(): TransactionMonitor {
  if (!monitorInstance) {
    monitorInstance = new TransactionMonitor();
  }
  return monitorInstance;
}

/**
 * Helper functions for common contract interactions
 */
export const ContractHelpers = {
  /**
   * Call access control contract
   */
  async callAccessControl(
    publicKey: string,
    privateKey: Uint8Array,
    entryPoint: keyof typeof CONTRACT_ENTRY_POINTS.ACCESS_CONTROL,
    args: RuntimeArgsType,
    paymentAmount: string = '500000000'
  ): Promise<string> {
    const config = getCasperConfig();
    const monitor = getTransactionMonitor();

    if (!config.contractAddresses.accessControl) {
      throw new CasperClientError('CONTRACT_NOT_FOUND', 'Access control contract not configured');
    }

    return monitor.deployContractCall(publicKey, privateKey, {
      contractHash: config.contractAddresses.accessControl,
      entryPoint: CONTRACT_ENTRY_POINTS.ACCESS_CONTROL[entryPoint],
      args,
      paymentAmount,
    });
  },

  /**
   * Call asset token factory contract
   */
  async callAssetTokenFactory(
    publicKey: string,
    privateKey: Uint8Array,
    entryPoint: keyof typeof CONTRACT_ENTRY_POINTS.ASSET_TOKEN_FACTORY,
    args: RuntimeArgsType,
    paymentAmount: string = '1500000000'
  ): Promise<string> {
    const config = getCasperConfig();
    const monitor = getTransactionMonitor();

    if (!config.contractAddresses.assetTokenFactory) {
      throw new CasperClientError('CONTRACT_NOT_FOUND', 'Asset token factory contract not configured');
    }

    return monitor.deployContractCall(publicKey, privateKey, {
      contractHash: config.contractAddresses.assetTokenFactory,
      entryPoint: CONTRACT_ENTRY_POINTS.ASSET_TOKEN_FACTORY[entryPoint],
      args,
      paymentAmount,
    });
  },

  /**
   * Call lending pool contract
   */
  async callLendingPool(
    publicKey: string,
    privateKey: Uint8Array,
    entryPoint: keyof typeof CONTRACT_ENTRY_POINTS.LENDING_POOL,
    args: RuntimeArgsType,
    paymentAmount: string = '2000000000'
  ): Promise<string> {
    const config = getCasperConfig();
    const monitor = getTransactionMonitor();

    if (!config.contractAddresses.lendingPool) {
      throw new CasperClientError('CONTRACT_NOT_FOUND', 'Lending pool contract not configured');
    }

    return monitor.deployContractCall(publicKey, privateKey, {
      contractHash: config.contractAddresses.lendingPool,
      entryPoint: CONTRACT_ENTRY_POINTS.LENDING_POOL[entryPoint],
      args,
      paymentAmount,
    });
  },

  /**
   * Call staking contract
   */
  async callStaking(
    publicKey: string,
    privateKey: Uint8Array,
    entryPoint: keyof typeof CONTRACT_ENTRY_POINTS.STAKING,
    args: RuntimeArgsType,
    paymentAmount: string = '1200000000'
  ): Promise<string> {
    const config = getCasperConfig();
    const monitor = getTransactionMonitor();

    if (!config.contractAddresses.stakingContract) {
      throw new CasperClientError('CONTRACT_NOT_FOUND', 'Staking contract not configured');
    }

    return monitor.deployContractCall(publicKey, privateKey, {
      contractHash: config.contractAddresses.stakingContract,
      entryPoint: CONTRACT_ENTRY_POINTS.STAKING[entryPoint],
      args,
      paymentAmount,
    });
  },
};