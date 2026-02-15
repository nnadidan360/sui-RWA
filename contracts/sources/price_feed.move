/// Price Feed module for Credit OS
/// Provides on-chain price validation and oracle integration for crypto assets
module credit_os::price_feed {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EPriceStale: u64 = 1;
    const EPriceInvalid: u64 = 2;
    const EUnauthorizedOracle: u64 = 3;
    const EPriceDeviationTooHigh: u64 = 4;
    const EInsufficientSources: u64 = 5;

    /// Price staleness threshold (5 minutes in milliseconds)
    const STALENESS_THRESHOLD: u64 = 300000;
    
    /// Maximum allowed price deviation (10%)
    const MAX_DEVIATION_BPS: u64 = 1000; // 10% in basis points

    /// Price data from a single oracle source
    struct PriceData has store, copy, drop {
        price: u64, // Price in smallest unit (e.g., cents, wei)
        decimals: u8, // Number of decimal places
        timestamp: u64,
        source: String, // Oracle source identifier
        confidence: u64, // Confidence score 0-100
    }

    /// Aggregated price feed for an asset
    struct PriceFeed has key, store {
        id: UID,
        asset_symbol: String, // e.g., "SUI", "BTC", "ETH"
        current_price: u64,
        decimals: u8,
        last_updated: u64,
        price_sources: vector<PriceData>,
        authorized_oracles: vector<address>,
        min_sources_required: u8,
        created_at: u64,
    }

    /// Price history entry for volatility analysis
    struct PriceHistory has store {
        timestamp: u64,
        price: u64,
        volume_24h: u64, // Optional: 24h trading volume
    }

    /// Price feed registry
    struct PriceFeedRegistry has key {
        id: UID,
        feeds: vector<address>, // Addresses of PriceFeed objects
        admin: address,
    }

    /// Event emitted when price is updated
    struct PriceUpdated has copy, drop {
        feed_id: address,
        asset_symbol: String,
        old_price: u64,
        new_price: u64,
        timestamp: u64,
        sources_count: u64,
    }

    /// Event emitted when price validation fails
    struct PriceValidationFailed has copy, drop {
        feed_id: address,
        asset_symbol: String,
        reason: String,
        timestamp: u64,
    }

    /// Event emitted when oracle is added/removed
    struct OracleUpdated has copy, drop {
        feed_id: address,
        oracle_address: address,
        action: String, // "added" or "removed"
        timestamp: u64,
    }

    /// Create a new price feed for an asset
    public fun create_price_feed(
        asset_symbol: String,
        decimals: u8,
        initial_price: u64,
        min_sources_required: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): PriceFeed {
        let current_time = clock::timestamp_ms(clock);

        let feed = PriceFeed {
            id: object::new(ctx),
            asset_symbol,
            current_price: initial_price,
            decimals,
            last_updated: current_time,
            price_sources: vector::empty(),
            authorized_oracles: vector::empty(),
            min_sources_required,
            created_at: current_time,
        };

        feed
    }

    /// Add an authorized oracle to the price feed
    public fun add_oracle(
        feed: &mut PriceFeed,
        oracle_address: address,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if oracle already exists
        let oracles = &feed.authorized_oracles;
        let len = vector::length(oracles);
        let mut i = 0;
        let mut exists = false;

        while (i < len) {
            if (*vector::borrow(oracles, i) == oracle_address) {
                exists = true;
                break
            };
            i = i + 1;
        };

        if (!exists) {
            vector::push_back(&mut feed.authorized_oracles, oracle_address);
            
            let feed_id = object::uid_to_address(&feed.id);
            sui::event::emit(OracleUpdated {
                feed_id,
                oracle_address,
                action: string::utf8(b"added"),
                timestamp: current_time,
            });
        };
    }

    /// Remove an oracle from the price feed
    public fun remove_oracle(
        feed: &mut PriceFeed,
        oracle_address: address,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let oracles = &mut feed.authorized_oracles;
        let len = vector::length(oracles);
        let mut i = 0;

        while (i < len) {
            if (*vector::borrow(oracles, i) == oracle_address) {
                vector::remove(oracles, i);
                
                let feed_id = object::uid_to_address(&feed.id);
                sui::event::emit(OracleUpdated {
                    feed_id,
                    oracle_address,
                    action: string::utf8(b"removed"),
                    timestamp: current_time,
                });
                break
            };
            i = i + 1;
        };
    }

    /// Submit a price update from an oracle
    public fun submit_price(
        feed: &mut PriceFeed,
        price: u64,
        source: String,
        confidence: u64,
        oracle_address: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify oracle is authorized
        assert!(is_authorized_oracle(feed, oracle_address), EUnauthorizedOracle);
        
        let current_time = clock::timestamp_ms(clock);

        // Create price data
        let price_data = PriceData {
            price,
            decimals: feed.decimals,
            timestamp: current_time,
            source,
            confidence,
        };

        // Add to price sources (keep last N sources)
        vector::push_back(&mut feed.price_sources, price_data);
        
        // Keep only recent price sources (last 10)
        while (vector::length(&feed.price_sources) > 10) {
            vector::remove(&mut feed.price_sources, 0);
        };

        // Update aggregated price if we have enough sources
        if (vector::length(&feed.price_sources) >= (feed.min_sources_required as u64)) {
            update_aggregated_price(feed, clock);
        };
    }

