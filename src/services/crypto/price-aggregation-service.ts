import axios from 'axios';
import { logger } from '../../utils/logger';

/**
 * Supported crypto assets for price feeds
 */
export const SUPPORTED_ASSETS = {
  SUI: 'sui',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  SOL: 'solana',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
} as const;

export type AssetSymbol = keyof typeof SUPPORTED_ASSETS;

/**
 * Price source configuration
 */
interface PriceSource {
  name: string;
  url: string;
  parser: (data: any) => number;
  weight: number; // Weight for aggregation (0-100)
}

/**
 * Price data from a single source
 */
export interface PriceData {
  price: number;
  source: string;
  timestamp: number;
  confidence: number;
}

/**
 * Aggregated price result
 */
export interface AggregatedPrice {
  asset: string;
  price: number;
  decimals: number;
  sources: PriceData[];
  timestamp: number;
  confidence: number;
  deviation: number; // Price deviation across sources (%)
}

/**
 * Price history entry
 */
export interface PriceHistoryEntry {
  timestamp: number;
  price: number;
  volume24h?: number;
}

/**
 * Volatility metrics
 */
export interface VolatilityMetrics {
  asset: string;
  volatility24h: number; // Standard deviation of 24h prices
  priceChange24h: number; // Percentage change
  highPrice24h: number;
  lowPrice24h: number;
  averagePrice24h: number;
}

/**
 * Service for aggregating crypto prices from multiple sources
 */
export class PriceAggregationService {
  private priceHistory: Map<string, PriceHistoryEntry[]> = new Map();
  private readonly HISTORY_RETENTION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_HISTORY_ENTRIES = 288; // 5-minute intervals for 24h

  /**
   * Price sources configuration
   * In production, add API keys and more sources
   */
  private priceSources: PriceSource[] = [
    {
      name: 'CoinGecko',
      url: 'https://api.coingecko.com/api/v3/simple/price',
      parser: (data: any) => data.usd || 0,
      weight: 40,
    },
    {
      name: 'CoinMarketCap',
      url: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
      parser: (data: any) => data?.data?.quote?.USD?.price || 0,
      weight: 35,
    },
    {
      name: 'Binance',
      url: 'https://api.binance.com/api/v3/ticker/price',
      parser: (data: any) => parseFloat(data.price) || 0,
      weight: 25,
    },
  ];

  /**
   * Fetch price from a single source
   */
  private async fetchFromSource(
    source: PriceSource,
    assetId: string,
    symbol: string
  ): Promise<PriceData | null> {
    try {
      let url = source.url;
      let response;

      // Configure request based on source
      if (source.name === 'CoinGecko') {
        url = `${url}?ids=${assetId}&vs_currencies=usd`;
        response = await axios.get(url, { timeout: 5000 });
        const price = response.data[assetId]?.usd;
        
        if (!price) return null;

        return {
          price,
          source: source.name,
          timestamp: Date.now(),
          confidence: source.weight,
        };
      } else if (source.name === 'Binance') {
        // Binance uses different symbol format (e.g., BTCUSDT)
        const binanceSymbol = `${symbol}USDT`;
        url = `${url}?symbol=${binanceSymbol}`;
        response = await axios.get(url, { timeout: 5000 });
        const price = parseFloat(response.data.price);

        if (!price) return null;

        return {
          price,
          source: source.name,
          timestamp: Date.now(),
          confidence: source.weight,
        };
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to fetch price from ${source.name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        asset: assetId,
      });
      return null;
    }
  }

  /**
   * Aggregate prices from multiple sources
   */
  async aggregatePrice(symbol: AssetSymbol): Promise<AggregatedPrice> {
    const assetId = SUPPORTED_ASSETS[symbol];
    
    logger.info('Aggregating price from multiple sources', {
      symbol,
      assetId,
    });

    // Fetch from all sources in parallel
    const pricePromises = this.priceSources.map(source =>
      this.fetchFromSource(source, assetId, symbol)
    );

    const results = await Promise.allSettled(pricePromises);
    const prices: PriceData[] = [];

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    }

    if (prices.length === 0) {
      throw new Error(`No price data available for ${symbol}`);
    }

    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;

    for (const priceData of prices) {
      weightedSum += priceData.price * priceData.confidence;
      totalWeight += priceData.confidence;
    }

    const aggregatedPrice = weightedSum / totalWeight;

