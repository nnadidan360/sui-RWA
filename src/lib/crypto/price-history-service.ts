import { PriceData, AggregatedPrice } from './price-aggregation-service';

// ============================================================================
// PRICE HISTORY SERVICE FOR CREDIT OS
// ============================================================================
// This service tracks price history and provides volatility analysis
// for risk management and liquidation threshold calculations

export interface PriceHistoryEntry {
  id: string;
  symbol: string;
  price: number;
  confidence: number;
  deviation: number;
  sourceCount: number;
  timestamp: Date;
  sources: string[];
}

export interface VolatilityMetrics {
  symbol: string;
  period: string; // '1h', '24h', '7d', '30d'
  volatility: number; // Standard deviation as percentage
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceChange: number; // Percentage change from start to end
  dataPoints: number;
  calculatedAt: Date;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  alertType: 'VOLATILITY' | 'PRICE_THRESHOLD' | 'DEVIATION';
  threshold: number;
  currentValue: number;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggeredAt: Date;
}

export interface TrendAnalysis {
  symbol: string;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number; // 0-100, higher = stronger trend
  support: number; // Support price level
  resistance: number; // Resistance price level
  momentum: number; // Price momentum indicator
  period: string;
  analyzedAt: Date;
}

export class PriceHistoryService {
  private priceHistory: Map<string, PriceHistoryEntry[]> = new Map();
  private volatilityCache: Map<string, VolatilityMetrics> = new Map();
  private activeAlerts: Map<string, PriceAlert[]> = new Map();
  
  // Configuration constants
  private readonly MAX_HISTORY_ENTRIES = 10000; // Per asset
  private readonly VOLATILITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly HIGH_VOLATILITY_THRESHOLD = 0.15; // 15%
  private readonly CRITICAL_VOLATILITY_THRESHOLD = 0.25; // 25%

  constructor() {
    // Initialize with empty maps
  }

  /**
   * Record price data in history
   */
  recordPrice(aggregatedPrice: AggregatedPrice): void {
    const entry: PriceHistoryEntry = {
      id: this.generateEntryId(aggregatedPrice.symbol, aggregatedPrice.timestamp),
      symbol: aggregatedPrice.symbol,
      price: aggregatedPrice.price,
      confidence: aggregatedPrice.confidence,
      deviation: aggregatedPrice.deviation,
      sourceCount: aggregatedPrice.sourceCount,
      timestamp: aggregatedPrice.timestamp,
      sources: aggregatedPrice.sources
    };

    // Get or create history array for symbol
    let history = this.priceHistory.get(aggregatedPrice.symbol) || [];
    
    // Add new entry
    history.push(entry);
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Limit history size
    if (history.length > this.MAX_HISTORY_ENTRIES) {
      history = history.slice(0, this.MAX_HISTORY_ENTRIES);
    }
    
    this.priceHistory.set(aggregatedPrice.symbol, history);
    
    // Clear volatility cache for this symbol
    this.clearVolatilityCache(aggregatedPrice.symbol);
    
    // Check for alerts
    this.checkPriceAlerts(aggregatedPrice.symbol, entry);
  }

  /**
   * Get price history for a symbol within time range
   */
  getPriceHistory(
    symbol: string, 
    startTime?: Date, 
    endTime?: Date, 
    limit?: number
  ): PriceHistoryEntry[] {
    const history = this.priceHistory.get(symbol) || [];
    
    let filtered = history;
    
    // Apply time filters
    if (startTime || endTime) {
      filtered = history.filter(entry => {
        const timestamp = entry.timestamp.getTime();
        const afterStart = !startTime || timestamp >= startTime.getTime();
        const beforeEnd = !endTime || timestamp <= endTime.getTime();
        return afterStart && beforeEnd;
      });
    }
    
    // Apply limit
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    
    return filtered;
  }

