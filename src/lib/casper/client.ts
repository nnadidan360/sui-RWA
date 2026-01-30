/**
 * Casper RPC Client with Failover Support
 * Handles connection to multiple RPC endpoints with automatic failover
 */

import { DeployUtil, CLPublicKey, RuntimeArgs, type RuntimeArgsType } from './sdk-compat';

// Additional SDK types
let RpcClient: any;
// Mock RpcClient for compatibility
class MockRpcClient {
  constructor() {}
  async getStateRootHash() { return null; }
  async getBlockInfo() { return null; }
  async getDeployInfo() { return null; }
}

const RpcClient = MockRpcClient;
import { getCasperConfig, CONNECTION_CONFIG, CASPER_ERRORS, type CasperError } from '@/config/casper';

export interface RpcEndpoint {
  url: string;
  isHealthy: boolean;
  lastChecked: number;
  responseTime: number;
}

export class CasperRpcClient {
  private endpoints: RpcEndpoint[];
  private currentEndpointIndex: number = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private config = getCasperConfig();

  constructor() {
    this.endpoints = this.config.rpcEndpoints.map(url => ({
      url,
      isHealthy: true,
      lastChecked: 0,
      responseTime: 0,
    }));
    
    this.startHealthCheck();
  }

  /**
   * Get the current active Casper client
   */
  public getClient(): RpcClientType {
    const endpoint = this.getCurrentEndpoint();
    return new RpcClient(endpoint.url);
  }

