/**
 * Asset Valuation Service
 * 
 * This service handles asset valuation updates, market data integration,
 * and automated revaluation triggers for the Astake protocol.
 */

import { AssetType } from '../contracts/asset-token';
import { UserRole, User } from '../../types/auth';
import { AccessControl } from '../auth/access-control';

export interface ValuationData {
  assetId: string;
  currentValue: number;
  currency: string;
  valuationDate: Date;
  appraiser: string;
  methodology: string;
  confidence: 'high' | 'medium' | 'low';
  marketFactors: MarketFactor[];
  comparables?: ComparableAsset[];
}

export interface MarketFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number; // Percentage impact
  description: string;
}

export interface ComparableAsset {
  location: string;
  assetType: string;
  size: number;
  salePrice: number;
  saleDate: Date;
  adjustments: number;
}

export interface ValuationTrigger {
  triggerId: string;
  assetId: string;
  triggerType: 'time_based' | 'market_change' | 'manual' | 'loan_event';
  frequency?: number; // Days for time-based triggers
  threshold?: number; // Percentage for market change triggers
  lastTriggered: Date;
  nextScheduled?: Date;
  isActive: boolean;
}

export interface ValuationHistory {
  assetId: string;
  valuations: Array<{
    value: number;
    date: Date;
    appraiser: string;
    methodology: string;
    changePercentage?: number;
  }>;
}

export class AssetValuationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AssetValuationError';
  }
}

/**
 * Asset Valuation Service Implementation
 * 
 * Manages asset valuations, market data, and automated revaluation processes
 */
export class AssetValuationService {
  private valuations: Map<string, ValuationData> = new Map();
  private triggers: Map<string, ValuationTrigger> = new Map();
  private history: Map<string, ValuationHistory> = new Map();
  private userRegistry: Map<string, User> = new Map();
  private marketData: Map<string, number> = new Map(); // Mock market data

  constructor() {
    this.initializeMockUsers();
    this.initializeMockMarketData();
  }

  /**
   * Register a user for testing purposes
   */
  registerUser(address: string, role: UserRole): void {
    const user: User = {
      id: `user_${address}`,
      address,
      role,
      isActive: true,
      createdAt: new Date(),
    };
    this.userRegistry.set(address, user);
  }

  /**
   * Get user by address
   */
  private getUser(address: string): User | null {
    return this.userRegistry.get(address) || null;
  }

  /**
   * Create initial valuation for an asset
   */
  async createInitialValuation(
    assetId: string,
    assetType: AssetType,
    initialValue: number,
    appraiser: string,
    methodology: string,
    caller: string
  ): Promise<ValuationData> {
    const user = this.getUser(caller);
    
    // Check caller permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetValuationError('UNAUTHORIZED', 'Only verifiers can create valuations');
    }

    // Validate valuation amount
    this.validateValuationAmount(initialValue);

    // Create valuation data
    const valuation: ValuationData = {
      assetId,
      currentValue: initialValue,
      currency: 'USD',
      valuationDate: new Date(),
      appraiser,
      methodology,
      confidence: 'high',
      marketFactors: this.generateMarketFactors(assetType),
    };

    // Store valuation
    this.valuations.set(assetId, valuation);

    // Initialize valuation history
    this.history.set(assetId, {
      assetId,
      valuations: [{
        value: initialValue,
        date: new Date(),
        appraiser,
        methodology,
      }],
    });

    // Set up automatic revaluation triggers
    await this.setupRevaluationTriggers(assetId, assetType);

