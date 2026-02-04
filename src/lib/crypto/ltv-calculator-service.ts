export interface LTVCalculationParams {
  collateralAmount: number;
  collateralPrice: number;
  collateralDecimals: number;
  loanAmount: number;
  accruedInterest?: number;
}

export interface HealthFactorResult {
  ltvRatio: number; // In basis points (10000 = 100%)
  healthFactor: number; // In basis points (10000 = 1.0, higher is better)
  collateralValue: number; // USD value
  totalDebt: number; // Including interest
  status: 'healthy' | 'warning' | 'critical' | 'liquidation';
  liquidationPrice: number; // Price at which liquidation occurs
  bufferAmount: number; // USD buffer before liquidation
}

export interface LTVThresholds {
  maxLtv: number; // Maximum allowed LTV (basis points)
  warningThreshold: number; // Warning threshold (basis points)
  liquidationThreshold: number; // Liquidation threshold (basis points)
  liquidationBonus: number; // Liquidation bonus (basis points)
}

export class LTVCalculatorService {
  // Default thresholds (can be overridden per asset)
  private readonly DEFAULT_THRESHOLDS: LTVThresholds = {
    maxLtv: 8000, // 80%
    warningThreshold: 7500, // 75%
    liquidationThreshold: 8500, // 85%
    liquidationBonus: 500 // 5%
  };

  // Asset-specific thresholds
  private readonly ASSET_THRESHOLDS: Record<string, LTVThresholds> = {
    'SUI': {
      maxLtv: 7500, // 75%
      warningThreshold: 7000, // 70%
      liquidationThreshold: 8000, // 80%
      liquidationBonus: 500 // 5%
    },
    'USDC': {
      maxLtv: 8500, // 85%
      warningThreshold: 8000, // 80%
      liquidationThreshold: 9000, // 90%
      liquidationBonus: 300 // 3%
    },
    'WETH': {
      maxLtv: 7500, // 75%
      warningThreshold: 7000, // 70%
      liquidationThreshold: 8000, // 80%
      liquidationBonus: 500 // 5%
    },
    'WBTC': {
      maxLtv: 7000, // 70%
      warningThreshold: 6500, // 65%
      liquidationThreshold: 7500, // 75%
      liquidationBonus: 500 // 5%
    }
  };

  /**
   * Calculate LTV ratio and health factor
   */
  calculateHealthFactor(params: LTVCalculationParams, assetType?: string): HealthFactorResult {
    const thresholds = this.getThresholds(assetType);
    
    // Calculate collateral value in USD
    const collateralValue = (params.collateralAmount / Math.pow(10, params.collateralDecimals)) * params.collateralPrice;
    
    // Calculate total debt including accrued interest
    const totalDebt = params.loanAmount + (params.accruedInterest || 0);
    
    // Calculate LTV ratio (in basis points)
    const ltvRatio = collateralValue > 0 ? Math.floor((totalDebt / collateralValue) * 10000) : 10000;
    
    // Calculate health factor (inverse of LTV ratio, scaled)
    const healthFactor = ltvRatio > 0 ? Math.floor((10000 * 10000) / ltvRatio) : 10000;
    
    // Determine status based on thresholds
    const status = this.determineHealthStatus(ltvRatio, thresholds);
    
    // Calculate liquidation price
    const liquidationPrice = this.calculateLiquidationPrice(
      params.collateralAmount,
      params.collateralDecimals,
      totalDebt,
      thresholds.liquidationThreshold
    );
    
    // Calculate buffer amount (USD value before liquidation)
    const liquidationValue = (totalDebt * 10000) / thresholds.liquidationThreshold;
    const bufferAmount = Math.max(0, collateralValue - liquidationValue);
    
    return {
      ltvRatio,
      healthFactor,
      collateralValue,
      totalDebt,
      status,
      liquidationPrice,
      bufferAmount
    };
  }

