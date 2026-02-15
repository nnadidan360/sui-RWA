import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { PriceAggregationService, AssetSymbol } from './price-aggregation-service';
import logger from '../../utils/logger';

/**
 * Vault health status
 */
export enum VaultStatus {
  ACTIVE = 0,
  WARNING = 1,
  CRITICAL = 2,
  LIQUIDATING = 3,
  LIQUIDATED = 4,
}

/**
 * Collateral asset in vault
 */
export interface CollateralAsset {
  assetType: string;
  amount: number;
  valueUsd: number;
  depositedAt: number;
  lastValuation: number;
}

/**
 * Vault information
 */
export interface VaultInfo {
  vaultId: string;
  ownerAccountId: string;
  collateralAssets: CollateralAsset[];
  totalCollateralValueUsd: number;
  borrowedAmountUsd: number;
  currentLtv: number; // In basis points (10000 = 100%)
  healthFactor: number; // In basis points (10000 = 100%)
  status: VaultStatus;
  createdAt: number;
  lastUpdated: number;
}

/**
 * LTV thresholds
 */
export const LTV_THRESHOLDS = {
  LIQUIDATION: 8000, // 80%
  WARNING_1: 6500, // 65%
  WARNING_2: 7000, // 70%
  WARNING_3: 7500, // 75%
};

/**
 * Service for managing crypto vaults
 */
