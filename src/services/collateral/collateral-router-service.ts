/**
 * Collateral Router Service
 * 
 * Routes loan requests between RWA and Crypto Collateral Engines based on asset type.
 * Maintains isolated risk management for each engine.
 * 
 * Requirements: 10.2
 */

export enum CollateralType {
  RWA = 'rwa',
  CRYPTO = 'crypto',
  MIXED = 'mixed'
}

export enum AssetType {
  // RWA Assets
  REAL_ESTATE = 'real_estate',
  VEHICLE = 'vehicle',
  EQUIPMENT = 'equipment',
  INVOICE = 'invoice',
  COMMODITY = 'commodity',
  
  // Crypto Assets
  SUI = 'sui',
  USDC = 'usdc',
  USDT = 'usdt',
  WETH = 'weth',
  WBTC = 'wbtc',
  OTHER_CRYPTO = 'other_crypto'
}

export interface CollateralAsset {
  assetId: string;
  assetType: AssetType;
  value: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface LoanRequest {
  requestId: string;
  userId: string;
  collateralAssets: CollateralAsset[];
  requestedAmount: number;
  currency: string;
  purpose?: string;
  timestamp: Date;
}

export interface RoutingDecision {
  requestId: string;
  collateralType: CollateralType;
  targetEngine: 'rwa' | 'crypto' | 'both';
  rwaAssets: CollateralAsset[];
  cryptoAssets: CollateralAsset[];
  riskAssessment: {
    rwaRisk?: RiskLevel;
    cryptoRisk?: RiskLevel;
    overallRisk: RiskLevel;
  };
  routingReason: string;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface EngineResponse {
  success: boolean;
  engineType: 'rwa' | 'crypto';
  loanId?: string;
  approvedAmount?: number;
  error?: string;
  processingTime: number;
}

export interface RouterMetrics {
  totalRequests: number;
  rwaRouted: number;
  cryptoRouted: number;
  mixedRouted: number;
  successRate: number;
  averageProcessingTime: number;
  engineHealth: {
    rwa: 'healthy' | 'degraded' | 'down';
    crypto: 'healthy' | 'degraded' | 'down';
  };
}

/**
 * Collateral Router Service
 * Routes loan requests to appropriate collateral engines
 */
export class CollateralRouterService {
  private static metrics: RouterMetrics = {
    totalRequests: 0,
    rwaRouted: 0,
    cryptoRouted: 0,
    mixedRouted: 0,
    successRate: 0,
    averageProcessingTime: 0,
    engineHealth: {
      rwa: 'healthy',
      crypto: 'healthy'
    }
  };

  /**
   * Route a loan request to the appropriate collateral engine(s)
   */
  static async routeLoanRequest(request: LoanRequest): Promise<RoutingDecision> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // 1. Detect asset types
      const collateralType = this.detectCollateralType(request.collateralAssets);
      
      // 2. Separate assets by type
      const { rwaAssets, cryptoAssets } = this.separateAssetsByType(request.collateralAssets);
      
      // 3. Assess risk for each engine
      const riskAssessment = await this.assessRisk(rwaAssets, cryptoAssets);
      
      // 4. Determine target engine
      const targetEngine = this.determineTargetEngine(collateralType, riskAssessment);
      
      // 5. Update metrics
      this.updateRoutingMetrics(collateralType, Date.now() - startTime);
      
      // 6. Create routing decision
      const decision: RoutingDecision = {
        requestId: request.requestId,
        collateralType,
        targetEngine,
        rwaAssets,
        cryptoAssets,
        riskAssessment,
        routingReason: this.generateRoutingReason(collateralType, targetEngine, riskAssessment)
      };
      