    return valuation;
  }

  /**
   * Update asset valuation
   */
  async updateValuation(
    assetId: string,
    newValue: number,
    appraiser: string,
    methodology: string,
    marketFactors: MarketFactor[],
    caller: string
  ): Promise<ValuationData> {
    const user = this.getUser(caller);
    
    // Check caller permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new AssetValuationError('UNAUTHORIZED', 'Only verifiers can update valuations');
    }

    // Get existing valuation
    const existingValuation = this.valuations.get(assetId);
    if (!existingValuation) {
      throw new AssetValuationError('VALUATION_NOT_FOUND', `Valuation for asset ${assetId} not found`);
    }

    // Validate new valuation
    this.validateValuationAmount(newValue);
    this.validateValuationChange(existingValuation.currentValue, newValue);

    // Calculate change percentage
    const changePercentage = ((newValue - existingValuation.currentValue) / existingValuation.currentValue) * 100;

    // Update valuation
    const updatedValuation: ValuationData = {
      ...existingValuation,
      currentValue: newValue,
      valuationDate: new Date(),
      appraiser,
      methodology,
      marketFactors,
      confidence: this.calculateConfidence(marketFactors, Math.abs(changePercentage)),
    };

    this.valuations.set(assetId, updatedValuation);

    // Update history
    const history = this.history.get(assetId);
    if (history) {
      history.valuations.push({
        value: newValue,
        date: new Date(),
        appraiser,
        methodology,
        changePercentage,
      });
      this.history.set(assetId, history);
    }

    return updatedValuation;
  }

  /**
   * Get current valuation for an asset
   */
  async getValuation(assetId: string): Promise<ValuationData | null> {
    return this.valuations.get(assetId) || null;
  }

  /**
   * Get valuation history for an asset
   */
  async getValuationHistory(assetId: string): Promise<ValuationHistory | null> {
    return this.history.get(assetId) || null;
  }

  /**
   * Set up automatic revaluation triggers
   */
  async setupRevaluationTriggers(assetId: string, assetType: AssetType): Promise<void> {
    // Time-based trigger (quarterly for real estate, monthly for commodities)
    const timeBasedFrequency = assetType === AssetType.RealEstate ? 90 : 30; // days
    
    const timeBasedTrigger: ValuationTrigger = {
      triggerId: `time_${assetId}`,
      assetId,
      triggerType: 'time_based',
      frequency: timeBasedFrequency,
      lastTriggered: new Date(),
      nextScheduled: new Date(Date.now() + timeBasedFrequency * 24 * 60 * 60 * 1000),
      isActive: true,
    };

    this.triggers.set(timeBasedTrigger.triggerId, timeBasedTrigger);

    // Market change trigger (10% change threshold)
    const marketChangeTrigger: ValuationTrigger = {
      triggerId: `market_${assetId}`,
      assetId,
      triggerType: 'market_change',
      threshold: 10, // 10% market change
      lastTriggered: new Date(),
      isActive: true,
    };

    this.triggers.set(marketChangeTrigger.triggerId, marketChangeTrigger);
  }

  /**
   * Check and process revaluation triggers
   */
  async processRevaluationTriggers(): Promise<string[]> {
    const triggeredAssets: string[] = [];

    for (const trigger of Array.from(this.triggers.values())) {
      if (!trigger.isActive) continue;

      let shouldTrigger = false;

      switch (trigger.triggerType) {
        case 'time_based':
          shouldTrigger = trigger.nextScheduled ? new Date() >= trigger.nextScheduled : false;
          break;
        case 'market_change':
          shouldTrigger = await this.checkMarketChangeThreshold(trigger);
          break;
      }

      if (shouldTrigger) {
        triggeredAssets.push(trigger.assetId);
        trigger.lastTriggered = new Date();
        
        if (trigger.triggerType === 'time_based' && trigger.frequency) {
          trigger.nextScheduled = new Date(Date.now() + trigger.frequency * 24 * 60 * 60 * 1000);
        }
      }
    }

    return triggeredAssets;
  }

  /**
   * Request manual revaluation
   */
  async requestManualRevaluation(
    assetId: string,
    reason: string,
    caller: string
  ): Promise<void> {
    const user = this.getUser(caller);
    
    // Check caller permissions (asset owner or verifier)
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN) &&
        !AccessControl.hasRole(user, UserRole.USER)) {
      throw new AssetValuationError('UNAUTHORIZED', 'Insufficient permissions for manual revaluation');
    }

    // Create manual trigger
    const manualTrigger: ValuationTrigger = {
      triggerId: `manual_${assetId}_${Date.now()}`,
      assetId,
      triggerType: 'manual',
      lastTriggered: new Date(),
      isActive: true,
    };

    this.triggers.set(manualTrigger.triggerId, manualTrigger);
  }

  /**
   * Get market-based valuation estimate
   */
  async getMarketValuationEstimate(
    assetType: AssetType,
    location: string,
    size: number
  ): Promise<{ estimatedValue: number; confidence: string; factors: MarketFactor[] }> {
    // Get market data for the asset type and location
    const baseValue = this.getMarketBaseValue(assetType, location);
    const sizeMultiplier = this.calculateSizeMultiplier(assetType, size);
    const marketFactors = this.generateMarketFactors(assetType);

    // Calculate market adjustment
    const marketAdjustment = marketFactors.reduce((total, factor) => {
      const impact = factor.impact === 'positive' ? factor.magnitude : 
                    factor.impact === 'negative' ? -factor.magnitude : 0;
      return total + impact;
    }, 0);

    const estimatedValue = baseValue * sizeMultiplier * (1 + marketAdjustment / 100);

    return {
      estimatedValue,
      confidence: this.calculateConfidence(marketFactors, Math.abs(marketAdjustment)),
      factors: marketFactors,
    };
  }

  /**
   * Validate valuation against market data
   */
  async validateValuationAgainstMarket(
    assetId: string,
    proposedValue: number,
    assetType: AssetType,
    location: string,
    size: number
  ): Promise<{ isValid: boolean; variance: number; recommendation: string }> {
    const marketEstimate = await this.getMarketValuationEstimate(assetType, location, size);
    const variance = ((proposedValue - marketEstimate.estimatedValue) / marketEstimate.estimatedValue) * 100;

    let isValid = true;
    let recommendation = 'Valuation is within acceptable market range';

    if (Math.abs(variance) > 25) {
      isValid = false;
      recommendation = variance > 0 ? 
        'Valuation appears high compared to market data - requires additional justification' :
        'Valuation appears low compared to market data - consider market factors';
    } else if (Math.abs(variance) > 15) {
      recommendation = 'Valuation has significant variance from market - review recommended';
    }

    return {
      isValid,
      variance,
      recommendation,
    };
  }

  // Private helper methods

  private initializeMockUsers(): void {
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('verifier_address', UserRole.VERIFIER);
    this.registerUser('user_address', UserRole.USER);
  }

  private initializeMockMarketData(): void {
    // Mock market data for different asset types and locations
    this.marketData.set('real_estate_nairobi', 150000);
    this.marketData.set('real_estate_lagos', 120000);
    this.marketData.set('real_estate_cape_town', 200000);
    this.marketData.set('commodity_gold', 2000);
    this.marketData.set('commodity_oil', 80);
    this.marketData.set('equipment_machinery', 50000);
  }

  private validateValuationAmount(amount: number): void {
    if (amount <= 0) {
      throw new AssetValuationError('INVALID_AMOUNT', 'Valuation amount must be positive');
    }

    if (amount < 1000) {
      throw new AssetValuationError('AMOUNT_TOO_LOW', 'Valuation amount below minimum threshold');
    }

    if (amount > 100000000) {
      throw new AssetValuationError('AMOUNT_TOO_HIGH', 'Valuation amount exceeds maximum threshold');
    }
  }

  private validateValuationChange(oldValue: number, newValue: number): void {
    const changePercentage = Math.abs((newValue - oldValue) / oldValue) * 100;

    // Flag significant changes for review
    if (changePercentage > 50) {
      throw new AssetValuationError('CHANGE_TOO_LARGE', 'Valuation change exceeds 50% - requires additional approval');
    }
  }

  private generateMarketFactors(assetType: AssetType): MarketFactor[] {
    const factors: MarketFactor[] = [];

    switch (assetType) {
      case AssetType.RealEstate:
        factors.push(
          { factor: 'Location Premium', impact: 'positive', magnitude: 5, description: 'Prime location factor' },
          { factor: 'Market Conditions', impact: 'neutral', magnitude: 0, description: 'Stable market conditions' },
          { factor: 'Property Age', impact: 'negative', magnitude: 2, description: 'Depreciation factor' }
        );
        break;
      case AssetType.Commodity:
        factors.push(
          { factor: 'Global Demand', impact: 'positive', magnitude: 3, description: 'Increased global demand' },
          { factor: 'Supply Chain', impact: 'negative', magnitude: 1, description: 'Supply chain disruptions' }
        );
        break;
      default:
        factors.push(
          { factor: 'Market Conditions', impact: 'neutral', magnitude: 0, description: 'Standard market conditions' }
        );
    }

    return factors;
  }

  private calculateConfidence(factors: MarketFactor[], changePercentage: number): 'high' | 'medium' | 'low' {
    const factorCount = factors.length;
    const totalImpact = factors.reduce((sum, factor) => sum + Math.abs(factor.magnitude), 0);

    if (factorCount >= 3 && totalImpact < 10 && changePercentage < 15) {
      return 'high';
    } else if (factorCount >= 2 && totalImpact < 20 && changePercentage < 25) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private getMarketBaseValue(assetType: AssetType, location: string): number {
    const key = `${assetType}_${location.toLowerCase().replace(/\s+/g, '_')}`;
    return this.marketData.get(key) || 100000; // Default base value
  }

  private calculateSizeMultiplier(assetType: AssetType, size: number): number {
    switch (assetType) {
      case AssetType.RealEstate:
        return Math.sqrt(size / 1000); // Square root scaling for real estate
      case AssetType.Equipment:
        return size / 100; // Linear scaling for equipment
      default:
        return 1; // No size adjustment for other types
    }
  }

  private async checkMarketChangeThreshold(trigger: ValuationTrigger): Promise<boolean> {
    // Mock market change detection
    // In production, this would check actual market data APIs
    const randomChange = Math.random() * 20 - 10; // -10% to +10% random change
    return Math.abs(randomChange) > (trigger.threshold || 10);
  }
}

/**
 * Default asset valuation service instance
 */
export const assetValuationService = new AssetValuationService();