    // Calculate price deviation
    const priceValues = prices.map(p => p.price);
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const deviation = ((maxPrice - minPrice) / minPrice) * 100;

    // Calculate confidence based on number of sources and deviation
    const sourceConfidence = (prices.length / this.priceSources.length) * 100;
    const deviationPenalty = Math.max(0, 100 - deviation * 10);
    const overallConfidence = (sourceConfidence + deviationPenalty) / 2;

    const result: AggregatedPrice = {
      asset: symbol,
      price: aggregatedPrice,
      decimals: 8, // Standard for crypto prices
      sources: prices,
      timestamp: Date.now(),
      confidence: Math.round(overallConfidence),
      deviation,
    };

    // Store in price history
    this.addToPriceHistory(symbol, {
      timestamp: result.timestamp,
      price: result.price,
    });

    logger.info('Price aggregation complete', {
      symbol,
      price: aggregatedPrice,
      sources: prices.length,
      deviation: deviation.toFixed(2),
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Get prices for multiple assets
   */
  async aggregateMultiplePrices(symbols: AssetSymbol[]): Promise<Map<AssetSymbol, AggregatedPrice>> {
    const results = new Map<AssetSymbol, AggregatedPrice>();

    const promises = symbols.map(async symbol => {
      try {
        const price = await this.aggregatePrice(symbol);
        results.set(symbol, price);
      } catch (error) {
        logger.error(`Failed to aggregate price for ${symbol}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Add price to history
   */
  private addToPriceHistory(symbol: string, entry: PriceHistoryEntry): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(entry);

    // Remove old entries
    const cutoffTime = Date.now() - this.HISTORY_RETENTION;
    const filtered = history.filter(e => e.timestamp > cutoffTime);

    // Limit number of entries
    if (filtered.length > this.MAX_HISTORY_ENTRIES) {
      filtered.splice(0, filtered.length - this.MAX_HISTORY_ENTRIES);
    }

    this.priceHistory.set(symbol, filtered);
  }

  /**
   * Get price history for an asset
   */
  getPriceHistory(symbol: AssetSymbol, hours: number = 24): PriceHistoryEntry[] {
    const history = this.priceHistory.get(symbol) || [];
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return history.filter(e => e.timestamp > cutoffTime);
  }

  /**
   * Calculate volatility metrics
   */
  calculateVolatility(symbol: AssetSymbol): VolatilityMetrics | null {
    const history = this.getPriceHistory(symbol, 24);

    if (history.length < 2) {
      return null;
    }

    const prices = history.map(h => h.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];

    // Calculate average
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = sum / prices.length;

    // Calculate standard deviation
    const squaredDiffs = prices.map(p => Math.pow(p - average, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // Calculate volatility as percentage of average
    const volatility = (stdDev / average) * 100;

    // Calculate price change
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    return {
      asset: symbol,
      volatility24h: volatility,
      priceChange24h: priceChange,
      highPrice24h: Math.max(...prices),
      lowPrice24h: Math.min(...prices),
      averagePrice24h: average,
    };
  }

  /**
   * Validate price before liquidation
   */
  async validatePriceForLiquidation(
    symbol: AssetSymbol,
    maxDeviation: number = 5, // 5% max deviation
    minSources: number = 2
  ): Promise<{
    valid: boolean;
    price?: number;
    reason?: string;
  }> {
    try {
      const aggregated = await this.aggregatePrice(symbol);

      // Check if we have enough sources
      if (aggregated.sources.length < minSources) {
        return {
          valid: false,
          reason: `Insufficient price sources: ${aggregated.sources.length} < ${minSources}`,
        };
      }

      // Check price deviation
      if (aggregated.deviation > maxDeviation) {
        return {
          valid: false,
          reason: `Price deviation too high: ${aggregated.deviation.toFixed(2)}% > ${maxDeviation}%`,
        };
      }

      // Check confidence
      if (aggregated.confidence < 70) {
        return {
          valid: false,
          reason: `Confidence too low: ${aggregated.confidence}% < 70%`,
        };
      }

      return {
        valid: true,
        price: aggregated.price,
      };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current price (simple, no aggregation)
   */
  async getCurrentPrice(symbol: AssetSymbol): Promise<number> {
    const aggregated = await this.aggregatePrice(symbol);
    return aggregated.price;
  }

  /**
   * Clear price history (for testing)
   */
  clearHistory(): void {
    this.priceHistory.clear();
  }
}