      return decision;
    } catch (error) {
      throw new Error(`Routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect the type of collateral in the request
   */
  private static detectCollateralType(assets: CollateralAsset[]): CollateralType {
    const hasRWA = assets.some(asset => this.isRWAAsset(asset.assetType));
    const hasCrypto = assets.some(asset => this.isCryptoAsset(asset.assetType));
    
    if (hasRWA && hasCrypto) {
      return CollateralType.MIXED;
    } else if (hasRWA) {
      return CollateralType.RWA;
    } else if (hasCrypto) {
      return CollateralType.CRYPTO;
    } else {
      throw new Error('Unknown collateral type');
    }
  }

  /**
   * Check if asset type is RWA
   */
  private static isRWAAsset(assetType: AssetType): boolean {
    return [
      AssetType.REAL_ESTATE,
      AssetType.VEHICLE,
      AssetType.EQUIPMENT,
      AssetType.INVOICE,
      AssetType.COMMODITY
    ].includes(assetType);
  }

  /**
   * Check if asset type is Crypto
   */
  private static isCryptoAsset(assetType: AssetType): boolean {
    return [
      AssetType.SUI,
      AssetType.USDC,
      AssetType.USDT,
      AssetType.WETH,
      AssetType.WBTC,
      AssetType.OTHER_CRYPTO
    ].includes(assetType);
  }

  /**
   * Separate assets into RWA and Crypto categories
   */
  private static separateAssetsByType(assets: CollateralAsset[]): {
    rwaAssets: CollateralAsset[];
    cryptoAssets: CollateralAsset[];
  } {
    const rwaAssets: CollateralAsset[] = [];
    const cryptoAssets: CollateralAsset[] = [];
    
    for (const asset of assets) {
      if (this.isRWAAsset(asset.assetType)) {
        rwaAssets.push(asset);
      } else if (this.isCryptoAsset(asset.assetType)) {
        cryptoAssets.push(asset);
      }
    }
    
    return { rwaAssets, cryptoAssets };
  }

  /**
   * Assess risk for RWA and Crypto assets
   */
  private static async assessRisk(
    rwaAssets: CollateralAsset[],
    cryptoAssets: CollateralAsset[]
  ): Promise<{
    rwaRisk?: RiskLevel;
    cryptoRisk?: RiskLevel;
    overallRisk: RiskLevel;
  }> {
    let rwaRisk: RiskLevel | undefined;
    let cryptoRisk: RiskLevel | undefined;
    
    // Assess RWA risk
    if (rwaAssets.length > 0) {
      rwaRisk = this.assessRWARisk(rwaAssets);
    }
    
    // Assess Crypto risk
    if (cryptoAssets.length > 0) {
      cryptoRisk = this.assessCryptoRisk(cryptoAssets);
    }
    
    // Determine overall risk (highest of the two)
    const overallRisk = this.determineOverallRisk(rwaRisk, cryptoRisk);
    
    return {
      rwaRisk,
      cryptoRisk,
      overallRisk
    };
  }

  /**
   * Assess risk for RWA assets
   */
  private static assessRWARisk(assets: CollateralAsset[]): RiskLevel {
    // Simplified risk assessment based on asset count and total value
    const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
    const assetCount = assets.length;
    
    // Risk factors:
    // - Low value assets are higher risk
    // - Multiple small assets are higher risk than one large asset
    // - Certain asset types have inherent risk
    
    if (totalValue < 10000 || assetCount > 5) {
      return RiskLevel.HIGH;
    } else if (totalValue < 50000 || assetCount > 3) {
      return RiskLevel.MEDIUM;
    } else {
      return RiskLevel.LOW;
    }
  }

  /**
   * Assess risk for Crypto assets
   */
  private static assessCryptoRisk(assets: CollateralAsset[]): RiskLevel {
    // Crypto risk is primarily based on volatility
    // Stablecoins (USDC, USDT) are low risk
    // Major cryptos (SUI, WETH, WBTC) are medium risk
    // Other cryptos are high risk
    
    const hasStablecoins = assets.some(a => 
      a.assetType === AssetType.USDC || a.assetType === AssetType.USDT
    );
    const hasMajorCrypto = assets.some(a => 
      a.assetType === AssetType.SUI || a.assetType === AssetType.WETH || a.assetType === AssetType.WBTC
    );
    const hasOtherCrypto = assets.some(a => a.assetType === AssetType.OTHER_CRYPTO);
    
    if (hasOtherCrypto) {
      return RiskLevel.HIGH;
    } else if (hasMajorCrypto) {
      return RiskLevel.MEDIUM;
    } else if (hasStablecoins) {
      return RiskLevel.LOW;
    } else {
      return RiskLevel.MEDIUM; // Default
    }
  }

  /**
   * Determine overall risk level
   */
  private static determineOverallRisk(
    rwaRisk?: RiskLevel,
    cryptoRisk?: RiskLevel
  ): RiskLevel {
    const riskLevels = [rwaRisk, cryptoRisk].filter(Boolean) as RiskLevel[];
    
    if (riskLevels.length === 0) {
      return RiskLevel.MEDIUM;
    }
    
    // Return the highest risk level
    if (riskLevels.includes(RiskLevel.CRITICAL)) return RiskLevel.CRITICAL;
    if (riskLevels.includes(RiskLevel.HIGH)) return RiskLevel.HIGH;
    if (riskLevels.includes(RiskLevel.MEDIUM)) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Determine which engine(s) should handle the request
   */
  private static determineTargetEngine(
    collateralType: CollateralType,
    riskAssessment: { rwaRisk?: RiskLevel; cryptoRisk?: RiskLevel; overallRisk: RiskLevel }
  ): 'rwa' | 'crypto' | 'both' {
    switch (collateralType) {
      case CollateralType.RWA:
        return 'rwa';
      case CollateralType.CRYPTO:
        return 'crypto';
      case CollateralType.MIXED:
        // For mixed collateral, route to both engines
        return 'both';
      default:
        throw new Error('Unknown collateral type');
    }
  }

  /**
   * Generate human-readable routing reason
   */
  private static generateRoutingReason(
    collateralType: CollateralType,
    targetEngine: 'rwa' | 'crypto' | 'both',
    riskAssessment: { rwaRisk?: RiskLevel; cryptoRisk?: RiskLevel; overallRisk: RiskLevel }
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`Collateral type: ${collateralType}`);
    reasons.push(`Target engine: ${targetEngine}`);
    reasons.push(`Overall risk: ${riskAssessment.overallRisk}`);
    
    if (riskAssessment.rwaRisk) {
      reasons.push(`RWA risk: ${riskAssessment.rwaRisk}`);
    }
    if (riskAssessment.cryptoRisk) {
      reasons.push(`Crypto risk: ${riskAssessment.cryptoRisk}`);
    }
    
    return reasons.join('; ');
  }

  /**
   * Update routing metrics
   */
  private static updateRoutingMetrics(collateralType: CollateralType, processingTime: number): void {
    switch (collateralType) {
      case CollateralType.RWA:
        this.metrics.rwaRouted++;
        break;
      case CollateralType.CRYPTO:
        this.metrics.cryptoRouted++;
        break;
      case CollateralType.MIXED:
        this.metrics.mixedRouted++;
        break;
    }
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalRequests;
  }

  /**
   * Process request through RWA engine
   */
  static async processRWARequest(
    request: LoanRequest,
    assets: CollateralAsset[]
  ): Promise<EngineResponse> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the actual RWA engine
      // For now, return a mock response
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        engineType: 'rwa',
        loanId: `rwa_loan_${Date.now()}`,
        approvedAmount: request.requestedAmount * 0.7, // 70% LTV for RWA
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        engineType: 'rwa',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process request through Crypto engine
   */
  static async processCryptoRequest(
    request: LoanRequest,
    assets: CollateralAsset[]
  ): Promise<EngineResponse> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the actual Crypto engine
      // For now, return a mock response
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        success: true,
        engineType: 'crypto',
        loanId: `crypto_loan_${Date.now()}`,
        approvedAmount: request.requestedAmount * 0.3, // 30% LTV for crypto
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        engineType: 'crypto',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute routing decision and process through appropriate engine(s)
   */
  static async executeRouting(
    request: LoanRequest,
    decision: RoutingDecision
  ): Promise<EngineResponse[]> {
    const responses: EngineResponse[] = [];
    
    switch (decision.targetEngine) {
      case 'rwa':
        responses.push(await this.processRWARequest(request, decision.rwaAssets));
        break;
      
      case 'crypto':
        responses.push(await this.processCryptoRequest(request, decision.cryptoAssets));
        break;
      
      case 'both':
        // Process both engines in parallel
        const [rwaResponse, cryptoResponse] = await Promise.all([
          this.processRWARequest(request, decision.rwaAssets),
          this.processCryptoRequest(request, decision.cryptoAssets)
        ]);
        responses.push(rwaResponse, cryptoResponse);
        break;
    }
    
    // Update success rate
    const successCount = responses.filter(r => r.success).length;
    this.metrics.successRate = (this.metrics.successRate * (this.metrics.totalRequests - 1) + 
      (successCount / responses.length)) / this.metrics.totalRequests;
    
    return responses;
  }

  /**
   * Get router metrics
   */
  static getMetrics(): RouterMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing)
   */
  static resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      rwaRouted: 0,
      cryptoRouted: 0,
      mixedRouted: 0,
      successRate: 0,
      averageProcessingTime: 0,
      engineHealth: {
        rwa: 'healthy',
        crypto: 'healthy'
      }
    };
  }

  /**
   * Check engine health
   */
  static async checkEngineHealth(): Promise<{
    rwa: 'healthy' | 'degraded' | 'down';
    crypto: 'healthy' | 'degraded' | 'down';
  }> {
    // This would perform actual health checks on the engines
    // For now, return the current status
    return { ...this.metrics.engineHealth };
  }

  /**
   * Update engine health status
   */
  static updateEngineHealth(
    engine: 'rwa' | 'crypto',
    status: 'healthy' | 'degraded' | 'down'
  ): void {
    this.metrics.engineHealth[engine] = status;
  }

  /**
   * Validate collateral assets
   */
  static validateCollateralAssets(assets: CollateralAsset[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (assets.length === 0) {
      errors.push('No collateral assets provided');
    }
    
    for (const asset of assets) {
      if (!asset.assetId) {
        errors.push('Asset missing ID');
      }
      if (!asset.assetType) {
        errors.push(`Asset ${asset.assetId} missing type`);
      }
      if (asset.value <= 0) {
        errors.push(`Asset ${asset.assetId} has invalid value`);
      }
      if (!asset.currency) {
        errors.push(`Asset ${asset.assetId} missing currency`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get routing recommendation without executing
   */
  static async getRoutingRecommendation(request: LoanRequest): Promise<{
    recommendation: RoutingDecision;
    estimatedApprovalAmount: number;
    estimatedProcessingTime: number;
  }> {
    const decision = await this.routeLoanRequest(request);
    
    // Estimate approval amount based on collateral type
    let estimatedApprovalAmount = 0;
    if (decision.rwaAssets.length > 0) {
      const rwaValue = decision.rwaAssets.reduce((sum, a) => sum + a.value, 0);
      estimatedApprovalAmount += rwaValue * 0.7; // 70% LTV for RWA
    }
    if (decision.cryptoAssets.length > 0) {
      const cryptoValue = decision.cryptoAssets.reduce((sum, a) => sum + a.value, 0);
      estimatedApprovalAmount += cryptoValue * 0.3; // 30% LTV for crypto
    }
    
    // Estimate processing time based on engine
    let estimatedProcessingTime = 0;
    if (decision.targetEngine === 'rwa' || decision.targetEngine === 'both') {
      estimatedProcessingTime += 100; // RWA takes longer
    }
    if (decision.targetEngine === 'crypto' || decision.targetEngine === 'both') {
      estimatedProcessingTime += 50; // Crypto is faster
    }
    
    return {
      recommendation: decision,
      estimatedApprovalAmount,
      estimatedProcessingTime
    };
  }
}
