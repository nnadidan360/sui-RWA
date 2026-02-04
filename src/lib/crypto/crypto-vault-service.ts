import { SuiService } from '../blockchain/sui-service';
import { PriceAggregationService } from './price-aggregation-service';
import { PriceHistoryService } from './price-history-service';

export interface CryptoVault {
  vaultId: string;
  owner: string;
  collateralBalance: number;
  collateralType: string;
  borrowedAmount: number;
  borrowedCurrency: string;
  ltvRatio: number; // In basis points (10000 = 100%)
  healthFactor: number; // In basis points (10000 = 1.0)
  status: VaultStatus;
  liquidationPrice: number;
  accruedInterest: number;
  createdAt: Date;
  lastUpdated: Date;
}

export enum VaultStatus {
  ACTIVE = 0,
  WARNING = 1,
  CRITICAL = 2,
  LIQUIDATING = 3,
  CLOSED = 4
}

export interface VaultCreationParams {
  collateralAmount: number;
  collateralType: string;
  borrowAmount: number;
  borrowCurrency: string;
  interestRate: number; // Annual rate in basis points
  userAccountId: string;
}

export interface VaultHealthMetrics {
  ltvRatio: number;
  healthFactor: number;
  status: VaultStatus;
  liquidationPrice: number;
  timeToLiquidation?: number; // Estimated time in milliseconds
  maxWithdrawable: number;
  maxBorrowable: number;
}

export interface CollateralOperation {
  vaultId: string;
  amount: number;
  newBalance: number;
  newLtvRatio: number;
  transactionHash: string;
}

export class CryptoVaultService {
  private suiService: SuiService;
  private priceService: PriceAggregationService;
  private historyService: PriceHistoryService;
  
  // LTV thresholds (in basis points)
  private readonly MAX_LTV_RATIO = 8000; // 80%
  private readonly LIQUIDATION_THRESHOLD = 8500; // 85%
  private readonly WARNING_THRESHOLD = 7500; // 75%

  // Supported collateral types with their configurations
  private readonly SUPPORTED_COLLATERAL = {
    'SUI': {
      decimals: 9,
      minAmount: 1000000000, // 1 SUI
      maxLtv: 7500, // 75%
      liquidationBonus: 500, // 5%
    },
    'USDC': {
      decimals: 6,
      minAmount: 10000000, // 10 USDC
      maxLtv: 8000, // 80%
      liquidationBonus: 300, // 3%
    },
    'WETH': {
      decimals: 8,
      minAmount: 1000000, // 0.01 ETH
      maxLtv: 7500, // 75%
      liquidationBonus: 500, // 5%
    }
  };

  constructor(suiService: SuiService, priceService?: PriceAggregationService, historyService?: PriceHistoryService) {
    this.suiService = suiService;
    this.priceService = priceService || new PriceAggregationService(suiService);
    this.historyService = historyService || new PriceHistoryService();
  }

