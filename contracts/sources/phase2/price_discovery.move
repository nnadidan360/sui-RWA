// PHASE 2: Asset Tokenization and Fractionalization
// Task 17.1 - Price Discovery
// Fair value calculation and price oracle

module credit_os::price_discovery {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::vector;

    // ==================== Error Codes ====================
    const E_INSUFFICIENT_DATA: u64 = 1;
    const E_INVALID_PRICE: u64 = 2;
    const E_STALE_PRICE: u64 = 3;

    // ==================== Constants ====================
    const MAX_PRICE_AGE: u64 = 100; // Maximum epochs before price is stale
    const MINIMUM_TRADES_FOR_VWAP: u64 = 5;

    // ==================== Structs ====================

    /// Price oracle for a token
    struct PriceOracle has key {
        id: UID,
        token_id: ID,
        
        // Current pricing
        current_price: u64,
        last_update: u64,
        
        // Historical data
        price_history: vector<PricePoint>,
        trade_history: vector<TradeData>,
        
        // Calculated metrics
        vwap_24h: u64, // Volume-weighted average price
        high_24h: u64,
        low_24h: u64,
        
        // Volatility
        price_volatility: u64, // Basis points
        
        created_at: u64,
    }

    /// Price point snapshot
    struct PricePoint has store {
        price: u64,
        timestamp: u64,
        source: u8, // 0=orderbook, 1=amm, 2=external
    }

    /// Trade data for VWAP calculation
    struct TradeData has store {
        price: u64,
        volume: u64,
        timestamp: u64,
    }

    /// Price update event
    struct PriceUpdated has copy, drop {
        token_id: ID,
        old_price: u64,
        new_price: u64,
        source: u8,
        timestamp: u64,
    }