  /**
   * Execute a function with automatic failover
   */
  public async withFailover<T>(
    operation: (client: RpcClientType) => Promise<T>,
    maxRetries: number = CONNECTION_CONFIG.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = this.getClient();
      
      try {
        const result = await Promise.race([
          operation(client),
          this.createTimeoutPromise<T>(),
        ]);
        
        // Mark current endpoint as healthy on success
        this.markEndpointHealthy(this.currentEndpointIndex);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`RPC attempt ${attempt + 1} failed:`, error);
        
        // Mark current endpoint as unhealthy
        this.markEndpointUnhealthy(this.currentEndpointIndex);
        
        // Try next endpoint
        this.switchToNextEndpoint();
        
        if (attempt < maxRetries - 1) {
          await this.delay(CONNECTION_CONFIG.retryDelay);
        }
      }
    }
    
    throw new CasperClientError(
      'NETWORK_ERROR',
      `All RPC endpoints failed. Last error: ${lastError?.message}`
    );
  }

  /**
   * Get network status information
   */
  public async getNetworkStatus() {
    return this.withFailover(async (client) => {
      const status = await client.getStatus();
      return {
        chainName: status.chainspec_name,
        blockHeight: status.last_added_block_info?.height || 0,
        peers: status.peers?.length || 0,
        buildVersion: status.build_version,
      };
    });
  }

  /**
   * Get account information
   */
  public async getAccountInfo(publicKey: string) {
    return this.withFailover(async (client) => {
      const accountHash = CLPublicKey.fromHex(publicKey).toAccountHashStr();
      const stateRootHash = await client.getStateRootHash();
      return client.getAccountInfo(stateRootHash, accountHash);
    });
  }

  /**
   * Get account balance
   */
  public async getAccountBalance(publicKey: string): Promise<string> {
    return this.withFailover(async (client) => {
      const accountHash = CLPublicKey.fromHex(publicKey).toAccountHashStr();
      const stateRootHash = await client.getStateRootHash();
      const balanceUref = await client.getAccountBalanceUref(stateRootHash, accountHash);
      const balance = await client.getAccountBalance(stateRootHash, balanceUref);
      return balance.toString();
    });
  }

  /**
   * Deploy a contract or call a contract method
   */
  public async deploy(deploy: any) {
    return this.withFailover(async (client) => {
      return client.putDeploy(deploy);
    });
  }

  /**
   * Get deploy information
   */
  public async getDeployInfo(deployHash: string) {
    return this.withFailover(async (client) => {
      return client.getDeploy(deployHash);
    });
  }

  /**
   * Wait for deploy to be processed
   */
  public async waitForDeploy(
    deployHash: string,
    timeout: number = 300000 // 5 minutes
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const deployInfo = await this.getDeployInfo(deployHash);
        
        if (deployInfo.execution_results && deployInfo.execution_results.length > 0) {
          const result = deployInfo.execution_results[0];
          
          if (result.result.Success) {
            return {
              success: true,
              result: result.result.Success,
              cost: result.result.Success.cost,
            };
          } else if (result.result.Failure) {
            return {
              success: false,
              error: result.result.Failure.error_message,
              cost: result.result.Failure.cost,
            };
          }
        }
        
        // Wait before next check
        await this.delay(5000); // 5 seconds
        
      } catch (error) {
        console.warn('Error checking deploy status:', error);
        await this.delay(5000);
      }
    }
    
    throw new CasperClientError('TIMEOUT', 'Deploy processing timeout');
  }

  /**
   * Get contract data
   */
  public async getContractData(contractHash: string, key: string) {
    return this.withFailover(async (client) => {
      const stateRootHash = await client.getStateRootHash();
      return client.getBlockState(stateRootHash, contractHash, [key]);
    });
  }

  /**
   * Call a contract method (read-only)
   */
  public async callContract(
    contractHash: string,
    entryPoint: string,
    args: RuntimeArgsType = RuntimeArgs.fromMap({})
  ) {
    return this.withFailover(async (client) => {
      const stateRootHash = await client.getStateRootHash();
      return client.queryContractData(stateRootHash, contractHash, entryPoint, args);
    });
  }

  /**
   * Get current healthy endpoint
   */
  private getCurrentEndpoint(): RpcEndpoint {
    // Find first healthy endpoint
    for (let i = 0; i < this.endpoints.length; i++) {
      const index = (this.currentEndpointIndex + i) % this.endpoints.length;
      if (this.endpoints[index].isHealthy) {
        this.currentEndpointIndex = index;
        return this.endpoints[index];
      }
    }
    
    // If no healthy endpoints, use current one anyway
    return this.endpoints[this.currentEndpointIndex];
  }

  /**
   * Switch to next available endpoint
   */
  private switchToNextEndpoint(): void {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
  }

  /**
   * Mark endpoint as healthy
   */
  private markEndpointHealthy(index: number): void {
    this.endpoints[index].isHealthy = true;
    this.endpoints[index].lastChecked = Date.now();
  }

  /**
   * Mark endpoint as unhealthy
   */
  private markEndpointUnhealthy(index: number): void {
    this.endpoints[index].isHealthy = false;
    this.endpoints[index].lastChecked = Date.now();
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, CONNECTION_CONFIG.healthCheckInterval);
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    const checks = this.endpoints.map(async (endpoint, index) => {
      try {
        const startTime = Date.now();
        const client = new RpcClient(endpoint.url);
        await client.getStatus();
        
        const responseTime = Date.now() - startTime;
        this.endpoints[index] = {
          ...endpoint,
          isHealthy: true,
          lastChecked: Date.now(),
          responseTime,
        };
      } catch (error) {
        this.endpoints[index] = {
          ...endpoint,
          isHealthy: false,
          lastChecked: Date.now(),
          responseTime: 0,
        };
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new CasperClientError('TIMEOUT', 'Operation timed out'));
      }, CONNECTION_CONFIG.timeout);
    });
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get endpoint health status
   */
  public getEndpointStatus(): RpcEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }
}

/**
 * Custom error class for Casper client operations
 */
export class CasperClientError extends Error {
  public readonly code: CasperError;
  
  constructor(code: CasperError, message: string) {
    super(message);
    this.name = 'CasperClientError';
    this.code = code;
  }
}

// Singleton instance
let clientInstance: CasperRpcClient | null = null;

/**
 * Get the singleton Casper RPC client instance
 */
export function getCasperClient(): CasperRpcClient {
  if (!clientInstance) {
    clientInstance = new CasperRpcClient();
  }
  return clientInstance;
}

/**
 * Cleanup the client instance
 */
export function destroyCasperClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}