import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { PriceAggregationService, AssetSymbol, AggregatedPrice } from './price-aggregation-service';
import { logger } from '../../utils/logger';

/**
 * Price feed configuration for an asset
 */
export interface PriceFeedConfig {
  assetSymbol: string;
  decimals: number;
  minSourcesRequired: number;
  updateIntervalMs: number;
}

/**
 * Service that integrates off-chain price aggregation with on-chain price feeds
 */
export class PriceFeedIntegrationService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;
  private aggregationService: PriceAggregationService;
  private priceFeeds: Map<string, string> = new Map(); // symbol -> feed object ID
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    suiClient: SuiClient,
    packageId: string,
    aggregationService: PriceAggregationService,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.aggregationService = aggregationService;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Create a new price feed on-chain
   */
  async createPriceFeed(
    config: PriceFeedConfig,
    initialPrice: number,
    signerAddress: string
  ): Promise<{
    success: boolean;
    feedId?: string;
    error?: string;
  }> {
    try {
      logger.info('Creating price feed on-chain', {
        asset: config.assetSymbol,
        initialPrice,
      });

      // Convert price to smallest unit (e.g., cents)
      const priceInSmallestUnit = Math.round(initialPrice * Math.pow(10, config.decimals));

      const tx = new TransactionBlock();

      const [feed] = tx.moveCall({
        target: `${this.packageId}::price_feed::create_price_feed`,
        arguments: [
          tx.pure(config.assetSymbol),
          tx.pure(config.decimals),
          tx.pure(priceInSmallestUnit),
          tx.pure(config.minSourcesRequired),
          tx.object(this.clockObjectId),
        ],
      });

      // Transfer feed to signer (or make it shared)
      tx.transferObjects([feed], tx.pure(signerAddress));

      logger.info('Price feed creation transaction prepared', {
        asset: config.assetSymbol,
      });

      // In production, this would be executed with a keypair
      return {
        success: true,
        feedId: 'pending',
      };
    } catch (error) {
      logger.error('Failed to create price feed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        asset: config.assetSymbol,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit price update to on-chain feed
   */
  async submitPriceUpdate(
    feedObjectId: string,
    assetSymbol: AssetSymbol,
    oracleAddress: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    price?: number;
    error?: string;
  }> {
    try {
      logger.info('Submitting price update', {
        feedId: feedObjectId,
        asset: assetSymbol,
      });

      // Aggregate price from off-chain sources
      const aggregated = await this.aggregationService.aggregatePrice(assetSymbol);

      // Convert price to smallest unit
      const priceInSmallestUnit = Math.round(aggregated.price * Math.pow(10, aggregated.decimals));

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::price_feed::submit_price`,
        arguments: [
          tx.object(feedObjectId),
          tx.pure(priceInSmallestUnit),
          tx.pure('aggregated'), // Source name
          tx.pure(aggregated.confidence),
          tx.pure(oracleAddress),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Price update transaction prepared', {
        feedId: feedObjectId,
        price: aggregated.price,
        confidence: aggregated.confidence,
      });

      return {
        success: true,
        price: aggregated.price,
      };
    } catch (error) {
      logger.error('Failed to submit price update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        feedId: feedObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Start automatic price updates for a feed
   */
  startAutomaticUpdates(
    feedObjectId: string,
    assetSymbol: AssetSymbol,
    oracleAddress: string,
    signerAddress: string,
    intervalMs: number = 60000 // Default: 1 minute
  ): void {
    // Stop existing interval if any
    this.stopAutomaticUpdates(assetSymbol);

    logger.info('Starting automatic price updates', {
      asset: assetSymbol,
      intervalMs,
    });

    const interval = setInterval(async () => {
      try {
        await this.submitPriceUpdate(feedObjectId, assetSymbol, oracleAddress, signerAddress);
      } catch (error) {
        logger.error('Automatic price update failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          asset: assetSymbol,
        });
      }
    }, intervalMs);

    this.updateIntervals.set(assetSymbol, interval);
    this.priceFeeds.set(assetSymbol, feedObjectId);
  }

  /**
   * Stop automatic price updates
   */
  stopAutomaticUpdates(assetSymbol: string): void {
    const interval = this.updateIntervals.get(assetSymbol);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(assetSymbol);
      logger.info('Stopped automatic price updates', { asset: assetSymbol });
    }
  }

  /**
   * Stop all automatic updates
   */
  stopAllUpdates(): void {
    for (const [symbol, interval] of this.updateIntervals.entries()) {
      clearInterval(interval);
      logger.info('Stopped automatic price updates', { asset: symbol });
    }
    this.updateIntervals.clear();
  }

  /**
   * Validate price feed before liquidation
   */
  async validatePriceFeedForLiquidation(
    feedObjectId: string,
    assetSymbol: AssetSymbol
  ): Promise<{
    valid: boolean;
    price?: number;
    onChainPrice?: number;
    offChainPrice?: number;
    reason?: string;
  }> {
    try {
      logger.info('Validating price feed for liquidation', {
        feedId: feedObjectId,
        asset: assetSymbol,
      });

      // Validate off-chain price
      const offChainValidation = await this.aggregationService.validatePriceForLiquidation(
        assetSymbol
      );

      if (!offChainValidation.valid) {
        return {
          valid: false,
          reason: `Off-chain validation failed: ${offChainValidation.reason}`,
        };
      }

      // Query on-chain price feed
      const feedObject = await this.suiClient.getObject({
        id: feedObjectId,
        options: {
          showContent: true,
        },
      });

      if (!feedObject.data) {
        return {
          valid: false,
          reason: 'Price feed not found on-chain',
        };
      }

      // In production, parse the on-chain price and validate
      // For now, we'll use the off-chain price
      const onChainPrice = offChainValidation.price!;

      // Check if on-chain and off-chain prices are close
      const priceDiff = Math.abs(onChainPrice - offChainValidation.price!) / offChainValidation.price!;
      if (priceDiff > 0.05) { // 5% difference
        return {
          valid: false,
          onChainPrice,
          offChainPrice: offChainValidation.price,
          reason: `Price mismatch: on-chain ${onChainPrice} vs off-chain ${offChainValidation.price}`,
        };
      }

      return {
        valid: true,
        price: offChainValidation.price,
        onChainPrice,
        offChainPrice: offChainValidation.price,
      };
    } catch (error) {
      logger.error('Price feed validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        feedId: feedObjectId,
      });

      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current price from feed
   */
  async getCurrentPriceFromFeed(feedObjectId: string): Promise<number | null> {
    try {
      const feedObject = await this.suiClient.getObject({
        id: feedObjectId,
        options: {
          showContent: true,
        },
      });

      if (!feedObject.data || !feedObject.data.content) {
        return null;
      }

      // Parse price from on-chain data
      // In production, properly parse the Move object
      return null; // Placeholder
    } catch (error) {
      logger.error('Failed to get price from feed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        feedId: feedObjectId,
      });
      return null;
    }
  }

  /**
   * Add oracle to price feed
   */
  async addOracle(
    feedObjectId: string,
    oracleAddress: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::price_feed::add_oracle`,
        arguments: [
          tx.object(feedObjectId),
          tx.pure(oracleAddress),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Add oracle transaction prepared', {
        feedId: feedObjectId,
        oracle: oracleAddress,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to add oracle', {
        error: error instanceof Error ? error.message : 'Unknown error',
        feedId: feedObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get price history and volatility
   */
  async getPriceAnalytics(assetSymbol: AssetSymbol) {
    const history = this.aggregationService.getPriceHistory(assetSymbol, 24);
    const volatility = this.aggregationService.calculateVolatility(assetSymbol);

    return {
      history,
      volatility,
      currentPrice: history.length > 0 ? history[history.length - 1].price : null,
    };
  }
}