    /// VWAP calculated event
    struct VWAPCalculated has copy, drop {
        token_id: ID,
        vwap: u64,
        trade_count: u64,
        total_volume: u64,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create price oracle
    public fun create_oracle(
        token_id: ID,
        initial_price: u64,
        ctx: &mut TxContext
    ): PriceOracle {
        assert!(initial_price > 0, E_INVALID_PRICE);

        let initial_point = PricePoint {
            price: initial_price,
            timestamp: tx_context::epoch(ctx),
            source: 0,
        };

        PriceOracle {
            id: object::new(ctx),
            token_id,
            current_price: initial_price,
            last_update: tx_context::epoch(ctx),
            price_history: vector::singleton(initial_point),
            trade_history: vector::empty(),
            vwap_24h: initial_price,
            high_24h: initial_price,
            low_24h: initial_price,
            price_volatility: 0,
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Update price from order book
    public fun update_price_from_orderbook(
        oracle: &mut PriceOracle,
        new_price: u64,
        ctx: &mut TxContext
    ) {
        assert!(new_price > 0, E_INVALID_PRICE);

        let old_price = oracle.current_price;
        oracle.current_price = new_price;
        oracle.last_update = tx_context::epoch(ctx);

        // Add to price history
        let price_point = PricePoint {
            price: new_price,
            timestamp: tx_context::epoch(ctx),
            source: 0, // orderbook
        };
        vector::push_back(&mut oracle.price_history, price_point);

        // Update 24h high/low
        if (new_price > oracle.high_24h) {
            oracle.high_24h = new_price;
        };
        if (new_price < oracle.low_24h) {
            oracle.low_24h = new_price;
        };

        // Calculate volatility
        oracle.price_volatility = calculate_volatility(old_price, new_price);

        event::emit(PriceUpdated {
            token_id: oracle.token_id,
            old_price,
            new_price,
            source: 0,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Update price from AMM
    public fun update_price_from_amm(
        oracle: &mut PriceOracle,
        new_price: u64,
        ctx: &mut TxContext
    ) {
        assert!(new_price > 0, E_INVALID_PRICE);

        let old_price = oracle.current_price;
        oracle.current_price = new_price;
        oracle.last_update = tx_context::epoch(ctx);

        let price_point = PricePoint {
            price: new_price,
            timestamp: tx_context::epoch(ctx),
            source: 1, // amm
        };
        vector::push_back(&mut oracle.price_history, price_point);

        if (new_price > oracle.high_24h) {
            oracle.high_24h = new_price;
        };
        if (new_price < oracle.low_24h) {
            oracle.low_24h = new_price;
        };

        oracle.price_volatility = calculate_volatility(old_price, new_price);

        event::emit(PriceUpdated {
            token_id: oracle.token_id,
            old_price,
            new_price,
            source: 1,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Record trade for VWAP calculation
    public fun record_trade(
        oracle: &mut PriceOracle,
        price: u64,
        volume: u64,
        ctx: &mut TxContext
    ) {
        let trade = TradeData {
            price,
            volume,
            timestamp: tx_context::epoch(ctx),
        };
        vector::push_back(&mut oracle.trade_history, trade);

        // Recalculate VWAP if enough trades
        if (vector::length(&oracle.trade_history) >= MINIMUM_TRADES_FOR_VWAP) {
            calculate_vwap(oracle, ctx);
        };
    }

    /// Calculate volume-weighted average price
    fun calculate_vwap(
        oracle: &mut PriceOracle,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        let cutoff_epoch = if (current_epoch > 24) { current_epoch - 24 } else { 0 };

        let total_value: u64 = 0;
        let total_volume: u64 = 0;
        let trade_count: u64 = 0;

        let i = 0;
        let len = vector::length(&oracle.trade_history);
        
        while (i < len) {
            let trade = vector::borrow(&oracle.trade_history, i);
            if (trade.timestamp >= cutoff_epoch) {
                total_value = total_value + (trade.price * trade.volume);
                total_volume = total_volume + trade.volume;
                trade_count = trade_count + 1;
            };
            i = i + 1;
        };

        if (total_volume > 0) {
            oracle.vwap_24h = total_value / total_volume;

            event::emit(VWAPCalculated {
                token_id: oracle.token_id,
                vwap: oracle.vwap_24h,
                trade_count,
                total_volume,
                timestamp: current_epoch,
            });
        };
    }

    /// Calculate price volatility
    fun calculate_volatility(old_price: u64, new_price: u64): u64 {
        if (old_price == 0) { return 0 };
        
        let change = if (new_price > old_price) {
            new_price - old_price
        } else {
            old_price - new_price
        };

        // Return volatility in basis points
        (change * 10000) / old_price
    }

    /// Get fair value (weighted average of sources)
    public fun get_fair_value(oracle: &PriceOracle): u64 {
        // Weight: 50% current price, 30% VWAP, 20% mid-price
        let mid_price = (oracle.high_24h + oracle.low_24h) / 2;
        
        let weighted_price = (oracle.current_price * 50) + 
                            (oracle.vwap_24h * 30) + 
                            (mid_price * 20);
        
        weighted_price / 100
    }

    /// Clean old price history
    public fun clean_old_data(
        oracle: &mut PriceOracle,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        let cutoff_epoch = if (current_epoch > MAX_PRICE_AGE) { 
            current_epoch - MAX_PRICE_AGE 
        } else { 
            0 
        };

        // Remove old price points
        let new_history = vector::empty<PricePoint>();
        let i = 0;
        let len = vector::length(&oracle.price_history);
        
        while (i < len) {
            let point = vector::borrow(&oracle.price_history, i);
            if (point.timestamp >= cutoff_epoch) {
                vector::push_back(&mut new_history, *point);
            };
            i = i + 1;
        };
        
        oracle.price_history = new_history;

        // Remove old trades
        let new_trades = vector::empty<TradeData>();
        let j = 0;
        let trade_len = vector::length(&oracle.trade_history);
        
        while (j < trade_len) {
            let trade = vector::borrow(&oracle.trade_history, j);
            if (trade.timestamp >= cutoff_epoch) {
                vector::push_back(&mut new_trades, *trade);
            };
            j = j + 1;
        };
        
        oracle.trade_history = new_trades;
    }

    // ==================== View Functions ====================

    public fun get_current_price(oracle: &PriceOracle): u64 {
        oracle.current_price
    }

    public fun get_vwap(oracle: &PriceOracle): u64 {
        oracle.vwap_24h
    }

    public fun get_high_low(oracle: &PriceOracle): (u64, u64) {
        (oracle.high_24h, oracle.low_24h)
    }

    public fun get_volatility(oracle: &PriceOracle): u64 {
        oracle.price_volatility
    }

    public fun is_price_stale(oracle: &PriceOracle, current_epoch: u64): bool {
        (current_epoch - oracle.last_update) > MAX_PRICE_AGE
    }

    public fun get_price_history_length(oracle: &PriceOracle): u64 {
        vector::length(&oracle.price_history)
    }
}
