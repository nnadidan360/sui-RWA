// PHASE 2: Oracle Integration
// Task 18.1 - Oracle Service Implementation
// Multi-source oracle aggregation and validation

import { logger } from '../../utils/logger';

interface PropertyValuation {
  address: string;
  estimatedValue: number;
  confidence: number;
  source: string;
  lastUpdated: Date;
}

interface CommodityPrice {
  commodity: string;
  price: number;
  unit: string;
  source: string;
  timestamp: Date;
}

interface EquipmentDepreciation {
  equipmentType: string;
  purchasePrice: number;
  purchaseDate: Date;
  currentValue: number;
  depreciationRate: number;
}

export class OracleService {
  // API keys would be in environment variables
  private static readonly ZILLOW_API_KEY = process.env.ZILLOW_API_KEY;
  private static readonly CORELOGIC_API_KEY = process.env.CORELOGIC_API_KEY;
  
  /**
   * Get property valuation from multiple sources
   */
  static async getPropertyValue(address: string): Promise<number> {
    try {
      const sources = await Promise.allSettled([
        this.getZillowValuation(address),
        this.getCoreLogicValuation(address)
      ]);

      const validValues: number[] = [];
      
      sources.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          validValues.push(result.value);
        }
      });

      if (validValues.length === 0) {
        throw new Error('No valid property valuations available');
      }

      // Return median value
      return this.calculateMedian(validValues);
    } catch (error) {
      logger.error('Error getting property value', { address, error });
      throw error;
    }
  }

  /**
   * Get Zillow property valuation
   */
  private static async getZillowValuation(address: string): Promise<number> {
    // In production, would call actual Zillow API
    // For now, return mock data
    logger.info('Fetching Zillow valuation', { address });
    return 350000; // Mock value
  }


  /**
   * Get CoreLogic property valuation
   */
  private static async getCoreLogicValuation(address: string): Promise<number> {
    logger.info('Fetching CoreLogic valuation', { address });
    return 345000; // Mock value
  }

  /**
   * Get commodity price
   */
  static async getCommodityPrice(commodity: string): Promise<number> {
    try {
      // In production, integrate with commodity price APIs
      const mockPrices: Record<string, number> = {
        'gold': 1950,
        'silver': 24,
        'copper': 4.2,
        'oil': 85,
        'wheat': 6.5
      };

      return mockPrices[commodity.toLowerCase()] || 0;
    } catch (error) {
      logger.error('Error getting commodity price', { commodity, error });
      throw error;
    }
  }

  /**
   * Calculate equipment depreciation
   */
  static async getEquipmentDepreciation(equipment: {
    type: string;
    purchasePrice: number;
    purchaseDate: Date;
    condition: string;
  }): Promise<number> {
    try {
      const ageInYears = (Date.now() - equipment.purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      
      // Depreciation rates by equipment type
      const depreciationRates: Record<string, number> = {
        'vehicle': 0.15,
        'machinery': 0.10,
        'computer': 0.20,
        'furniture': 0.07
      };

      const rate = depreciationRates[equipment.type.toLowerCase()] || 0.10;
      const depreciation = equipment.purchasePrice * rate * ageInYears;
      const currentValue = Math.max(equipment.purchasePrice - depreciation, equipment.purchasePrice * 0.1);

      return Math.round(currentValue);
    } catch (error) {
      logger.error('Error calculating equipment depreciation', { equipment, error });
      throw error;
    }
  }

  /**
   * Validate market data from multiple sources
   */
  static async validateMarketData(data: {
    assetType: string;
    identifier: string;
    proposedValue: number;
  }): Promise<boolean> {
    try {
      let oracleValue: number;

      switch (data.assetType) {
        case 'property':
          oracleValue = await this.getPropertyValue(data.identifier);
          break;
        case 'commodity':
          oracleValue = await this.getCommodityPrice(data.identifier);
          break;
        default:
          return false;
      }

      // Allow 10% deviation
      const deviation = Math.abs(data.proposedValue - oracleValue) / oracleValue;
      return deviation <= 0.10;
    } catch (error) {
      logger.error('Error validating market data', { data, error });
      return false;
    }
  }

  /**
   * Calculate median from array of numbers
   */
  private static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }

  /**
   * Get aggregated price from multiple sources
   */
  static async getAggregatedPrice(
    assetType: string,
    identifier: string
  ): Promise<{ price: number; confidence: number; sources: number }> {
    const prices: number[] = [];

    try {
      if (assetType === 'property') {
        const value = await this.getPropertyValue(identifier);
        prices.push(value);
      } else if (assetType === 'commodity') {
        const value = await this.getCommodityPrice(identifier);
        prices.push(value);
      }

      const median = this.calculateMedian(prices);
      const confidence = prices.length >= 2 ? 0.9 : 0.6;

      return {
        price: median,
        confidence,
        sources: prices.length
      };
    } catch (error) {
      logger.error('Error getting aggregated price', { assetType, identifier, error });
      throw error;
    }
  }
}
