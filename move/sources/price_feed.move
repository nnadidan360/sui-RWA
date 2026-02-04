module credit_os::price_feed {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use sui::event;
    use sui::table::{Self, Table};
    use std::vector;
    use sui::math;

    // Error codes
    const E_INVALID_PRICE: u64 = 1;
    const E_PRICE_TOO_OLD: u64 = 2;
    const E_UNAUTHORIZED_ORACLE: u64 = 3;
    const E_INSUFFICIENT_SOURCES: u64 = 4;
    const E_PRICE_DEVIATION_TOO_HIGH: u64 = 5;
    const E_ORACLE_NOT_FOUND: u64 = 6;
    const E_ASSET_NOT_SUPPORTED: u64 = 7;

    // Constants
    const MAX_PRICE_AGE_MS: u64 = 300000; // 5 minutes
    const MIN_ORACLE_SOURCES: u64 = 3;
    const MAX_PRICE_DEVIATION: u64 = 500; // 5% in basis points
    const PRICE_PRECISION: u64 = 100000000; // 8 decimal places

    /// Price feed data structure
    struct PriceFeed has key, store {
        id: UID,
        asset_symbol: String,
        price: u64, // Price in USD with 8 decimal precision
        confidence: u64, // Confidence score (0-10000, 10000 = 100%)
        timestamp: u64,
        sources: vector<String>, // Oracle source identifiers
        deviation: u64, // Price deviation in basis points
    }

    /// Oracle registry for managing authorized price sources
    struct OracleRegistry has key {
        id: UID,
        authorized_oracles: Table<String, OracleInfo>,
        supported_assets: Table<String, AssetConfig>,
        admin: address,
    }

    /// Oracle information
    struct OracleInfo has store {
        oracle_id: String,
        endpoint: String,
        weight: u64, // Weight in aggregation (1-100)
        is_active: bool,
        last_update: u64,
        reliability_score: u64, // Historical reliability (0-10000)
    }

    /// Asset configuration for price feeds
    struct AssetConfig has store {
        symbol: String,
        decimals: u8,
        min_sources: u64,
        max_deviation: u64, // Maximum allowed deviation in basis points
        update_frequency: u64, // Minimum update frequency in milliseconds
    }

    /// Price update capability (admin only)
    struct PriceUpdateCapability has key, store {
        id: UID,
    }

    /// Aggregated price data from multiple sources
    struct PriceAggregation has copy, drop {
        asset_symbol: String,
        aggregated_price: u64,
        confidence: u64,
        source_count: u64,
        deviation: u64,
        timestamp: u64,
    }

    /// Event emitted when price is updated
    struct PriceUpdated has copy, drop {
        asset_symbol: String,
        old_price: u64,
        new_price: u64,
        confidence: u64,
        sources: vector<String>,
        timestamp: u64,
    }

    /// Event emitted when oracle is added/updated
    struct OracleUpdated has copy, drop {
        oracle_id: String,
        endpoint: String,
        weight: u64,
        is_active: bool,
    }

    /// Event emitted when price validation fails
    struct PriceValidationFailed has copy, drop {
        asset_symbol: String,
        attempted_price: u64,
        current_price: u64,
        deviation: u64,
        reason: String,
    }

    /// Initialize the price feed system
    fun init(ctx: &mut TxContext) {
        let registry = OracleRegistry {
            id: object::new(ctx),
            authorized_oracles: table::new(ctx),
            supported_assets: table::new(ctx),
            admin: tx_context::sender(ctx),
        };

        let capability = PriceUpdateCapability {
            id: object::new(ctx),
        };

        transfer::share_object(registry);
        transfer::transfer(capability, tx_context::sender(ctx));
    }

    /// Add or update oracle in registry
    public entry fun add_oracle(
        registry: &mut OracleRegistry,
        _cap: &PriceUpdateCapability,
        oracle_id: String,
        endpoint: String,
        weight: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_UNAUTHORIZED_ORACLE);
        
        let oracle_info = OracleInfo {
            oracle_id,
            endpoint,
            weight,
            is_active: true,
            last_update: 0,
            reliability_score: 10000, // Start with perfect score
        };

        if (table::contains(&registry.authorized_oracles, oracle_id)) {
            table::remove(&mut registry.authorized_oracles, oracle_id);
        };
        
        table::add(&mut registry.authorized_oracles, oracle_id, oracle_info);

        event::emit(OracleUpdated {
            oracle_id,
            endpoint,
            weight,
            is_active: true,
        });
    }

    /// Add supported asset configuration
    public entry fun add_supported_asset(
        registry: &mut OracleRegistry,
        _cap: &PriceUpdateCapability,
        symbol: String,
        decimals: u8,
        min_sources: u64,
        max_deviation: u64,
        update_frequency: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_UNAUTHORIZED_ORACLE);

        let asset_config = AssetConfig {
            symbol,
            decimals,
            min_sources,
            max_deviation,
            update_frequency,
        };

        if (table::contains(&registry.supported_assets, symbol)) {
            table::remove(&mut registry.supported_assets, symbol);
        };

        table::add(&mut registry.supported_assets, symbol, asset_config);
    }

    /// Update price feed with aggregated data from multiple sources
    public entry fun update_price_feed(
        registry: &mut OracleRegistry,
        _cap: &PriceUpdateCapability,
        asset_symbol: String,
        prices: vector<u64>,
        oracle_ids: vector<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_UNAUTHORIZED_ORACLE);
        assert!(table::contains(&registry.supported_assets, asset_symbol), E_ASSET_NOT_SUPPORTED);

        let asset_config = table::borrow(&registry.supported_assets, asset_symbol);
        let current_time = clock::timestamp_ms(clock);

        // Validate minimum sources
        assert!(vector::length(&prices) >= asset_config.min_sources, E_INSUFFICIENT_SOURCES);
        assert!(vector::length(&prices) == vector::length(&oracle_ids), E_INSUFFICIENT_SOURCES);

        // Validate all oracles are authorized
        let i = 0;
        let len = vector::length(&oracle_ids);
        while (i < len) {
            let oracle_id = vector::borrow(&oracle_ids, i);
            assert!(table::contains(&registry.authorized_oracles, *oracle_id), E_UNAUTHORIZED_ORACLE);
            i = i + 1;
        };

        // Aggregate prices using weighted average
        let aggregation = aggregate_prices(registry, prices, oracle_ids);
        
        // Validate price deviation
        assert!(aggregation.deviation <= asset_config.max_deviation, E_PRICE_DEVIATION_TOO_HIGH);

        // Create or update price feed
        let price_feed = PriceFeed {
            id: object::new(ctx),
            asset_symbol,
            price: aggregation.aggregated_price,
            confidence: aggregation.confidence,
            timestamp: current_time,
            sources: oracle_ids,
            deviation: aggregation.deviation,
        };

        event::emit(PriceUpdated {
            asset_symbol,
            old_price: 0, // Would track previous price in production
            new_price: aggregation.aggregated_price,
            confidence: aggregation.confidence,
            sources: oracle_ids,
            timestamp: current_time,
        });

        // Share the price feed object
        transfer::share_object(price_feed);
    }

    /// Validate price against current feed (for liquidation safety)
    public fun validate_price(
        price_feed: &PriceFeed,
        proposed_price: u64,
        max_deviation: u64,
        clock: &Clock
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if price feed is not too old
        if (current_time - price_feed.timestamp > MAX_PRICE_AGE_MS) {
            return false
        };

        // Check price deviation
        let deviation = calculate_price_deviation(price_feed.price, proposed_price);
        if (deviation > max_deviation) {
            event::emit(PriceValidationFailed {
                asset_symbol: price_feed.asset_symbol,
                attempted_price: proposed_price,
                current_price: price_feed.price,
                deviation,
                reason: string::utf8(b"Price deviation too high"),
            });
            return false
        };

        // Check confidence level
        if (price_feed.confidence < 8000) { // 80% minimum confidence
            return false
        };

        true
    }

    /// Get current price for asset (view function)
    public fun get_current_price(price_feed: &PriceFeed, clock: &Clock): (u64, u64, bool) {
        let current_time = clock::timestamp_ms(clock);
        let is_fresh = (current_time - price_feed.timestamp) <= MAX_PRICE_AGE_MS;
        
        (price_feed.price, price_feed.confidence, is_fresh)
    }

    /// Aggregate prices from multiple sources using weighted average
    fun aggregate_prices(
        registry: &OracleRegistry,
        prices: vector<u64>,
        oracle_ids: vector<String>
    ): PriceAggregation {
        let len = vector::length(&prices);
        let mut weighted_sum = 0u64;
        let mut total_weight = 0u64;
        let mut i = 0;

        // Calculate weighted average
        while (i < len) {
            let price = *vector::borrow(&prices, i);
            let oracle_id = vector::borrow(&oracle_ids, i);
            let oracle_info = table::borrow(&registry.authorized_oracles, *oracle_id);
            
            if (oracle_info.is_active && price > 0) {
                weighted_sum = weighted_sum + (price * oracle_info.weight);
                total_weight = total_weight + oracle_info.weight;
            };
            
            i = i + 1;
        };

        let aggregated_price = if (total_weight > 0) {
            weighted_sum / total_weight
        } else {
            0
        };

        // Calculate price deviation and confidence
        let deviation = calculate_price_spread(prices);
        let confidence = calculate_confidence(deviation, len);

        PriceAggregation {
            asset_symbol: string::utf8(b""), // Would be passed as parameter
            aggregated_price,
            confidence,
            source_count: len,
            deviation,
            timestamp: 0, // Would be set by caller
        }
    }

    /// Calculate price deviation between two prices
    fun calculate_price_deviation(price1: u64, price2: u64): u64 {
        let higher = math::max(price1, price2);
        let lower = math::min(price1, price2);
        
        if (higher == 0) {
            return 10000 // 100% deviation if no price
        };

        ((higher - lower) * 10000) / higher
    }

    /// Calculate price spread across multiple sources
    fun calculate_price_spread(prices: vector<u64>): u64 {
        let len = vector::length(&prices);
        if (len <= 1) {
            return 0
        };

        let mut min_price = *vector::borrow(&prices, 0);
        let mut max_price = min_price;
        let mut i = 1;

        while (i < len) {
            let price = *vector::borrow(&prices, i);
            if (price > 0) {
                min_price = math::min(min_price, price);
                max_price = math::max(max_price, price);
            };
            i = i + 1;
        };

        calculate_price_deviation(max_price, min_price)
    }

    /// Calculate confidence score based on deviation and source count
    fun calculate_confidence(deviation: u64, source_count: u64): u64 {
        // Base confidence from source count (more sources = higher confidence)
        let source_confidence = math::min(source_count * 2000, 8000); // Max 8000 from sources
        
        // Reduce confidence based on price deviation
        let deviation_penalty = math::min(deviation * 2, 2000); // Max 2000 penalty
        
        if (source_confidence > deviation_penalty) {
            source_confidence - deviation_penalty
        } else {
            1000 // Minimum 10% confidence
        }
    }

    /// Get price feed details (view function)
    public fun get_price_feed_details(price_feed: &PriceFeed): (
        String,  // asset_symbol
        u64,     // price
        u64,     // confidence
        u64,     // timestamp
        u64,     // deviation
        u64      // source_count
    ) {
        (
            price_feed.asset_symbol,
            price_feed.price,
            price_feed.confidence,
            price_feed.timestamp,
            price_feed.deviation,
            vector::length(&price_feed.sources)
        )
    }

    /// Check if asset is supported
    public fun is_asset_supported(registry: &OracleRegistry, asset_symbol: String): bool {
        table::contains(&registry.supported_assets, asset_symbol)
    }

    /// Get asset configuration
    public fun get_asset_config(registry: &OracleRegistry, asset_symbol: String): (u8, u64, u64, u64) {
        assert!(table::contains(&registry.supported_assets, asset_symbol), E_ASSET_NOT_SUPPORTED);
        
        let config = table::borrow(&registry.supported_assets, asset_symbol);
        (config.decimals, config.min_sources, config.max_deviation, config.update_frequency)
    }

    // Test functions for development
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_price_feed(
        asset_symbol: String,
        price: u64,
        confidence: u64,
        ctx: &mut TxContext
    ): PriceFeed {
        PriceFeed {
            id: object::new(ctx),
            asset_symbol,
            price,
            confidence,
            timestamp: 1000000,
            sources: vector::empty(),
            deviation: 100, // 1%
        }
    }
}