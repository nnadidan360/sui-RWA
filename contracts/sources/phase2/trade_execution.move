// PHASE 2: Asset Tokenization and Fractionalization
// Task 17.1 - Trade Execution Engine
// Order matching and settlement logic

module credit_os::trade_execution {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::vector;

    // ==================== Error Codes ====================
    const E_NO_MATCH: u64 = 1;
    const E_INVALID_ORDERS: u64 = 2;
    const E_PRICE_MISMATCH: u64 = 3;

    // ==================== Structs ====================

    /// Matching engine state
    struct MatchingEngine has key {
        id: UID,
        token_id: ID,
        
        // Matching statistics
        total_matches: u64,
        total_volume: u64,
        
        // Performance metrics
        average_match_time: u64,
        last_match_timestamp: u64,
        
        created_at: u64,
    }

    /// Order match result
    struct OrderMatch has store {
        buy_order_id: ID,
        sell_order_id: ID,
        match_price: u64,
        match_amount: u64,
        timestamp: u64,
    }

    /// Settlement instruction
    struct SettlementInstruction has key, store {
        id: UID,
        token_id: ID,
        buyer: address,
        seller: address,
        token_amount: u64,
        payment_amount: u64,
        fee_amount: u64,
        status: u8, // 0=pending, 1=completed, 2=failed
        created_at: u64,
    }

    // ==================== Events ====================

    struct OrdersMatched has copy, drop {
        token_id: ID,
        buy_order_id: ID,
        sell_order_id: ID,
        price: u64,
        amount: u64,
        timestamp: u64,
    }

    struct SettlementCompleted has copy, drop {
        settlement_id: ID,
        token_id: ID,
        buyer: address,
        seller: address,
        amount: u64,
        timestamp: u64,
    }

    struct SettlementFailed has copy, drop {
        settlement_id: ID,
        reason: vector<u8>,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create matching engine
    public fun create_matching_engine(
        token_id: ID,
        ctx: &mut TxContext
    ): MatchingEngine {
        MatchingEngine {
            id: object::new(ctx),
            token_id,
            total_matches: 0,
            total_volume: 0,
            average_match_time: 0,
            last_match_timestamp: 0,
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Match buy and sell orders
    public fun match_orders(
        engine: &mut MatchingEngine,
        buy_order_id: ID,
        buy_price: u64,
        buy_amount: u64,
        sell_order_id: ID,
        sell_price: u64,
        sell_amount: u64,
        ctx: &mut TxContext
    ): OrderMatch {
        // Verify price compatibility (buy price >= sell price)
        assert!(buy_price >= sell_price, E_PRICE_MISMATCH);

        // Calculate match amount (minimum of both orders)
        let match_amount = if (buy_amount < sell_amount) {
            buy_amount
        } else {
            sell_amount
        };

        // Use sell price for execution (price improvement for buyer)
        let match_price = sell_price;

        // Update engine statistics
        engine.total_matches = engine.total_matches + 1;
        engine.total_volume = engine.total_volume + (match_price * match_amount);
        engine.last_match_timestamp = tx_context::epoch(ctx);

        // Emit event
        event::emit(OrdersMatched {
            token_id: engine.token_id,
            buy_order_id,
            sell_order_id,
            price: match_price,
            amount: match_amount,
            timestamp: tx_context::epoch(ctx),
        });

        OrderMatch {
            buy_order_id,
            sell_order_id,
            match_price,
            match_amount,
            timestamp: tx_context::epoch(ctx),
        }
    }

    /// Create settlement instruction
    public fun create_settlement(
        token_id: ID,
        buyer: address,
        seller: address,
        token_amount: u64,
        payment_amount: u64,
        fee_amount: u64,
        ctx: &mut TxContext
    ): SettlementInstruction {
        SettlementInstruction {
            id: object::new(ctx),
            token_id,
            buyer,
            seller,
            token_amount,
            payment_amount,
            fee_amount,
            status: 0, // pending
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Complete settlement
    public fun complete_settlement(
        settlement: &mut SettlementInstruction,
        ctx: &mut TxContext
    ) {
        settlement.status = 1; // completed

        event::emit(SettlementCompleted {
            settlement_id: object::id(settlement),
            token_id: settlement.token_id,
            buyer: settlement.buyer,
            seller: settlement.seller,
            amount: settlement.token_amount,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Fail settlement
    public fun fail_settlement(
        settlement: &mut SettlementInstruction,
        reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        settlement.status = 2; // failed

        event::emit(SettlementFailed {
            settlement_id: object::id(settlement),
            reason,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Find best matching orders (simplified matching algorithm)
    public fun find_best_match(
        buy_prices: vector<u64>,
        buy_amounts: vector<u64>,
        sell_prices: vector<u64>,
        sell_amounts: vector<u64>
    ): (bool, u64, u64) {
        let buy_len = vector::length(&buy_prices);
        let sell_len = vector::length(&sell_prices);

        if (buy_len == 0 || sell_len == 0) {
            return (false, 0, 0)
        };

        // Find highest buy price
        let best_buy_idx = 0;
        let best_buy_price = *vector::borrow(&buy_prices, 0);
        let i = 1;
        while (i < buy_len) {
            let price = *vector::borrow(&buy_prices, i);
            if (price > best_buy_price) {
                best_buy_price = price;
                best_buy_idx = i;
            };
            i = i + 1;
        };

        // Find lowest sell price
        let best_sell_idx = 0;
        let best_sell_price = *vector::borrow(&sell_prices, 0);
        let j = 1;
        while (j < sell_len) {
            let price = *vector::borrow(&sell_prices, j);
            if (price < best_sell_price) {
                best_sell_price = price;
                best_sell_idx = j;
            };
            j = j + 1;
        };

        // Check if match is possible
        if (best_buy_price >= best_sell_price) {
            (true, best_buy_idx, best_sell_idx)
        } else {
            (false, 0, 0)
        }
    }

    // ==================== View Functions ====================

    public fun get_total_matches(engine: &MatchingEngine): u64 {
        engine.total_matches
    }

    public fun get_total_volume(engine: &MatchingEngine): u64 {
        engine.total_volume
    }

    public fun get_settlement_status(settlement: &SettlementInstruction): u8 {
        settlement.status
    }

    public fun get_settlement_details(settlement: &SettlementInstruction): (address, address, u64, u64) {
        (settlement.buyer, settlement.seller, settlement.token_amount, settlement.payment_amount)
    }
}
