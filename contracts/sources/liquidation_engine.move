/// Liquidation Engine module for Credit OS
/// Provides automated liquidation execution for unhealthy crypto vaults
module credit_os::liquidation_engine {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use credit_os::crypto_vault::{Self, CryptoVaultObject};
    use credit_os::price_feed::{Self, PriceFeed};

    /// Error codes
    const ELiquidationNotAllowed: u64 = 1;
    const EPriceValidationFailed: u64 = 2;
    const EInsufficientCollateral: u64 = 3;
    const ELiquidationAlreadyInProgress: u64 = 4;

    /// Liquidation penalty (in basis points, 500 = 5%)
    const LIQUIDATION_PENALTY: u64 = 500;

    /// Liquidation record
    struct LiquidationRecord has key, store {
        id: UID,
        vault_id: address,
        liquidator: address,
        collateral_seized_usd: u64,
        debt_repaid_usd: u64,
        penalty_amount_usd: u64,
        excess_returned_usd: u64,
        executed_at: u64,
        ltv_at_liquidation: u64,
    }

    /// Liquidation queue entry
    struct LiquidationQueueEntry has store {
        vault_id: address,
        ltv: u64,
        collateral_value: u64,
        queued_at: u64,
        priority: u64, // Higher LTV = higher priority
    }

    /// Liquidation queue
    struct LiquidationQueue has key {
        id: UID,
        entries: vector<LiquidationQueueEntry>,
        total_queued: u64,
    }

    /// Events
    struct LiquidationExecuted has copy, drop {
        vault_id: address,
        liquidator: address,
        collateral_seized: u64,
        debt_repaid: u64,
        penalty: u64,
        excess_returned: u64,
        timestamp: u64,
    }

    struct LiquidationQueued has copy, drop {
        vault_id: address,
        ltv: u64,
        priority: u64,
        timestamp: u64,
    }

    struct LiquidationFailed has copy, drop {
        vault_id: address,
        reason: String,
        timestamp: u64,
    }

    /// Execute liquidation on a vault
    public fun execute_liquidation(
        vault: &mut CryptoVaultObject,
        price_feed: &PriceFeed,
        liquidator: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): LiquidationRecord {
        let current_time = clock::timestamp_ms(clock);

        // Validate price feed
        let (price, is_valid) = price_feed::get_validated_price(price_feed, clock, ctx);
        assert!(is_valid, EPriceValidationFailed);

        // Check if vault can be liquidated
        assert!(crypto_vault::can_liquidate(vault), ELiquidationNotAllowed);

        let ltv = crypto_vault::get_current_ltv(vault);
        let collateral_value = crypto_vault::get_total_collateral_value(vault);
        let debt_amount = crypto_vault::get_borrowed_amount(vault);

        // Calculate liquidation amounts
        let penalty_amount = (debt_amount * LIQUIDATION_PENALTY) / 10000;
        let total_to_repay = debt_amount + penalty_amount;
        
        // Calculate collateral to seize
        let collateral_seized = if (total_to_repay > collateral_value) {
            collateral_value
        } else {
            total_to_repay
        };

        // Calculate excess to return to user
        let excess_returned = if (collateral_value > total_to_repay) {
            collateral_value - total_to_repay
        } else {
            0
        };

        // Start liquidation on vault
        crypto_vault::start_liquidation(vault, clock, ctx);

        let vault_id = object::uid_to_address(&vault.id);

        // Create liquidation record
        let record = LiquidationRecord {
            id: object::new(ctx),
            vault_id,
            liquidator,
            collateral_seized_usd: collateral_seized,
            debt_repaid_usd: debt_amount,
            penalty_amount_usd: penalty_amount,
            excess_returned_usd: excess_returned,
            executed_at: current_time,
            ltv_at_liquidation: ltv,
        };

        sui::event::emit(LiquidationExecuted {
            vault_id,
            liquidator,
            collateral_seized,
            debt_repaid: debt_amount,
            penalty: penalty_amount,
            excess_returned,
            timestamp: current_time,
        });

        record
    }

    /// Add vault to liquidation queue
    public fun queue_for_liquidation(
        queue: &mut LiquidationQueue,
        vault_id: address,
        ltv: u64,
        collateral_value: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        // Priority is based on LTV (higher LTV = higher priority)
        let priority = ltv;

        let entry = LiquidationQueueEntry {
            vault_id,
            ltv,
            collateral_value,
            queued_at: current_time,
            priority,
        };

        // Insert in priority order (simple append for now)
        vector::push_back(&mut queue.entries, entry);
        queue.total_queued = queue.total_queued + 1;

        sui::event::emit(LiquidationQueued {
            vault_id,
            ltv,
            priority,
            timestamp: current_time,
        });
    }

    /// Remove vault from liquidation queue
    public fun remove_from_queue(
        queue: &mut LiquidationQueue,
        vault_id: address,
        _ctx: &mut TxContext
    ) {
        let entries = &mut queue.entries;
        let len = vector::length(entries);
        let mut i = 0;

        while (i < len) {
            let entry = vector::borrow(entries, i);
            if (entry.vault_id == vault_id) {
                vector::remove(entries, i);
                queue.total_queued = queue.total_queued - 1;
                break
            };
            i = i + 1;
        };
    }

    /// Get next vault to liquidate (highest priority)
    public fun get_next_liquidation(queue: &LiquidationQueue): (address, u64) {
        let entries = &queue.entries;
        let len = vector::length(entries);

        if (len == 0) {
            return (object::id_from_address(@0x0), 0)
        };

        let mut highest_priority = 0u64;
        let mut highest_index = 0u64;
        let mut i = 0;

        while (i < len) {
            let entry = vector::borrow(entries, i);
            if (entry.priority > highest_priority) {
                highest_priority = entry.priority;
                highest_index = i;
            };
            i = i + 1;
        };

        let entry = vector::borrow(entries, highest_index);
        (entry.vault_id, entry.ltv)
    }

    /// Calculate liquidation amounts
    public fun calculate_liquidation_amounts(
        collateral_value: u64,
        debt_amount: u64
    ): (u64, u64, u64) {
        let penalty = (debt_amount * LIQUIDATION_PENALTY) / 10000;
        let total_to_repay = debt_amount + penalty;
        
        let collateral_seized = if (total_to_repay > collateral_value) {
            collateral_value
        } else {
            total_to_repay
        };

        let excess = if (collateral_value > total_to_repay) {
            collateral_value - total_to_repay
        } else {
            0
        };

        (collateral_seized, penalty, excess)
    }

    /// Create liquidation queue
    public fun create_liquidation_queue(ctx: &mut TxContext): LiquidationQueue {
        LiquidationQueue {
            id: object::new(ctx),
            entries: vector::empty(),
            total_queued: 0,
        }
    }

    // === Getter functions ===

    /// Get liquidation penalty
    public fun get_liquidation_penalty(): u64 {
        LIQUIDATION_PENALTY
    }

    /// Get queue size
    public fun get_queue_size(queue: &LiquidationQueue): u64 {
        queue.total_queued
    }

    /// Get liquidation record details
    public fun get_record_details(record: &LiquidationRecord): (address, u64, u64, u64, u64) {
        (
            record.vault_id,
            record.collateral_seized_usd,
            record.debt_repaid_usd,
            record.penalty_amount_usd,
            record.excess_returned_usd
        )
    }
}