export class CryptoVaultService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;
  private priceService: PriceAggregationService;

  constructor(
    suiClient: SuiClient,
    packageId: string,
    priceService: PriceAggregationService,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.priceService = priceService;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Create a new crypto vault
   */
  async createVault(
    ownerAccountId: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    vaultId?: string;
    error?: string;
  }> {
    try {
      logger.info('Creating crypto vault', {
        ownerAccountId,
      });

      const tx = new TransactionBlock();

      const [vault] = tx.moveCall({
        target: `${this.packageId}::crypto_vault::create_vault`,
        arguments: [
          tx.pure(ownerAccountId),
          tx.object(this.clockObjectId),
        ],
      });

      tx.transferObjects([vault], tx.pure(signerAddress));

      logger.info('Vault creation transaction prepared', {
        ownerAccountId,
      });

      return {
        success: true,
        vaultId: 'pending',
      };
    } catch (error) {
      logger.error('Failed to create vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerAccountId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deposit collateral into vault
   */
  async depositCollateral(
    vaultObjectId: string,
    assetSymbol: AssetSymbol,
    amount: number,
    signerAddress: string
  ): Promise<{
    success: boolean;
    valueUsd?: number;
    newLtv?: number;
    error?: string;
  }> {
    try {
      logger.info('Depositing collateral', {
        vaultId: vaultObjectId,
        asset: assetSymbol,
        amount,
      });

      // Get current price
      const price = await this.priceService.getCurrentPrice(assetSymbol);
      const valueUsd = amount * price;
      const valueUsdCents = Math.round(valueUsd * 100); // Convert to cents

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::crypto_vault::deposit_collateral`,
        arguments: [
          tx.object(vaultObjectId),
          tx.pure(assetSymbol),
          tx.pure(Math.round(amount * 1e8)), // Convert to smallest unit
          tx.pure(valueUsdCents),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Deposit transaction prepared', {
        vaultId: vaultObjectId,
        valueUsd,
      });

      return {
        success: true,
        valueUsd,
      };
    } catch (error) {
      logger.error('Failed to deposit collateral', {
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
   * Update borrowed amount (when loan is taken or repaid)
   */
  async updateBorrowedAmount(
    vaultObjectId: string,
    newBorrowedAmountUsd: number,
    signerAddress: string
  ): Promise<{
    success: boolean;
    newLtv?: number;
    healthFactor?: number;
    error?: string;
  }> {
    try {
      logger.info('Updating borrowed amount', {
        vaultId: vaultObjectId,
        newAmount: newBorrowedAmountUsd,
      });

      const borrowedAmountCents = Math.round(newBorrowedAmountUsd * 100);

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::crypto_vault::update_borrowed_amount`,
        arguments: [
          tx.object(vaultObjectId),
          tx.pure(borrowedAmountCents),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Update borrowed amount transaction prepared', {
        vaultId: vaultObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to update borrowed amount', {
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
   * Update collateral values based on current prices
   */
  async updateCollateralValues(
    vaultObjectId: string,
    assetSymbol: AssetSymbol,
    signerAddress: string
  ): Promise<{
    success: boolean;
    newValueUsd?: number;
    newLtv?: number;
    error?: string;
  }> {
    try {
      logger.info('Updating collateral values', {
        vaultId: vaultObjectId,
        asset: assetSymbol,
      });

      // Get current price
      const aggregated = await this.priceService.aggregatePrice(assetSymbol);
      
      // For now, we need to know the amount to calculate value
      // In production, query the vault to get current amount
      // This is a simplified version
      const newValueUsdCents = Math.round(aggregated.price * 100);

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::crypto_vault::update_collateral_values`,
        arguments: [
          tx.object(vaultObjectId),
          tx.pure(assetSymbol),
          tx.pure(newValueUsdCents),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Update collateral values transaction prepared', {
        vaultId: vaultObjectId,
        newPrice: aggregated.price,
      });

      return {
        success: true,
        newValueUsd: aggregated.price,
      };
    } catch (error) {
      logger.error('Failed to update collateral values', {
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
   * Calculate LTV for a vault
   */
  calculateLTV(collateralValueUsd: number, borrowedAmountUsd: number): number {
    if (collateralValueUsd === 0) return 0;
    return Math.round((borrowedAmountUsd / collateralValueUsd) * 10000);
  }

  /**
   * Calculate health factor
   */
  calculateHealthFactor(ltv: number): number {
    return Math.max(0, 10000 - ltv);
  }

  /**
   * Check if vault needs liquidation
   */
  needsLiquidation(ltv: number): boolean {
    return ltv >= LTV_THRESHOLDS.LIQUIDATION;
  }

  /**
   * Get vault status based on LTV
   */
  getVaultStatus(ltv: number): VaultStatus {
    if (ltv >= LTV_THRESHOLDS.LIQUIDATION) {
      return VaultStatus.CRITICAL;
    } else if (ltv >= LTV_THRESHOLDS.WARNING_3) {
      return VaultStatus.WARNING;
    } else {
      return VaultStatus.ACTIVE;
    }
  }

  /**
   * Get warning level for alerts
   */
  getWarningLevel(ltv: number): number {
    if (ltv >= LTV_THRESHOLDS.WARNING_3) return 3;
    if (ltv >= LTV_THRESHOLDS.WARNING_2) return 2;
    if (ltv >= LTV_THRESHOLDS.WARNING_1) return 1;
    return 0;
  }

  /**
   * Query vault information from blockchain
   */
  async getVaultInfo(vaultObjectId: string): Promise<VaultInfo | null> {
    try {
      const vaultObject = await this.suiClient.getObject({
        id: vaultObjectId,
        options: {
          showContent: true,
        },
      });

      if (!vaultObject.data || !vaultObject.data.content) {
        return null;
      }

      // Parse vault data from on-chain object
      // In production, properly parse the Move object structure
      // This is a placeholder
      return null;
    } catch (error) {
      logger.error('Failed to get vault info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vaultId: vaultObjectId,
      });
      return null;
    }
  }

  /**
   * Monitor vault health and return alert level
   */
  async monitorVaultHealth(vaultObjectId: string): Promise<{
    healthy: boolean;
    ltv: number;
    healthFactor: number;
    warningLevel: number;
    needsLiquidation: boolean;
    message: string;
  }> {
    try {
      const vaultInfo = await this.getVaultInfo(vaultObjectId);

      if (!vaultInfo) {
        return {
          healthy: false,
          ltv: 0,
          healthFactor: 0,
          warningLevel: 0,
          needsLiquidation: false,
          message: 'Vault not found',
        };
      }

      const ltv = vaultInfo.currentLtv;
      const healthFactor = vaultInfo.healthFactor;
      const warningLevel = this.getWarningLevel(ltv);
      const needsLiquidation = this.needsLiquidation(ltv);

      let message = 'Vault is healthy';
      if (needsLiquidation) {
        message = 'CRITICAL: Vault needs liquidation';
      } else if (warningLevel === 3) {
        message = 'WARNING: LTV at 75%, approaching liquidation';
      } else if (warningLevel === 2) {
        message = 'WARNING: LTV at 70%';
      } else if (warningLevel === 1) {
        message = 'NOTICE: LTV at 65%';
      }

      return {
        healthy: healthFactor >= 5000 && !needsLiquidation,
        ltv,
        healthFactor,
        warningLevel,
        needsLiquidation,
        message,
      };
    } catch (error) {
      logger.error('Failed to monitor vault health', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vaultId: vaultObjectId,
      });

      return {
        healthy: false,
        ltv: 0,
        healthFactor: 0,
        warningLevel: 0,
        needsLiquidation: false,
        message: 'Error monitoring vault',
      };
    }
  }
}
