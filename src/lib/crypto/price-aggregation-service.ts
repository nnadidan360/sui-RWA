import { SuiService } from '../blockchain/sui-service';

// ============================================================================
// PRICE AGGREGATION SERVICE FOR CREDIT OS
// ============================================================================
// This service aggregates crypto asset prices from multiple sources
// and provides validated price feeds for LTV calculations and liquidations

export interface PriceSource {
  id: string;
  name: string;
  endpoint: string;
  weight: number; // 1-100, higher = more trusted
  isActive: boolean;
  lastUpdate: Date;
  reliabilityScore: number; // 0-100, based on historical accuracy
}

export interface PriceData {
  symbol: string;
  price: number; // USD price
  timestamp: Date;
  source: string;
  confidence: number; // 0-100
}

export interface AggregatedPrice {
  symbol: string;
  price: number;
  confidence: number;
  deviation: number; // Price spread as percentage
  sourceCount: number;
  timestamp: Date;
  sources: string[];
}

export interface PriceValidationResult {
  isValid: boolean;
  price: number;
  confidence: number;
  deviation: number;
  reason?: string;
}

export interface AssetConfig {
  symbol: string;
  decimals: number;
  minSources: number;
  maxDeviation: number; // Maximum allowed price deviation (%)
  updateFrequency: number; // Minimum update frequency in milliseconds
}

export class PriceAggregationService {
  private suiService: SuiService;
  private priceSources: Map<string, PriceSource> = new Map();
  private priceCache: Map<string, AggregatedPrice> = new Map();
  private assetConfigs: Map<string, AssetConfig> = new Map();
  
  // Price validation constants
  private readonly MAX_PRICE_AGE_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_CONFIDENCE_THRESHOLD = 80; // 80%
  private readonly DEFAULT_MAX_DEVIATION = 5; // 5%

  constructor(suiService: SuiService) {
    this.suiService = suiService;
    this.initializeDefaultSources();
    this.initializeAssetConfigs();
  }

  /**
   * Initialize default price sources
   */
  private initializeDefaultSources(): void {
    const defaultSources: PriceSource[] = [
      {
        id: 'coingecko',
        name: 'CoinGecko',
        endpoint: 'https://api.coingecko.com/api/v3',
        weight: 30,
        isActive: true,
        lastUpdate: new Date(),
        reliabilityScore: 95
      },
      {
        id: 'coinmarketcap',
        name: 'CoinMarketCap',
        endpoint: 'https://pro-api.coinmarketcap.com/v1',
        weight: 25,
        isActive: true,
        lastUpdate: new Date(),
        reliabilityScore: 90
      },
      {
        id: 'binance',
        name: 'Binance API',
        endpoint: 'https://api.binance.com/api/v3',
        weight: 20,
        isActive: true,
        lastUpdate: new Date(),
        reliabilityScore: 88
      },
      {
        id: 'kraken',
        name: 'Kraken API',
        endpoint: 'https://api.kraken.com/0/public',
        weight: 15,
        isActive: true,
        lastUpdate: new Date(),
        reliabilityScore: 85
      },
      {
        id: 'coinbase',
        name: 'Coinbase Pro',
        endpoint: 'https://api.exchange.coinbase.com',
        weight: 10,
        isActive: true,
        lastUpdate: new Date(),
        reliabilityScore: 82
      }
    ];

    defaultSources.forEach(source => {
      this.priceSources.set(source.id, source);
    });
  }

  /**
   * Initialize asset configurations
   */
  private initializeAssetConfigs(): void {
    const configs: AssetConfig[] = [
      {
        symbol: 'SUI',
        decimals: 9,
        minSources: 3,
        maxDeviation: 5,
        updateFrequency: 60000 // 1 minute
      },
      {
        symbol: 'USDC',
        decimals: 6,
        minSources: 2,
        maxDeviation: 2, // Stablecoin should have lower deviation
        updateFrequency: 300000 // 5 minutes
      },
      {
        symbol: 'WETH',
        decimals: 8,
        minSources: 3,
        maxDeviation: 5,
        updateFrequency: 60000 // 1 minute
      },
      {
        symbol: 'BTC',
        decimals: 8,
        minSources: 3,
        maxDeviation: 5,
        updateFrequency: 60000 // 1 minute
      }
    ];

    configs.forEach(config => {
      this.assetConfigs.set(config.symbol, config);
    });
  }