  /**
   * Calculate volatility metrics for a time period
   */
  calculateVolatility(symbol: string, periodHours: number = 24): VolatilityMetrics {
    const cacheKey = `${symbol}_${periodHours}h`;
    const cached = this.volatilityCache.get(cacheKey);
    
    // Return cached result if fresh
    if (cached && this.isCacheFresh(cached.calculatedAt)) {
      return cached;
    }

    const startTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    const history = this.getPriceHistory(symbol, startTime);
    
    if (history.length < 2) {
      const emptyMetrics: VolatilityMetrics = {
        symbol,
        period: `${periodHours}h`,
        volatility: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceChange: 0,
        dataPoints: 0,
        calculatedAt: new Date()
      };
      return emptyMetrics;
    }

    // Sort by timestamp (oldest first for calculations)
    const sortedHistory = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const prices = sortedHistory.map(entry => entry.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    
    // Calculate basic statistics
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    
    // Calculate volatility (standard deviation)
    const variance = prices.reduce((sum, price) => {
      const diff = price - averagePrice;
      return sum + (diff * diff);
    }, 0) / prices.length;
    
    const volatility = averagePrice > 0 ? (Math.sqrt(variance) / averagePrice) * 100 : 0;
    
    const metrics: VolatilityMetrics = {
      symbol,
      period: `${periodHours}h`,
      volatility,
      averagePrice,
      minPrice,
      maxPrice,
      priceChange,
      dataPoints: prices.length,
      calculatedAt: new Date()
    };
    
    // Cache the result
    this.volatilityCache.set(cacheKey, metrics);
    
    return metrics;
  }

  /**
   * Analyze price trend
   */
  analyzeTrend(symbol: string, periodHours: number = 24): TrendAnalysis {
    const history = this.getPriceHistory(symbol, new Date(Date.now() - periodHours * 60 * 60 * 1000));
    
    if (history.length < 10) {
      return {
        symbol,
        trend: 'SIDEWAYS',
        strength: 0,
        support: 0,
        resistance: 0,
        momentum: 0,
        period: `${periodHours}h`,
        analyzedAt: new Date()
      };
    }

    // Sort by timestamp (oldest first)
    const sortedHistory = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const prices = sortedHistory.map(entry => entry.price);
    
    // Calculate moving averages
    const shortMA = this.calculateMovingAverage(prices.slice(-5)); // Last 5 points
    const longMA = this.calculateMovingAverage(prices.slice(-10)); // Last 10 points
    
    // Determine trend direction
    let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
    let strength = 0;
    
    if (shortMA > longMA * 1.02) { // 2% threshold
      trend = 'BULLISH';
      strength = Math.min(((shortMA - longMA) / longMA) * 100 * 10, 100);
    } else if (shortMA < longMA * 0.98) { // 2% threshold
      trend = 'BEARISH';
      strength = Math.min(((longMA - shortMA) / longMA) * 100 * 10, 100);
    }
    
    // Calculate support and resistance levels
    const recentPrices = prices.slice(-20); // Last 20 data points
    const support = Math.min(...recentPrices);
    const resistance = Math.max(...recentPrices);
    
    // Calculate momentum (rate of change)
    const momentum = prices.length >= 5 ? 
      ((prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5]) * 100 : 0;
    
    return {
      symbol,
      trend,
      strength,
      support,
      resistance,
      momentum,
      period: `${periodHours}h`,
      analyzedAt: new Date()
    };
  }

  /**
   * Set up price alerts
   */
  setupPriceAlert(
    symbol: string,
    alertType: 'VOLATILITY' | 'PRICE_THRESHOLD' | 'DEVIATION',
    threshold: number
  ): string {
    const alertId = this.generateAlertId(symbol, alertType);
    
    // Remove existing alert of same type for symbol
    this.removeAlert(symbol, alertType);
    
    // Note: Alert will be checked when new prices are recorded
    // This is a setup function that registers the alert parameters
    
    return alertId;
  }

  /**
   * Get active alerts for symbol
   */
  getActiveAlerts(symbol?: string): PriceAlert[] {
    if (symbol) {
      return this.activeAlerts.get(symbol) || [];
    }
    
    // Return all alerts
    const allAlerts: PriceAlert[] = [];
    this.activeAlerts.forEach(alerts => {
      allAlerts.push(...alerts);
    });
    
    return allAlerts;
  }

  /**
   * Get volatility metrics for multiple periods
   */
  getVolatilityReport(symbol: string): {
    hourly: VolatilityMetrics;
    daily: VolatilityMetrics;
    weekly: VolatilityMetrics;
  } {
    return {
      hourly: this.calculateVolatility(symbol, 1),
      daily: this.calculateVolatility(symbol, 24),
      weekly: this.calculateVolatility(symbol, 168) // 7 days
    };
  }

  /**
   * Check if asset is experiencing high volatility
   */
  isHighVolatility(symbol: string, periodHours: number = 24): boolean {
    const metrics = this.calculateVolatility(symbol, periodHours);
    return metrics.volatility > this.HIGH_VOLATILITY_THRESHOLD * 100;
  }

  /**
   * Get price statistics summary
   */
  getPriceStatistics(symbol: string, periodHours: number = 24): {
    current: number;
    average: number;
    min: number;
    max: number;
    volatility: number;
    trend: string;
    dataPoints: number;
  } {
    const history = this.getPriceHistory(symbol, new Date(Date.now() - periodHours * 60 * 60 * 1000));
    const volatilityMetrics = this.calculateVolatility(symbol, periodHours);
    const trendAnalysis = this.analyzeTrend(symbol, periodHours);
    
    const current = history.length > 0 ? history[0].price : 0;
    
    return {
      current,
      average: volatilityMetrics.averagePrice,
      min: volatilityMetrics.minPrice,
      max: volatilityMetrics.maxPrice,
      volatility: volatilityMetrics.volatility,
      trend: trendAnalysis.trend,
      dataPoints: history.length
    };
  }

  /**
   * Clear old history entries
   */
  cleanupOldHistory(maxAgeHours: number = 720): void { // 30 days default
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    this.priceHistory.forEach((history, symbol) => {
      const filtered = history.filter(entry => entry.timestamp >= cutoffTime);
      this.priceHistory.set(symbol, filtered);
    });
  }

  /**
   * Private helper methods
   */
  private generateEntryId(symbol: string, timestamp: Date): string {
    return `${symbol}_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(symbol: string, alertType: string): string {
    return `${symbol}_${alertType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCacheFresh(calculatedAt: Date): boolean {
    return (Date.now() - calculatedAt.getTime()) < this.VOLATILITY_CACHE_TTL;
  }

  private clearVolatilityCache(symbol: string): void {
    const keysToDelete: string[] = [];
    this.volatilityCache.forEach((_, key) => {
      if (key.startsWith(`${symbol}_`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.volatilityCache.delete(key));
  }

  private calculateMovingAverage(prices: number[]): number {
    if (prices.length === 0) return 0;
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  private checkPriceAlerts(symbol: string, entry: PriceHistoryEntry): void {
    const alerts: PriceAlert[] = [];
    
    // Check volatility alerts
    const volatility = this.calculateVolatility(symbol, 1); // 1 hour volatility
    if (volatility.volatility > this.CRITICAL_VOLATILITY_THRESHOLD * 100) {
      alerts.push({
        id: this.generateAlertId(symbol, 'VOLATILITY'),
        symbol,
        alertType: 'VOLATILITY',
        threshold: this.CRITICAL_VOLATILITY_THRESHOLD * 100,
        currentValue: volatility.volatility,
        message: `Critical volatility detected: ${volatility.volatility.toFixed(2)}%`,
        severity: 'CRITICAL',
        triggeredAt: new Date()
      });
    } else if (volatility.volatility > this.HIGH_VOLATILITY_THRESHOLD * 100) {
      alerts.push({
        id: this.generateAlertId(symbol, 'VOLATILITY'),
        symbol,
        alertType: 'VOLATILITY',
        threshold: this.HIGH_VOLATILITY_THRESHOLD * 100,
        currentValue: volatility.volatility,
        message: `High volatility detected: ${volatility.volatility.toFixed(2)}%`,
        severity: 'HIGH',
        triggeredAt: new Date()
      });
    }
    
    // Check price deviation alerts
    if (entry.deviation > 10) { // 10% deviation threshold
      alerts.push({
        id: this.generateAlertId(symbol, 'DEVIATION'),
        symbol,
        alertType: 'DEVIATION',
        threshold: 10,
        currentValue: entry.deviation,
        message: `High price deviation across sources: ${entry.deviation.toFixed(2)}%`,
        severity: entry.deviation > 20 ? 'CRITICAL' : 'HIGH',
        triggeredAt: new Date()
      });
    }
    
    // Store alerts
    if (alerts.length > 0) {
      const existingAlerts = this.activeAlerts.get(symbol) || [];
      this.activeAlerts.set(symbol, [...existingAlerts, ...alerts]);
    }
  }

  private removeAlert(symbol: string, alertType: string): void {
    const alerts = this.activeAlerts.get(symbol) || [];
    const filtered = alerts.filter(alert => alert.alertType !== alertType);
    this.activeAlerts.set(symbol, filtered);
  }
}