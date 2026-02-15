import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { CryptoVaultService, VaultStatus } from './crypto-vault-service';
import { PriceFeedIntegrationService } from './price-feed-integration-service';
import { AssetSymbol } from './price-aggregation-service';
import { logger } from '../../utils/logger';

/**
 * Liquidation record
 */
export interface LiquidationRecord {
  vaultId: string;
  liquidator: string;
  collateralSeizedUsd: number;
  debtRepaidUsd: number;
  penaltyAmountUsd: number;
  excessReturnedUsd: number;
  executedAt: number;
  ltvAtLiquidation: number;
}

/**
 * Liquidation queue entry
 */
export interface LiquidationQueueEntry {
  vaultId: string;
  ltv: number;
  collateralValue: number;
  queuedAt: number;
  priority: number;
}

/**
 * Liquidation penalty (5%)
 */
export const LIQUIDATION_PENALTY_BPS = 500;

/**
 * Service for monitoring vaults and triggering liquidations
 */
export class LiquidationTriggerService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;
  private vaultService: CryptoVaultService;
  private priceFeedService: PriceFeedIntegrationService;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private liquidationQueue: LiquidationQueueEntry[] = [];

  constructor(
    suiClient: SuiClient,
    packageId: string,
    vaultService: CryptoVaultService,
    priceFeedService: PriceFeedIntegrationService,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.vaultService = vaultService;
    this.priceFeedService = priceFeedService;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Execute liquidation on a vault
   */
  async executeLiquidation(
    vaultObjectId: string,
    priceFeedObjectId: string,
    liquidatorAddress: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    record?: LiquidationRecord;
    error?: string;
  }> {
    try {
      logger.info('Executing liquidation', {
        vaultId: vaultObjectId,
        liquidator: liquidatorAddress,
      });

      // Validate price feed first
      const priceValidation = await this.priceFeedService.validatePriceFeedForLiquidation(
        priceFeedObjectId,
        'SUI' as AssetSymbol // In production, determine from vault
      );

      if (!priceValidation.valid) {
        throw new Error(`Price validation failed: ${priceValidation.reason}`);
      }

      // Check vault health
      const health = await this.vaultService.monitorVaultHealth(vaultObjectId);
      if (!health.needsLiquidation) {
        throw new Error('Vault does not need liquidation');
      }

      const tx = new TransactionBlock();

      const [record] = tx.moveCall({
        target: `${this.packageId}::liquidation_engine::execute_liquidation`,
        arguments: [
          tx.object(vaultObjectId),
          tx.object(priceFeedObjectId),
          tx.pure(liquidatorAddress),
          tx.object(this.clockObjectId),
        ],
      });

      // Transfer liquidation record to liquidator
      tx.transferObjects([record], tx.pure(liquidatorAddress));

      logger.info('Liquidation transaction prepared', {
        vaultId: vaultObjectId,
        ltv: health.ltv,
      });

      // In production, execute the transaction
      return {
        success: true,
        record: {
          vaultId: vaultObjectId,
          liquidator: liquidatorAddress,
          collateralSeizedUsd: 0, // Would be extracted from transaction result
          debtRepaidUsd: 0,
          penaltyAmountUsd: 0,
          excessReturnedUsd: 0,
          executedAt: Date.now(),
          ltvAtLiquidation: health.ltv,
        },
      };
    } catch (error) {
      logger.error('Failed to execute liquidation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vaultId: vaultObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate liquidation amounts
   */
  calculateLiquidationAmounts(
    collateralValueUsd: number,
    debtAmountUsd: number
  ): {
    collateralSeized: number;
    penalty: number;
    excess: number;
    totalToRepay: number;
  } {
    const penalty = (debtAmountUsd * LIQUIDATION_PENALTY_BPS) / 10000;
    const totalToRepay = debtAmountUsd + penalty;

    const collateralSeized = Math.min(totalToRepay, collateralValueUsd);
    const excess = Math.max(0, collateralValueUsd - totalToRepay);

    return {
      collateralSeized,
      penalty,
      excess,
      totalToRepay,
    };
  }

  /**
   * Add vault to liquidation queue
   */
  async queueForLiquidation(
    vaultObjectId: string,
    ltv: number,
    collateralValue: number
  ): Promise<void> {
    const entry: LiquidationQueueEntry = {
      vaultId: vaultObjectId,
      ltv,
      collateralValue,
      queuedAt: Date.now(),
      priority: ltv, // Higher LTV = higher priority
    };

    // Insert in priority order
    const insertIndex = this.liquidationQueue.findIndex(e => e.priority < entry.priority);
    if (insertIndex === -1) {
      this.liquidationQueue.push(entry);
    } else {
      this.liquidationQueue.splice(insertIndex, 0, entry);
    }

    logger.info('Vault queued for liquidation', {
      vaultId: vaultObjectId,
      ltv,
      priority: entry.priority,
      queuePosition: insertIndex === -1 ? this.liquidationQueue.length : insertIndex,
    });
  }

  /**
   * Remove vault from liquidation queue
   */
  removeFromQueue(vaultObjectId: string): void {
    const index = this.liquidationQueue.findIndex(e => e.vaultId === vaultObjectId);
    if (index !== -1) {
      this.liquidationQueue.splice(index, 1);
      logger.info('Vault removed from liquidation queue', {
        vaultId: vaultObjectId,
      });
    }
  }

  /**
   * Get next vault to liquidate
   */
  getNextLiquidation(): LiquidationQueueEntry | null {
    return this.liquidationQueue.length > 0 ? this.liquidationQueue[0] : null;
  }

  /**
   * Get liquidation queue
   */
  getLiquidationQueue(): LiquidationQueueEntry[] {
    return [...this.liquidationQueue];
  }

  /**
   * Start monitoring a vault for liquidation
   */
  startMonitoring(
    vaultObjectId: string,
    priceFeedObjectId: string,
    liquidatorAddress: string,
    checkIntervalMs: number = 60000 // Default: 1 minute
  ): void {
    // Stop existing monitoring if any
    this.stopMonitoring(vaultObjectId);

    logger.info('Starting vault liquidation monitoring', {
      vaultId: vaultObjectId,
      intervalMs: checkIntervalMs,
    });

    const interval = setInterval(async () => {
      try {
        const health = await this.vaultService.monitorVaultHealth(vaultObjectId);

        if (health.needsLiquidation) {
          logger.warn('Vault needs liquidation', {
            vaultId: vaultObjectId,
            ltv: health.ltv,
            healthFactor: health.healthFactor,
          });

          // Add to queue if not already there
          const inQueue = this.liquidationQueue.some(e => e.vaultId === vaultObjectId);
          if (!inQueue) {
            await this.queueForLiquidation(
              vaultObjectId,
              health.ltv,
              0 // Would get from vault info
            );
          }

          // Optionally auto-execute liquidation
          // await this.executeLiquidation(vaultObjectId, priceFeedObjectId, liquidatorAddress, liquidatorAddress);
        } else if (health.warningLevel > 0) {
          logger.warn('Vault health warning', {
            vaultId: vaultObjectId,
            ltv: health.ltv,
            warningLevel: health.warningLevel,
            message: health.message,
          });
        }
      } catch (error) {
        logger.error('Vault monitoring check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          vaultId: vaultObjectId,
        });
      }
    }, checkIntervalMs);

    this.monitoringIntervals.set(vaultObjectId, interval);
  }

  /**
   * Stop monitoring a vault
   */
  stopMonitoring(vaultObjectId: string): void {
    const interval = this.monitoringIntervals.get(vaultObjectId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(vaultObjectId);
      logger.info('Stopped vault monitoring', { vaultId: vaultObjectId });
    }
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const [vaultId, interval] of this.monitoringIntervals.entries()) {
      clearInterval(interval);
      logger.info('Stopped vault monitoring', { vaultId });
    }
    this.monitoringIntervals.clear();
  }

  /**
   * Process liquidation queue (execute top priority liquidations)
   */
  async processLiquidationQueue(
    priceFeedObjectId: string,
    liquidatorAddress: string,
    maxToProcess: number = 5
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    let processed = 0;
    let successful = 0;
    let failed = 0;

    logger.info('Processing liquidation queue', {
      queueSize: this.liquidationQueue.length,
      maxToProcess,
    });

    while (processed < maxToProcess && this.liquidationQueue.length > 0) {
      const entry = this.liquidationQueue[0];

      const result = await this.executeLiquidation(
        entry.vaultId,
        priceFeedObjectId,
        liquidatorAddress,
        liquidatorAddress
      );

      if (result.success) {
        successful++;
        this.removeFromQueue(entry.vaultId);
        this.stopMonitoring(entry.vaultId);
      } else {
        failed++;
        // Keep in queue but move to end
        this.liquidationQueue.shift();
        this.liquidationQueue.push(entry);
      }

      processed++;
    }

    logger.info('Liquidation queue processing complete', {
      processed,
      successful,
      failed,
      remainingInQueue: this.liquidationQueue.length,
    });

    return {
      processed,
      successful,
      failed,
    };
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    monitoredVaults: number;
    queuedLiquidations: number;
    vaults: string[];
  } {
    return {
      monitoredVaults: this.monitoringIntervals.size,
      queuedLiquidations: this.liquidationQueue.length,
      vaults: Array.from(this.monitoringIntervals.keys()),
    };
  }
}