  /**
   * Get aggregated price for asset from multiple sources
   */
  async getAggregatedPrice(symbol: string, forceRefresh: boolean = false): Promise<AggregatedPrice> {
    const config = this.assetConfigs.get(symbol);
    if (!config) {
      throw new Error(`Asset ${symbol} not supported`);
    }

    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (!forceRefresh && cached && this.isPriceFresh(cached, config.updateFrequency)) {
      return cached;
    }

    try {
      // Fetch prices from all active sources
      const pricePromises = Array.from(this.priceSources.values())
        .filter(source => source.isActive)
        .map(source => this.fetchPriceFromSource(symbol, source));

      const priceResults = await Promise.allSettled(pricePromises);
      const validPrices: PriceData[] = [];

      // Collect successful price fetches
      priceResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          validPrices.push(result.value);
        } else {
          const sourceId = Array.from(this.priceSources.keys())[index];
          console.warn(`Failed to fetch price from ${sourceId}:`, result.status === 'rejected' ? result.reason : 'No data');
        }
      });

      // Validate minimum sources
      if (validPrices.length < config.minSources) {
        throw new Error(`Insufficient price sources: got ${validPrices.length}, need ${config.minSources}`);
      }

      // Aggregate prices
      const aggregated = this.aggregatePrices(symbol, validPrices);

      // Validate deviation
      if (aggregated.deviation > config.maxDeviation) {
        throw new Error(`Price deviation too high: ${aggregated.deviation}% > ${config.maxDeviation}%`);
      }

      // Cache the result
      this.priceCache.set(symbol, aggregated);

      return aggregated;
    } catch (error) {
      throw new Error(`Failed to get aggregated price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate price against current aggregated price
   */
  async validatePrice(symbol: string, proposedPrice: number, maxDeviation?: number): Promise<PriceValidationResult> {
    try {
      const currentPrice = await this.getAggregatedPrice(symbol);
      const allowedDeviation = maxDeviation || this.DEFAULT_MAX_DEVIATION;

      // Check if current price is fresh enough
      if (!this.isPriceFresh(currentPrice, this.MAX_PRICE_AGE_MS)) {
        return {
          isValid: false,
          price: currentPrice.price,
          confidence: currentPrice.confidence,
          deviation: 0,
          reason: 'Price feed too old'
        };
      }

      // Check confidence level
      if (currentPrice.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        return {
          isValid: false,
          price: currentPrice.price,
          confidence: currentPrice.confidence,
          deviation: 0,
          reason: 'Price confidence too low'
        };
      }

      // Calculate deviation
      const deviation = this.calculatePriceDeviation(currentPrice.price, proposedPrice);

      // Validate deviation
      if (deviation > allowedDeviation) {
        return {
          isValid: false,
          price: currentPrice.price,
          confidence: currentPrice.confidence,
          deviation,
          reason: `Price deviation too high: ${deviation.toFixed(2)}% > ${allowedDeviation}%`
        };
      }

      return {
        isValid: true,
        price: currentPrice.price,
        confidence: currentPrice.confidence,
        deviation
      };
    } catch (error) {
      return {
        isValid: false,
        price: 0,
        confidence: 0,
        deviation: 0,
        reason: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update on-chain price feed with aggregated data
   */
  async updateOnChainPriceFeed(symbol: string): Promise<string> {
    try {
      const aggregatedPrice = await this.getAggregatedPrice(symbol, true);
      
      // Convert price to on-chain format (8 decimal places)
      const scaledPrice = Math.floor(aggregatedPrice.price * 100000000);
      const scaledConfidence = Math.floor(aggregatedPrice.confidence * 100); // Convert to basis points
      
      // Prepare data for on-chain update
      const prices = [scaledPrice]; // In production, would include individual source prices
      const oracleIds = ['aggregated']; // In production, would include actual oracle IDs

      // Call Sui service to update price feed
      const result = await this.suiService.executeTransaction({
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID!,
        module: 'price_feed',
        function: 'update_price_feed',
        arguments: [
          symbol,
          prices.map(p => p.toString()),
          oracleIds,
        ],
        gasBudget: 10000000
      });

      return result.digest;
    } catch (error) {
      throw new Error(`Failed to update on-chain price feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price history for volatility analysis
   */
  async getPriceHistory(symbol: string, hours: number = 24): Promise<PriceData[]> {
    // Mock implementation - in production would fetch from database or external API
    const currentPrice = await this.getAggregatedPrice(symbol);
    const history: PriceData[] = [];
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
      const volatility = (Math.random() - 0.5) * 0.1; // ±5% random volatility
      const historicalPrice = currentPrice.price * (1 + volatility);
      
      history.push({
        symbol,
        price: historicalPrice,
        timestamp,
        source: 'historical',
        confidence: currentPrice.confidence
      });
    }
    
    return history;
  }

  /**
   * Calculate price volatility over time period
   */
  async calculateVolatility(symbol: string, hours: number = 24): Promise<number> {
    const history = await this.getPriceHistory(symbol, hours);
    
    if (history.length < 2) {
      return 0;
    }

    const prices = history.map(h => h.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    const variance = prices.reduce((sum, price) => {
      const diff = price - mean;
      return sum + (diff * diff);
    }, 0) / prices.length;
    
    return Math.sqrt(variance) / mean; // Return as coefficient of variation
  }

  /**
   * Fetch price from individual source
   */
  private async fetchPriceFromSource(symbol: string, source: PriceSource): Promise<PriceData | null> {
    try {
      // Mock implementation - in production would make actual API calls
      const mockPrices: Record<string, number> = {
        'SUI': 2.50 + (Math.random() - 0.5) * 0.1, // ±$0.05 variation
        'USDC': 1.00 + (Math.random() - 0.5) * 0.01, // ±$0.005 variation
        'WETH': 3500.00 + (Math.random() - 0.5) * 50, // ±$25 variation
        'BTC': 65000.00 + (Math.random() - 0.5) * 1000, // ±$500 variation
      };

      const basePrice = mockPrices[symbol];
      if (!basePrice) {
        return null;
      }

      // Add source-specific variation
      const sourceVariation = (Math.random() - 0.5) * 0.02; // ±1% source variation
      const price = basePrice * (1 + sourceVariation);

      return {
        symbol,
        price,
        timestamp: new Date(),
        source: source.id,
        confidence: source.reliabilityScore
      };
    } catch (error) {
      console.error(`Error fetching price from ${source.name}:`, error);
      return null;
    }
  }

  /**
   * Aggregate prices using weighted average
   */
  private aggregatePrices(symbol: string, prices: PriceData[]): AggregatedPrice {
    let weightedSum = 0;
    let totalWeight = 0;
    const sources: string[] = [];

    // Calculate weighted average
    prices.forEach(priceData => {
      const source = this.priceSources.get(priceData.source);
      if (source && source.isActive) {
        const weight = source.weight;
        weightedSum += priceData.price * weight;
        totalWeight += weight;
        sources.push(source.id);
      }
    });

    const aggregatedPrice = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Calculate price deviation (spread)
    const priceValues = prices.map(p => p.price);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const deviation = aggregatedPrice > 0 ? ((maxPrice - minPrice) / aggregatedPrice) * 100 : 0;

    // Calculate confidence based on source count and deviation
    const sourceConfidence = Math.min(prices.length * 20, 80); // Max 80% from source count
    const deviationPenalty = Math.min(deviation * 4, 20); // Max 20% penalty
    const confidence = Math.max(sourceConfidence - deviationPenalty, 10); // Min 10%

    return {
      symbol,
      price: aggregatedPrice,
      confidence,
      deviation,
      sourceCount: prices.length,
      timestamp: new Date(),
      sources
    };
  }

  /**
   * Check if price is fresh enough
   */
  private isPriceFresh(price: AggregatedPrice, maxAge: number): boolean {
    return (Date.now() - price.timestamp.getTime()) <= maxAge;
  }

  /**
   * Calculate percentage deviation between two prices
   */
  private calculatePriceDeviation(price1: number, price2: number): number {
    if (price1 === 0) return 100;
    return Math.abs(price1 - price2) / price1 * 100;
  }

  /**
   * Add or update price source
   */
  addPriceSource(source: PriceSource): void {
    this.priceSources.set(source.id, source);
  }

  /**
   * Remove price source
   */
  removePriceSource(sourceId: string): void {
    this.priceSources.delete(sourceId);
  }

  /**
   * Get all active price sources
   */
  getActiveSources(): PriceSource[] {
    return Array.from(this.priceSources.values()).filter(source => source.isActive);
  }

  /**
   * Get supported assets
   */
  getSupportedAssets(): string[] {
    return Array.from(this.assetConfigs.keys());
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }
}