  /**
   * Calculate maximum borrowable amount for given collateral
   */
  calculateMaxBorrowAmount(
    collateralAmount: number,
    collateralPrice: number,
    collateralDecimals: number,
    assetType?: string
  ): number {
    const thresholds = this.getThresholds(assetType);
    const collateralValue = (collateralAmount / Math.pow(10, collateralDecimals)) * collateralPrice;
    
    return (collateralValue * thresholds.maxLtv) / 10000;
  }

  /**
   * Calculate required collateral for desired loan amount
   */
  calculateRequiredCollateral(
    loanAmount: number,
    collateralPrice: number,
    collateralDecimals: number,
    targetLtv: number,
    assetType?: string
  ): number {
    const thresholds = this.getThresholds(assetType);
    
    // Ensure target LTV doesn't exceed maximum
    const safeLtv = Math.min(targetLtv, thresholds.maxLtv);
    
    if (safeLtv === 0 || collateralPrice === 0) {
      return 0;
    }
    
    const requiredValue = (loanAmount * 10000) / safeLtv;
    return Math.ceil((requiredValue / collateralPrice) * Math.pow(10, collateralDecimals));
  }

  /**
   * Calculate liquidation price for collateral
   */
  calculateLiquidationPrice(
    collateralAmount: number,
    collateralDecimals: number,
    totalDebt: number,
    liquidationThreshold: number
  ): number {
    if (collateralAmount === 0) return 0;
    
    const collateralUnits = collateralAmount / Math.pow(10, collateralDecimals);
    return (totalDebt * liquidationThreshold) / (collateralUnits * 10000);
  }

  /**
   * Calculate maximum withdrawable collateral amount
   */
  calculateMaxWithdrawable(
    currentCollateralAmount: number,
    collateralPrice: number,
    collateralDecimals: number,
    totalDebt: number,
    assetType?: string
  ): number {
    if (totalDebt === 0) {
      return currentCollateralAmount; // Can withdraw all if no debt
    }
    
    const thresholds = this.getThresholds(assetType);
    
    // Calculate minimum required collateral value
    const minRequiredValue = (totalDebt * 10000) / thresholds.maxLtv;
    const minRequiredAmount = Math.ceil((minRequiredValue / collateralPrice) * Math.pow(10, collateralDecimals));
    
    return Math.max(0, currentCollateralAmount - minRequiredAmount);
  }

  /**
   * Calculate additional borrowing capacity
   */
  calculateAdditionalBorrowCapacity(
    collateralAmount: number,
    collateralPrice: number,
    collateralDecimals: number,
    currentDebt: number,
    assetType?: string
  ): number {
    const maxBorrowable = this.calculateMaxBorrowAmount(
      collateralAmount,
      collateralPrice,
      collateralDecimals,
      assetType
    );
    
    return Math.max(0, maxBorrowable - currentDebt);
  }

  /**
   * Simulate LTV change for various scenarios
   */
  simulateLTVChange(
    baseParams: LTVCalculationParams,
    scenarios: {
      priceChange?: number; // Percentage change in collateral price
      additionalCollateral?: number; // Additional collateral to deposit
      additionalDebt?: number; // Additional debt to take
      repayment?: number; // Debt repayment amount
    },
    assetType?: string
  ): HealthFactorResult {
    // Apply scenario changes
    const newPrice = baseParams.collateralPrice * (1 + (scenarios.priceChange || 0) / 100);
    const newCollateralAmount = baseParams.collateralAmount + (scenarios.additionalCollateral || 0);
    const newLoanAmount = baseParams.loanAmount + (scenarios.additionalDebt || 0) - (scenarios.repayment || 0);
    
    const newParams: LTVCalculationParams = {
      ...baseParams,
      collateralAmount: newCollateralAmount,
      collateralPrice: newPrice,
      loanAmount: Math.max(0, newLoanAmount)
    };
    
    return this.calculateHealthFactor(newParams, assetType);
  }