    /// Update the aggregated price using median of recent sources
    fun update_aggregated_price(feed: &mut PriceFeed, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock);
        let sources = &feed.price_sources;
        let len = vector::length(sources);

        if (len == 0) {
            return
        };

        // Calculate median price from sources
        let mut prices: vector<u64> = vector::empty();
        let mut i = 0;

        while (i < len) {
            let source = vector::borrow(sources, i);
            // Only include recent prices (not stale)
            if (current_time - source.timestamp <= STALENESS_THRESHOLD) {
                vector::push_back(&mut prices, source.price);
            };
            i = i + 1;
        };

        let prices_len = vector::length(&prices);
        if (prices_len == 0) {
            return
        };

        // Simple median calculation (for production, use proper sorting)
        let median_price = if (prices_len == 1) {
            *vector::borrow(&prices, 0)
        } else {
            // For simplicity, use average instead of median
            let mut sum = 0u64;
            let mut j = 0;
            while (j < prices_len) {
                sum = sum + *vector::borrow(&prices, j);
                j = j + 1;
            };
            sum / prices_len
        };

        let old_price = feed.current_price;
        feed.current_price = median_price;
        feed.last_updated = current_time;

        let feed_id = object::uid_to_address(&feed.id);
        sui::event::emit(PriceUpdated {
            feed_id,
            asset_symbol: feed.asset_symbol,
            old_price,
            new_price: median_price,
            timestamp: current_time,
            sources_count: prices_len,
        });
    }

    /// Validate price before using for liquidation
    public fun validate_price_for_liquidation(
        feed: &PriceFeed,
        clock: &Clock,
        _ctx: &mut TxContext
    ): bool {
        let current_time = clock::timestamp_ms(clock);

        // Check if price is stale
        if (current_time - feed.last_updated > STALENESS_THRESHOLD) {
            let feed_id = object::uid_to_address(&feed.id);
            sui::event::emit(PriceValidationFailed {
                feed_id,
                asset_symbol: feed.asset_symbol,
                reason: string::utf8(b"Price is stale"),
                timestamp: current_time,
            });
            return false
        };

        // Check if we have enough sources
        let sources_count = vector::length(&feed.price_sources);
        if (sources_count < (feed.min_sources_required as u64)) {
            let feed_id = object::uid_to_address(&feed.id);
            sui::event::emit(PriceValidationFailed {
                feed_id,
                asset_symbol: feed.asset_symbol,
                reason: string::utf8(b"Insufficient price sources"),
                timestamp: current_time,
            });
            return false
        };

        // Check price deviation across sources
        if (!check_price_deviation(feed)) {
            let feed_id = object::uid_to_address(&feed.id);
            sui::event::emit(PriceValidationFailed {
                feed_id,
                asset_symbol: feed.asset_symbol,
                reason: string::utf8(b"Price deviation too high"),
                timestamp: current_time,
            });
            return false
        };

        true
    }

    /// Check if price deviation across sources is acceptable
    fun check_price_deviation(feed: &PriceFeed): bool {
        let sources = &feed.price_sources;
        let len = vector::length(sources);

        if (len < 2) {
            return true // Not enough sources to check deviation
        };

        let mut min_price = 18446744073709551615u64; // u64::MAX
        let mut max_price = 0u64;
        let mut i = 0;

        while (i < len) {
            let source = vector::borrow(sources, i);
            if (source.price < min_price) {
                min_price = source.price;
            };
            if (source.price > max_price) {
                max_price = source.price;
            };
            i = i + 1;
        };

        // Calculate deviation in basis points
        if (min_price == 0) {
            return false
        };

        let deviation = ((max_price - min_price) * 10000) / min_price;
        deviation <= MAX_DEVIATION_BPS
    }

    /// Check if an address is an authorized oracle
    fun is_authorized_oracle(feed: &PriceFeed, oracle_address: address): bool {
        let oracles = &feed.authorized_oracles;
        let len = vector::length(oracles);
        let mut i = 0;

        while (i < len) {
            if (*vector::borrow(oracles, i) == oracle_address) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // === Getter functions ===

    /// Get current price
    public fun get_current_price(feed: &PriceFeed): u64 {
        feed.current_price
    }

    /// Get asset symbol
    public fun get_asset_symbol(feed: &PriceFeed): String {
        feed.asset_symbol
    }

    /// Get decimals
    public fun get_decimals(feed: &PriceFeed): u8 {
        feed.decimals
    }

    /// Get last updated timestamp
    public fun get_last_updated(feed: &PriceFeed): u64 {
        feed.last_updated
    }

    /// Get number of price sources
    public fun get_sources_count(feed: &PriceFeed): u64 {
        vector::length(&feed.price_sources)
    }

    /// Check if price is stale
    public fun is_price_stale(feed: &PriceFeed, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time - feed.last_updated > STALENESS_THRESHOLD
    }

    /// Get price with validation
    public fun get_validated_price(feed: &PriceFeed, clock: &Clock, ctx: &mut TxContext): (u64, bool) {
        let is_valid = validate_price_for_liquidation(feed, clock, ctx);
        (feed.current_price, is_valid)
    }
}
