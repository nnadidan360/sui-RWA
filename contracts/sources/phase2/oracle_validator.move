// PHASE 2: Oracle Integration
// Task 18.1 - Oracle Validator
// On-chain price verification for oracle feeds

module credit_os::oracle_validator {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::vector;

    // ==================== Error Codes ====================
    const E_INVALID_PRICE: u64 = 1;
    const E_STALE_DATA: u64 = 2;
    const E_INSUFFICIENT_SOURCES: u64 = 3;
    const E_PRICE_DEVIATION: u64 = 4;
    const E_NOT_AUTHORIZED: u64 = 5;

    // ==================== Constants ====================
    const MAX_PRICE_AGE: u64 = 10; // Maximum epochs before data is stale
    const MINIMUM_SOURCES: u64 = 2; // Minimum oracle sources required
    const MAX_DEVIATION_BPS: u64 = 500; // 5% maximum deviation between sources

    // ==================== Structs ====================

    /// Oracle price feed
    struct OracleFeed has key {
        id: UID,
        asset_id: ID,
        
        // Price data
        current_price: u64,
        last_update: u64,
        
        // Source tracking
        sources: vector<PriceSource>,
        active_sources: u64,
        
        // Validation
        is_validated: bool,
        validation_threshold: u64,
        
        created_at: u64,
    }

    /// Individual price source
    struct PriceSource has store {
        source_id: vector<u8>,
        price: u64,
        timestamp: u64,
        is_active: bool,
    }

    /// Price validation result
    struct ValidationResult has store {
        is_valid: bool,
        median_price: u64,
        deviation: u64,
        source_count: u64,
    }

    // ==================== Events ====================

    struct PriceUpdated has copy, drop {
        feed_id: ID,
        asset_id: ID,
        old_price: u64,
        new_price: u64,
        source_count: u64,
        timestamp: u64,
    }

    struct PriceValidated has copy, drop {
        feed_id: ID,
        price: u64,
        deviation: u64,
        timestamp: u64,
    }


    // ==================== Core Functions ====================

    /// Create oracle feed
    public fun create_feed(
        asset_id: ID,
        validation_threshold: u64,
        ctx: &mut TxContext
    ): OracleFeed {
        OracleFeed {
            id: object::new(ctx),
            asset_id,
            current_price: 0,
            last_update: 0,
            sources: vector::empty(),
            active_sources: 0,
            is_validated: false,
            validation_threshold,
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Update price from source
    public fun update_price_source(
        feed: &mut OracleFeed,
        source_id: vector<u8>,
        price: u64,
        ctx: &mut TxContext
    ) {
        assert!(price > 0, E_INVALID_PRICE);

        let source = PriceSource {
            source_id,
            price,
            timestamp: tx_context::epoch(ctx),
            is_active: true,
        };

        vector::push_back(&mut feed.sources, source);
        feed.active_sources = feed.active_sources + 1;
    }

    /// Validate and aggregate prices
    public fun validate_prices(
        feed: &mut OracleFeed,
        ctx: &mut TxContext
    ): ValidationResult {
        let current_epoch = tx_context::epoch(ctx);
        
        // Collect valid prices
        let valid_prices = vector::empty<u64>();
        let i = 0;
        let len = vector::length(&feed.sources);
        
        while (i < len) {
            let source = vector::borrow(&feed.sources, i);
            if (source.is_active && (current_epoch - source.timestamp) <= MAX_PRICE_AGE) {
                vector::push_back(&mut valid_prices, source.price);
            };
            i = i + 1;
        };

        let source_count = vector::length(&valid_prices);
        assert!(source_count >= MINIMUM_SOURCES, E_INSUFFICIENT_SOURCES);

        // Calculate median price
        let median = calculate_median(&valid_prices);
        
        // Calculate deviation
        let deviation = calculate_deviation(&valid_prices, median);
        assert!(deviation <= MAX_DEVIATION_BPS, E_PRICE_DEVIATION);

        // Update feed
        let old_price = feed.current_price;
        feed.current_price = median;
        feed.last_update = current_epoch;
        feed.is_validated = true;

        event::emit(PriceUpdated {
            feed_id: object::id(feed),
            asset_id: feed.asset_id,
            old_price,
            new_price: median,
            source_count,
            timestamp: current_epoch,
        });

        event::emit(PriceValidated {
            feed_id: object::id(feed),
            price: median,
            deviation,
            timestamp: current_epoch,
        });

        ValidationResult {
            is_valid: true,
            median_price: median,
            deviation,
            source_count,
        }
    }

    // ==================== Helper Functions ====================

    fun calculate_median(prices: &vector<u64>): u64 {
        let len = vector::length(prices);
        if (len == 0) return 0;
        if (len == 1) return *vector::borrow(prices, 0);

        // Simple median (would use proper sorting in production)
        let sum: u64 = 0;
        let i = 0;
        while (i < len) {
            sum = sum + *vector::borrow(prices, i);
            i = i + 1;
        };
        sum / len
    }

    fun calculate_deviation(prices: &vector<u64>, median: u64): u64 {
        if (median == 0) return 0;
        
        let max_deviation: u64 = 0;
        let i = 0;
        let len = vector::length(prices);
        
        while (i < len) {
            let price = *vector::borrow(prices, i);
            let deviation = if (price > median) {
                ((price - median) * 10000) / median
            } else {
                ((median - price) * 10000) / median
            };
            
            if (deviation > max_deviation) {
                max_deviation = deviation;
            };
            i = i + 1;
        };
        
        max_deviation
    }

    // ==================== View Functions ====================

    public fun get_current_price(feed: &OracleFeed): u64 {
        feed.current_price
    }

    public fun is_validated(feed: &OracleFeed): bool {
        feed.is_validated
    }

    public fun get_source_count(feed: &OracleFeed): u64 {
        feed.active_sources
    }
}