  /**
   * Calculate interest accrual impact on LTV
   */
  calculateInterestImpact(
    baseParams: LTVCalculationParams,
    annualInterestRate: number, // In basis points
    timeElapsedMs: number,
    assetType?: string
  ): HealthFactorResult {
    // Calculate accrued interest
    const timeElapsedYears = timeElapsedMs / (365 * 24 * 60 * 60 * 1000);
    const interestAccrued = baseParams.loanAmount * (annualInterestRate / 10000) * timeElapsedYears;
    
    const newParams: LTVCalculationParams = {
      ...baseParams,
      accruedInterest: (baseParams.accruedInterest || 0) + interestAccrued
    };
    
    return this.calculateHealthFactor(newParams, assetType);
  }

  /**
   * Get price alerts thresholds
   */
  getPriceAlerts(
    collateralAmount: number,
    collateralDecimals: number,
    totalDebt: number,
    currentPrice: number,
    assetType?: string
  ): {
    warningPrice: number;
    criticalPrice: number;
    liquidationPrice: number;
  } {
    const thresholds = this.getThresholds(assetType);
    const collateralUnits = collateralAmount / Math.pow(10, collateralDecimals);
    
    if (collateralUnits === 0) {
      return {
        warningPrice: 0,
        criticalPrice: 0,
        liquidationPrice: 0
      };
    }
    
    return {
      warningPrice: (totalDebt * thresholds.warningThreshold) / (collateralUnits * 10000),
      criticalPrice: (totalDebt * (thresholds.liquidationThreshold - 200)) / (collateralUnits * 10000), // 2% buffer
      liquidationPrice: (totalDebt * thresholds.liquidationThreshold) / (collateralUnits * 10000)
    };
  }

  /**
   * Validate LTV parameters
   */
  validateLTVParams(params: LTVCalculationParams, assetType?: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (params.collateralAmount < 0) {
      errors.push('Collateral amount cannot be negative');
    }
    
    if (params.collateralPrice <= 0) {
      errors.push('Collateral price must be positive');
    }
    
    if (params.loanAmount < 0) {
      errors.push('Loan amount cannot be negative');
    }
    
    if (params.collateralDecimals < 0 || params.collateralDecimals > 18) {
      errors.push('Invalid collateral decimals');
    }
    
    if (params.accruedInterest && params.accruedInterest < 0) {
      errors.push('Accrued interest cannot be negative');
    }
    
    // Check if LTV exceeds maximum for asset type
    if (params.collateralAmount > 0 && params.collateralPrice > 0) {
      const result = this.calculateHealthFactor(params, assetType);
      const thresholds = this.getThresholds(assetType);
      
      if (result.ltvRatio > thresholds.maxLtv) {
        errors.push(`LTV ratio ${result.ltvRatio / 100}% exceeds maximum ${thresholds.maxLtv / 100}%`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get thresholds for asset type
   */
  private getThresholds(assetType?: string): LTVThresholds {
    if (assetType && this.ASSET_THRESHOLDS[assetType]) {
      return this.ASSET_THRESHOLDS[assetType];
    }
    return this.DEFAULT_THRESHOLDS;
  }

  /**
   * Determine health status based on LTV ratio
   */
  private determineHealthStatus(ltvRatio: number, thresholds: LTVThresholds): 'healthy' | 'warning' | 'critical' | 'liquidation' {
    if (ltvRatio >= thresholds.liquidationThreshold) {
      return 'liquidation';
    } else if (ltvRatio >= thresholds.liquidationThreshold - 200) { // 2% buffer
      return 'critical';
    } else if (ltvRatio >= thresholds.warningThreshold) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get supported assets and their configurations
   */
  getSupportedAssets(): Record<string, LTVThresholds> {
    return { ...this.ASSET_THRESHOLDS };
  }

  /**
   * Update asset thresholds (admin function)
   */
  updateAssetThresholds(assetType: string, thresholds: LTVThresholds): void {
    // Validate thresholds
    if (thresholds.maxLtv >= thresholds.liquidationThreshold) {
      throw new Error('Max LTV must be less than liquidation threshold');
    }
    
    if (thresholds.warningThreshold >= thresholds.liquidationThreshold) {
      throw new Error('Warning threshold must be less than liquidation threshold');
    }
    
    this.ASSET_THRESHOLDS[assetType] = { ...thresholds };
  }
}