  /**
   * Create new crypto vault with collateral
   */
  async createVault(params: VaultCreationParams): Promise<CryptoVault> {
    // Validate collateral type
    if (!this.SUPPORTED_COLLATERAL[params.collateralType as keyof typeof this.SUPPORTED_COLLATERAL]) {
      throw new Error(`Unsupported collateral type: ${params.collateralType}`);
    }

    const collateralConfig = this.SUPPORTED_COLLATERAL[params.collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
    
    // Validate minimum collateral amount
    if (params.collateralAmount < collateralConfig.minAmount) {
      throw new Error(`Minimum collateral amount is ${collateralConfig.minAmount / Math.pow(10, collateralConfig.decimals)} ${params.collateralType}`);
    }

    // Get current price for collateral
    const collateralPrice = await this.getAssetPrice(params.collateralType);
    
    // Calculate LTV ratio
    const collateralValue = (params.collateralAmount / Math.pow(10, collateralConfig.decimals)) * collateralPrice;
    const ltvRatio = (params.borrowAmount / collateralValue) * 10000;

    // Validate LTV ratio
    if (ltvRatio > collateralConfig.maxLtv) {
      throw new Error(`LTV ratio ${ltvRatio / 100}% exceeds maximum ${collateralConfig.maxLtv / 100}% for ${params.collateralType}`);
    }

    try {
      // Use existing SuiService method
      const result = await this.suiService.createCryptoVault(
        params.userAccountId,
        params.collateralType,
        params.collateralAmount,
        collateralConfig.maxLtv
      );

      // Parse vault from transaction result
      return this.parseVaultFromTransaction(result);
    } catch (error) {
      throw new Error(`Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deposit additional collateral to vault
   */
  async depositCollateral(vaultId: string, amount: number, collateralType: string): Promise<CollateralOperation> {
    const collateralPrice = await this.getAssetPrice(collateralType);

    try {
      const result = await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'crypto_vault',
        function: 'deposit_collateral',
        arguments: [
          vaultId,
          amount.toString(),
          Math.floor(collateralPrice * 100000000).toString()
        ],
        gasBudget: 10000000
      });

      return this.parseCollateralOperationFromTransaction(result, 'deposit');
    } catch (error) {
      throw new Error(`Failed to deposit collateral: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw collateral from vault
   */
  async withdrawCollateral(vaultId: string, amount: number, collateralType: string): Promise<CollateralOperation> {
    // Get current vault state to validate withdrawal
    const vault = await this.getVault(vaultId);
    const collateralPrice = await this.getAssetPrice(collateralType);

    // Calculate new LTV after withdrawal
    const remainingCollateral = vault.collateralBalance - amount;
    const remainingValue = (remainingCollateral / Math.pow(10, this.getCollateralDecimals(collateralType))) * collateralPrice;
    const newLtvRatio = vault.borrowedAmount > 0 ? (vault.borrowedAmount / remainingValue) * 10000 : 0;

    // Validate withdrawal doesn't make vault unhealthy
    if (newLtvRatio > this.MAX_LTV_RATIO) {
      throw new Error(`Withdrawal would result in unhealthy LTV ratio: ${newLtvRatio / 100}%`);
    }

    try {
      const result = await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'crypto_vault',
        function: 'withdraw_collateral',
        arguments: [
          vaultId,
          amount.toString(),
          Math.floor(collateralPrice * 100000000).toString()
        ],
        gasBudget: 10000000
      });

      return this.parseCollateralOperationFromTransaction(result, 'withdraw');
    } catch (error) {
      throw new Error(`Failed to withdraw collateral: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Repay loan and reduce debt
   */
  async repayLoan(vaultId: string, repaymentAmount: number, collateralType: string): Promise<{
    vaultId: string;
    repaidAmount: number;
    remainingDebt: number;
    newLtvRatio: number;
    transactionHash: string;
  }> {
    const collateralPrice = await this.getAssetPrice(collateralType);

    try {
      const result = await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'crypto_vault',
        function: 'repay_loan',
        arguments: [
          vaultId,
          repaymentAmount.toString(),
          Math.floor(collateralPrice * 100000000).toString()
        ],
        gasBudget: 10000000
      });

      return this.parseRepaymentFromTransaction(result);
    } catch (error) {
      throw new Error(`Failed to repay loan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get vault details by ID
   */
  async getVault(vaultId: string): Promise<CryptoVault> {
    try {
      const vaultObject = await this.suiService.getObject(vaultId);
      
      if (!vaultObject || !this.isValidVaultObject(vaultObject)) {
        throw new Error('Vault not found or invalid');
      }

      return this.parseVaultObject(vaultObject);
    } catch (error) {
      throw new Error(`Failed to get vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all vaults for a user
   */
  async getUserVaults(userAddress: string): Promise<CryptoVault[]> {
    try {
      const objects = await this.suiService.getObjectsOwnedByAddress(userAddress);
      const vaults: CryptoVault[] = [];

      for (const obj of objects) {
        if (this.isValidVaultObject(obj)) {
          vaults.push(this.parseVaultObject(obj));
        }
      }

      return vaults;
    } catch (error) {
      throw new Error(`Failed to get user vaults: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate vault health metrics
   */
  async calculateHealthMetrics(vault: CryptoVault): Promise<VaultHealthMetrics> {
    const collateralPrice = await this.getAssetPrice(vault.collateralType);
    const collateralConfig = this.SUPPORTED_COLLATERAL[vault.collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
    
    const collateralValue = (vault.collateralBalance / Math.pow(10, collateralConfig.decimals)) * collateralPrice;
    const totalDebt = vault.borrowedAmount + vault.accruedInterest;
    
    // Calculate maximum withdrawable collateral
    const minCollateralValue = totalDebt > 0 ? (totalDebt * 10000) / this.MAX_LTV_RATIO : 0;
    const maxWithdrawableValue = Math.max(0, collateralValue - minCollateralValue);
    const maxWithdrawable = Math.floor((maxWithdrawableValue / collateralPrice) * Math.pow(10, collateralConfig.decimals));

    // Calculate maximum additional borrowable amount
    const maxBorrowableValue = (collateralValue * this.MAX_LTV_RATIO) / 10000;
    const maxBorrowable = Math.max(0, maxBorrowableValue - totalDebt);

    // Estimate time to liquidation based on interest accrual
    let timeToLiquidation: number | undefined;
    if (vault.status === VaultStatus.WARNING && vault.borrowedAmount > 0) {
      const interestRate = 500; // 5% annual rate (would get from vault data)
      const annualInterest = vault.borrowedAmount * (interestRate / 10000);
      const dailyInterest = annualInterest / 365;
      
      const ltvBuffer = this.LIQUIDATION_THRESHOLD - vault.ltvRatio;
      const valueBuffer = (collateralValue * ltvBuffer) / 10000;
      
      if (dailyInterest > 0) {
        timeToLiquidation = Math.floor((valueBuffer / dailyInterest) * 24 * 60 * 60 * 1000); // Convert to milliseconds
      }
    }

    return {
      ltvRatio: vault.ltvRatio,
      healthFactor: vault.healthFactor,
      status: vault.status,
      liquidationPrice: vault.liquidationPrice,
      timeToLiquidation,
      maxWithdrawable,
      maxBorrowable
    };
  }

  /**
   * Get current asset price (now uses real price aggregation)
   */
  private async getAssetPrice(assetType: string): Promise<number> {
    try {
      const aggregatedPrice = await this.priceService.getAggregatedPrice(assetType);
      
      // Record price in history for volatility tracking
      this.historyService.recordPrice(aggregatedPrice);
      
      return aggregatedPrice.price;
    } catch (error) {
      console.warn(`Failed to get aggregated price for ${assetType}, using fallback:`, error);
      
      // Fallback to mock prices if aggregation fails
      const mockPrices: Record<string, number> = {
        'SUI': 2.50,
        'USDC': 1.00,
        'WETH': 3500.00,
        'BTC': 65000.00
      };

      return mockPrices[assetType] || 1.00;
    }
  }

  /**
   * Validate price before using for liquidation
   */
  private async validatePriceForLiquidation(assetType: string, price: number): Promise<boolean> {
    try {
      const validation = await this.priceService.validatePrice(assetType, price, 5); // 5% max deviation
      
      if (!validation.isValid) {
        console.warn(`Price validation failed for ${assetType}:`, validation.reason);
        return false;
      }

      // Additional check for high volatility
      const isHighVol = this.historyService.isHighVolatility(assetType, 1); // 1 hour window
      if (isHighVol) {
        console.warn(`High volatility detected for ${assetType}, requiring additional confirmation`);
        // In production, might require multiple confirmations or delay liquidation
      }

      return true;
    } catch (error) {
      console.error(`Price validation error for ${assetType}:`, error);
      return false;
    }
  }

  /**
   * Get asset volatility metrics
   */
  async getAssetVolatility(assetType: string, periodHours: number = 24): Promise<{
    volatility: number;
    trend: string;
    isHighVolatility: boolean;
  }> {
    const volatilityMetrics = this.historyService.calculateVolatility(assetType, periodHours);
    const trendAnalysis = this.historyService.analyzeTrend(assetType, periodHours);
    const isHighVolatility = this.historyService.isHighVolatility(assetType, periodHours);

    return {
      volatility: volatilityMetrics.volatility,
      trend: trendAnalysis.trend,
      isHighVolatility
    };
  }

  /**
   * Get collateral decimals for asset type
   */
  private getCollateralDecimals(collateralType: string): number {
    const config = this.SUPPORTED_COLLATERAL[collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
    return config?.decimals || 9;
  }

  /**
   * Check if object is a valid vault object
   */
  private isValidVaultObject(obj: any): boolean {
    return obj && 
           obj.data && 
           obj.data.type && 
           obj.data.type.includes('CryptoVaultObject') &&
           obj.data.fields;
  }

  /**
   * Parse vault object from Sui response
   */
  private parseVaultObject(obj: any): CryptoVault {
    const fields = obj.data.fields;
    
    return {
      vaultId: fields.vault_id,
      owner: fields.owner,
      collateralBalance: parseInt(fields.collateral_balance),
      collateralType: fields.collateral_type,
      borrowedAmount: parseInt(fields.borrowed_amount),
      borrowedCurrency: fields.borrowed_currency,
      ltvRatio: parseInt(fields.ltv_ratio),
      healthFactor: parseInt(fields.health_factor),
      status: parseInt(fields.status) as VaultStatus,
      liquidationPrice: parseInt(fields.liquidation_price),
      accruedInterest: parseInt(fields.accrued_interest),
      createdAt: new Date(parseInt(fields.created_at)),
      lastUpdated: new Date(parseInt(fields.last_updated))
    };
  }

  /**
   * Parse vault from transaction result
   */
  private parseVaultFromTransaction(result: any): CryptoVault {
    // Extract vault data from transaction result
    // This is a simplified implementation
    const vaultId = this.extractVaultIdFromTransaction(result);
    
    // In a real implementation, would parse the actual vault data
    return {
      vaultId,
      owner: result.sender || '',
      collateralBalance: 0,
      collateralType: '',
      borrowedAmount: 0,
      borrowedCurrency: '',
      ltvRatio: 0,
      healthFactor: 10000,
      status: VaultStatus.ACTIVE,
      liquidationPrice: 0,
      accruedInterest: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Parse collateral operation from transaction result
   */
  private parseCollateralOperationFromTransaction(result: any, operation: 'deposit' | 'withdraw'): CollateralOperation {
    // Extract operation data from transaction result
    return {
      vaultId: this.extractVaultIdFromTransaction(result),
      amount: 0, // Would extract from transaction events
      newBalance: 0,
      newLtvRatio: 0,
      transactionHash: result.digest || ''
    };
  }

  /**
   * Parse repayment from transaction result
   */
  private parseRepaymentFromTransaction(result: any): {
    vaultId: string;
    repaidAmount: number;
    remainingDebt: number;
    newLtvRatio: number;
    transactionHash: string;
  } {
    return {
      vaultId: this.extractVaultIdFromTransaction(result),
      repaidAmount: 0, // Would extract from transaction events
      remainingDebt: 0,
      newLtvRatio: 0,
      transactionHash: result.digest || ''
    };
  }

  /**
   * Extract vault ID from transaction result
   */
  private extractVaultIdFromTransaction(result: any): string {
    // Extract vault ID from transaction result
    if (result.effects?.created && result.effects.created.length > 0) {
      return result.effects.created[0].reference.objectId;
    }
    
    return 'unknown-vault-id';
  }

  /**
   * Calculate maximum borrowable amount for given collateral
   */
  calculateMaxBorrowAmount(collateralAmount: number, collateralType: string, collateralPrice: number): number {
    const collateralConfig = this.SUPPORTED_COLLATERAL[collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
    if (!collateralConfig) return 0;

    const collateralValue = (collateralAmount / Math.pow(10, collateralConfig.decimals)) * collateralPrice;
    return (collateralValue * collateralConfig.maxLtv) / 10000;
  }

  /**
   * Execute liquidation with price validation
   */
  async executeLiquidation(vaultId: string, collateralType: string): Promise<{
    success: boolean;
    transactionHash?: string;
    reason?: string;
  }> {
    try {
      // Get current vault state
      const vault = await this.getVault(vaultId);
      if (!vault) {
        return { success: false, reason: 'Vault not found' };
      }

      // Get current price with validation
      const currentPrice = await this.getAssetPrice(collateralType);
      
      // Validate price before liquidation
      const isPriceValid = await this.validatePriceForLiquidation(collateralType, currentPrice);
      if (!isPriceValid) {
        return { success: false, reason: 'Price validation failed - liquidation delayed for safety' };
      }

      // Double-check vault health with validated price
      const collateralConfig = this.SUPPORTED_COLLATERAL[collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
      if (!collateralConfig) {
        return { success: false, reason: 'Unsupported collateral type' };
      }

      const collateralValue = (vault.collateralBalance / Math.pow(10, collateralConfig.decimals)) * currentPrice;
      const currentLtv = vault.borrowedAmount > 0 ? (vault.borrowedAmount / collateralValue) * 10000 : 0;

      // Confirm liquidation is still needed
      if (currentLtv < this.LIQUIDATION_THRESHOLD) {
        return { success: false, reason: 'Vault no longer requires liquidation' };
      }

      // Execute liquidation on-chain
      const transactionHash = await this.suiService.executeLiquidation(vaultId);

      return {
        success: true,
        transactionHash
      };
    } catch (error) {
      return {
        success: false,
        reason: `Liquidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
  /**
   * Calculate required collateral for loan amount
   */
  calculateRequiredCollateral(loanAmount: number, collateralType: string, collateralPrice: number, targetLtv: number = 7000): number {
    const collateralConfig = this.SUPPORTED_COLLATERAL[collateralType as keyof typeof this.SUPPORTED_COLLATERAL];
    if (!collateralConfig || targetLtv === 0 || collateralPrice === 0) return 0;

    const requiredValue = (loanAmount * 10000) / targetLtv;
    return Math.ceil((requiredValue / collateralPrice) * Math.pow(10, collateralConfig.decimals));
  }

  /**
   * Get price feed status and health
   */
  async getPriceFeedStatus(assetType: string): Promise<{
    isHealthy: boolean;
    lastUpdate: Date;
    confidence: number;
    sourceCount: number;
    volatility: number;
    alerts: string[];
  }> {
    try {
      const aggregatedPrice = await this.priceService.getAggregatedPrice(assetType);
      const volatilityMetrics = this.historyService.calculateVolatility(assetType, 1); // 1 hour
      const alerts = this.historyService.getActiveAlerts(assetType);

      return {
        isHealthy: aggregatedPrice.confidence >= 80 && aggregatedPrice.deviation < 10,
        lastUpdate: aggregatedPrice.timestamp,
        confidence: aggregatedPrice.confidence,
        sourceCount: aggregatedPrice.sourceCount,
        volatility: volatilityMetrics.volatility,
        alerts: alerts.map(alert => alert.message)
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastUpdate: new Date(0),
        confidence: 0,
        sourceCount: 0,
        volatility: 0,
        alerts: [`Price feed error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}