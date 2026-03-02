// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.1 - Ownership Tracker
// Tracks fractional ownership and manages holder registry

module credit_os::ownership_tracker {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::table::{Self, Table};
    use std::vector;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_HOLDER_NOT_FOUND: u64 = 2;
    const E_INVALID_BALANCE: u64 = 3;
    const E_DUPLICATE_HOLDER: u64 = 4;

    // ==================== Structs ====================

    /// Global ownership registry for a token
    struct OwnershipRegistry has key {
        id: UID,
        token_id: ID,
        
        // Holder tracking
        holders: Table<address, HolderRecord>,
        holder_list: vector<address>,
        total_holders: u64,
        
        // Ownership distribution
        total_supply: u64,
        circulating_supply: u64,
        
        // Concentration metrics
        top_holder_balance: u64,
        top_holder_address: address,
        
        // Activity tracking
        total_transfers: u64,
        last_transfer: u64,
        
        created_at: u64,
    }

    /// Individual holder record
    struct HolderRecord has store {
        balance: u64,
        percentage: u64, // Basis points (10000 = 100%)
        first_acquired: u64,
        last_transaction: u64,
        total_received: u64,
        total_sent: u64,
        transaction_count: u64,
    }

    /// Ownership snapshot for historical tracking
    struct OwnershipSnapshot has key, store {
        id: UID,
        token_id: ID,
        timestamp: u64,
        total_holders: u64,
        top_10_holders: vector<address>,
        top_10_balances: vector<u64>,
        concentration_index: u64, // Herfindahl index
    }

    /// Transfer record for audit trail
    struct TransferRecord has key, store {
        id: UID,
        token_id: ID,
        from: address,
        to: address,
        amount: u64,
        timestamp: u64,
        transaction_type: u8, // 0=transfer, 1=mint, 2=burn
    }

    // ==================== Events ====================

    struct HolderAdded has copy, drop {
        token_id: ID,
        holder: address,
        initial_balance: u64,
        timestamp: u64,
    }

    struct HolderRemoved has copy, drop {
        token_id: ID,
        holder: address,
        final_balance: u64,
        timestamp: u64,
    }

    struct OwnershipTransferred has copy, drop {
        token_id: ID,
        from: address,
        to: address,
        amount: u64,
        timestamp: u64,
    }

