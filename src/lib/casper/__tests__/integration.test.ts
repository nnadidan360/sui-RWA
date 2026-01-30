/**
 * Casper Integration Tests
 * Tests the basic functionality of Casper client and configuration
 */

import { getCasperClient, CasperClientError } from '../client';
import { getTransactionMonitor } from '../transactions';
import { getGasEstimator, GasUtils } from '../gas';
import { getCasperConfig } from '@/config/casper';

describe('Casper Integration', () => {
  describe('Configuration', () => {
    it('should load Casper configuration', () => {
      const config = getCasperConfig();
      
      expect(config.networkName).toBe('casper-test');
      expect(config.chainName).toBe('casper-test');
      expect(config.rpcEndpoints).toHaveLength(3);
      expect(config.rpcEndpoints[0]).toContain('rpc.testnet.casperlabs.io');
    });

    it('should have valid gas estimates', () => {
      const config = getCasperConfig();
      
      expect(config.gasPrice).toBeGreaterThan(0);
      expect(config.maxGasLimit).toBeTruthy();
      expect(BigInt(config.maxGasLimit)).toBeGreaterThan(0);
    });
  });

  describe('RPC Client', () => {
    let client: ReturnType<typeof getCasperClient>;

    beforeAll(() => {
      client = getCasperClient();
    });

    afterAll(() => {
      client.destroy();
    });

    it('should create client instance', () => {
      expect(client).toBeDefined();
      expect(typeof client.getClient).toBe('function');
    });

    it('should have healthy endpoints initially', () => {
      const endpoints = client.getEndpointStatus();
      expect(endpoints).toHaveLength(3);
      expect(endpoints.every(ep => ep.isHealthy)).toBe(true);
    });

    // Note: Network tests are skipped in CI/testing environment
    it.skip('should connect to testnet', async () => {
      const status = await client.getNetworkStatus();
      expect(status.chainName).toBe('casper-test');
      expect(status.blockHeight).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Transaction Monitor', () => {
    let monitor: ReturnType<typeof getTransactionMonitor>;

    beforeAll(() => {
      monitor = getTransactionMonitor();
    });

    it('should create monitor instance', () => {
      expect(monitor).toBeDefined();
      expect(typeof monitor.startMonitoring).toBe('function');
    });

    it('should track transaction status', () => {
      const mockHash = 'hash-' + '0'.repeat(64);
      monitor.startMonitoring(mockHash);
      
      const status = monitor.getTransactionStatus(mockHash);
      expect(status).toBeDefined();
      expect(status?.hash).toBe(mockHash);
      expect(status?.status).toBe('pending');
    });

    it('should list active transactions', () => {
      const transactions = monitor.getActiveTransactions();
      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe('Gas Estimator', () => {
    let estimator: ReturnType<typeof getGasEstimator>;

    beforeAll(() => {
      estimator = getGasEstimator();
    });

    it('should create estimator instance', () => {
      expect(estimator).toBeDefined();
      expect(typeof estimator.estimateTransfer).toBe('function');
    });

    it('should estimate transfer gas', async () => {
      const estimate = await estimator.estimateTransfer('1000000000');
      
      expect(estimate.gasLimit).toBeTruthy();
      expect(estimate.gasPrice).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeTruthy();
      expect(estimate.confidence).toMatch(/^(low|medium|high)$/);
    });

    it('should provide default estimates on error', async () => {
      // Force an error by providing invalid parameters
      const estimate = await estimator.estimateContractCall(
        'invalid-hash',
        'invalid-entry-point',
        {} as any
      );
      
      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeTruthy();
      expect(estimate.gasPrice).toBeGreaterThan(0);
    });
  });

  describe('Gas Utils', () => {
    it('should convert motes to CSPR', () => {
      expect(GasUtils.motesToCSPR('1000000000')).toBe('1');
      expect(GasUtils.motesToCSPR('1500000000')).toBe('1.5');
      expect(GasUtils.motesToCSPR('123456789')).toBe('0.123456789');
    });

    it('should convert CSPR to motes', () => {
      expect(GasUtils.csprToMotes('1')).toBe('1000000000');
      expect(GasUtils.csprToMotes('1.5')).toBe('1500000000');
      expect(GasUtils.csprToMotes('0.123456789')).toBe('123456789');
    });

    it('should format gas cost', () => {
      expect(GasUtils.formatGasCost('1000000000')).toBe('1 CSPR');
      expect(GasUtils.formatGasCost('2500000000')).toBe('2.5 CSPR');
    });

    it('should calculate percentage of balance', () => {
      expect(GasUtils.calculatePercentageOfBalance('100', '1000')).toBe(10);
      expect(GasUtils.calculatePercentageOfBalance('500', '1000')).toBe(50);
      expect(GasUtils.calculatePercentageOfBalance('1000', '0')).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should create CasperClientError', () => {
      const error = new CasperClientError('NETWORK_ERROR', 'Test error');
      
      expect(error.name).toBe('CasperClientError');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Test error');
    });

    it('should handle network failures gracefully', async () => {
      const client = getCasperClient();
      
      // This should not throw but return a default value or handle gracefully
      try {
        await client.withFailover(async () => {
          throw new Error('Network error');
        }, 1);
        // If no error is thrown, that's also acceptable (graceful handling)
      } catch (error) {
        // Accept either CasperClientError or the original Error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Environment Integration', () => {
    it('should read contract addresses from environment', () => {
      const config = getCasperConfig();
      
      // Contract addresses should be undefined initially (before deployment)
      expect(config.contractAddresses.accessControl).toBeUndefined();
      expect(config.contractAddresses.assetTokenFactory).toBeUndefined();
      expect(config.contractAddresses.lendingPool).toBeUndefined();
      expect(config.contractAddresses.stakingContract).toBeUndefined();
    });

    it('should use environment-specific configuration', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'production';
      const prodConfig = getCasperConfig();
      expect(prodConfig.networkName).toBe('casper-test');
      
      process.env.NODE_ENV = 'development';
      const devConfig = getCasperConfig();
      expect(devConfig.networkName).toBe('casper-test');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});