    struct TopHolderChanged has copy, drop {
        token_id: ID,
        new_top_holder: address,
        balance: u64,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create ownership registry
    public fun create_registry(
        token_id: ID,
        total_supply: u64,
        ctx: &mut TxContext
    ): OwnershipRegistry {
        OwnershipRegistry {
            id: object::new(ctx),
            token_id,
            holders: table::new(ctx),
            holder_list: vector::empty(),
            total_holders: 0,
            total_supply,
            circulating_supply: 0,
            top_holder_balance: 0,
            top_holder_address: @0x0,
            total_transfers: 0,
            last_transfer: 0,
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Add new holder
    public fun add_holder(
        registry: &mut OwnershipRegistry,
        holder: address,
        initial_balance: u64,
        ctx: &mut TxContext
    ) {
        assert!(!table::contains(&registry.holders, holder), E_DUPLICATE_HOLDER);
        assert!(initial_balance > 0, E_INVALID_BALANCE);

        let percentage = calculate_percentage(initial_balance, registry.total_supply);

        let record = HolderRecord {
            balance: initial_balance,
            percentage,
            first_acquired: tx_context::epoch(ctx),
            last_transaction: tx_context::epoch(ctx),
            total_received: initial_balance,
            total_sent: 0,
            transaction_count: 1,
        };

        table::add(&mut registry.holders, holder, record);
        vector::push_back(&mut registry.holder_list, holder);
        registry.total_holders = registry.total_holders + 1;
        registry.circulating_supply = registry.circulating_supply + initial_balance;

        // Check if new top holder
        if (initial_balance > registry.top_holder_balance) {
            registry.top_holder_balance = initial_balance;
            registry.top_holder_address = holder;

            event::emit(TopHolderChanged {
                token_id: registry.token_id,
                new_top_holder: holder,
                balance: initial_balance,
                timestamp: tx_context::epoch(ctx),
            });
        };

        event::emit(HolderAdded {
            token_id: registry.token_id,
            holder,
            initial_balance,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Update holder balance
    public fun update_holder_balance(
        registry: &mut OwnershipRegistry,
        holder: address,
        new_balance: u64,
        is_increase: bool,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.holders, holder), E_HOLDER_NOT_FOUND);

        let record = table::borrow_mut(&mut registry.holders, holder);
        let old_balance = record.balance;

        record.balance = new_balance;
        record.percentage = calculate_percentage(new_balance, registry.total_supply);
        record.last_transaction = tx_context::epoch(ctx);
        record.transaction_count = record.transaction_count + 1;

        if (is_increase) {
            record.total_received = record.total_received + (new_balance - old_balance);
        } else {
            record.total_sent = record.total_sent + (old_balance - new_balance);
        };

        // Update top holder if needed
        if (new_balance > registry.top_holder_balance) {
            registry.top_holder_balance = new_balance;
            registry.top_holder_address = holder;

            event::emit(TopHolderChanged {
                token_id: registry.token_id,
                new_top_holder: holder,
                balance: new_balance,
                timestamp: tx_context::epoch(ctx),
            });
        };

        // Remove holder if balance is zero
        if (new_balance == 0) {
            remove_holder(registry, holder, ctx);
        };
    }

    /// Record transfer between holders
    public fun record_transfer(
        registry: &mut OwnershipRegistry,
        from: address,
        to: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Update sender
        if (table::contains(&registry.holders, from)) {
            let from_record = table::borrow_mut(&mut registry.holders, from);
            assert!(from_record.balance >= amount, E_INVALID_BALANCE);
            from_record.balance = from_record.balance - amount;
            from_record.total_sent = from_record.total_sent + amount;
            from_record.last_transaction = tx_context::epoch(ctx);
            from_record.transaction_count = from_record.transaction_count + 1;

            if (from_record.balance == 0) {
                remove_holder(registry, from, ctx);
            };
        };

        // Update or add recipient
        if (table::contains(&registry.holders, to)) {
            let to_record = table::borrow_mut(&mut registry.holders, to);
            to_record.balance = to_record.balance + amount;
            to_record.percentage = calculate_percentage(to_record.balance, registry.total_supply);
            to_record.total_received = to_record.total_received + amount;
            to_record.last_transaction = tx_context::epoch(ctx);
            to_record.transaction_count = to_record.transaction_count + 1;
        } else {
            add_holder(registry, to, amount, ctx);
        };

        registry.total_transfers = registry.total_transfers + 1;
        registry.last_transfer = tx_context::epoch(ctx);

        event::emit(OwnershipTransferred {
            token_id: registry.token_id,
            from,
            to,
            amount,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Remove holder
    fun remove_holder(
        registry: &mut OwnershipRegistry,
        holder: address,
        ctx: &mut TxContext
    ) {
        if (table::contains(&registry.holders, holder)) {
            let record = table::remove(&mut registry.holders, holder);
            
            // Remove from holder list
            let (found, index) = vector::index_of(&registry.holder_list, &holder);
            if (found) {
                vector::remove(&mut registry.holder_list, index);
            };

            registry.total_holders = registry.total_holders - 1;
            registry.circulating_supply = registry.circulating_supply - record.balance;

            event::emit(HolderRemoved {
                token_id: registry.token_id,
                holder,
                final_balance: record.balance,
                timestamp: tx_context::epoch(ctx),
            });
        };
    }

    /// Create ownership snapshot
    public fun create_snapshot(
        registry: &OwnershipRegistry,
        ctx: &mut TxContext
    ): OwnershipSnapshot {
        let top_10_holders = vector::empty<address>();
        let top_10_balances = vector::empty<u64>();

        // Get top 10 holders (simplified - in production use proper sorting)
        let i = 0;
        let len = vector::length(&registry.holder_list);
        while (i < len && i < 10) {
            let holder = *vector::borrow(&registry.holder_list, i);
            if (table::contains(&registry.holders, holder)) {
                let record = table::borrow(&registry.holders, holder);
                vector::push_back(&mut top_10_holders, holder);
                vector::push_back(&mut top_10_balances, record.balance);
            };
            i = i + 1;
        };

        OwnershipSnapshot {
            id: object::new(ctx),
            token_id: registry.token_id,
            timestamp: tx_context::epoch(ctx),
            total_holders: registry.total_holders,
            top_10_holders,
            top_10_balances,
            concentration_index: calculate_concentration(registry),
        }
    }

    // ==================== Helper Functions ====================

    fun calculate_percentage(balance: u64, total_supply: u64): u64 {
        if (total_supply == 0) { return 0 };
        (balance * 10000) / total_supply
    }

    fun calculate_concentration(registry: &OwnershipRegistry): u64 {
        // Simplified Herfindahl index calculation
        if (registry.total_holders == 0) { return 0 };
        
        let top_holder_share = (registry.top_holder_balance * 10000) / registry.total_supply;
        top_holder_share
    }

    // ==================== View Functions ====================

    public fun get_holder_balance(registry: &OwnershipRegistry, holder: address): u64 {
        if (table::contains(&registry.holders, holder)) {
            let record = table::borrow(&registry.holders, holder);
            record.balance
        } else {
            0
        }
    }

    public fun get_holder_percentage(registry: &OwnershipRegistry, holder: address): u64 {
        if (table::contains(&registry.holders, holder)) {
            let record = table::borrow(&registry.holders, holder);
            record.percentage
        } else {
            0
        }
    }

    public fun get_total_holders(registry: &OwnershipRegistry): u64 {
        registry.total_holders
    }

    public fun get_top_holder(registry: &OwnershipRegistry): (address, u64) {
        (registry.top_holder_address, registry.top_holder_balance)
    }

    public fun is_holder(registry: &OwnershipRegistry, address: address): bool {
        table::contains(&registry.holders, address)
    }
}
