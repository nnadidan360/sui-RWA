// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.1 - Token Supply Management
// Manages divisible ownership and token supply tracking

module credit_os::token_supply {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::String;
    use std::vector;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_SUPPLY_EXHAUSTED: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_SUPPLY_LOCKED: u64 = 4;

    // ==================== Structs ====================

    /// Token supply manager for a fractional asset
    struct TokenSupplyManager has key, store {
        id: UID,
        token_id: ID,
        
        // Supply tracking
        total_supply: u64,
        circulating_supply: u64,
        reserved_supply: u64,
        burned_supply: u64,
        
        // Holder tracking
        total_holders: u64,
        holder_addresses: vector<address>,
        
        // Supply controls
        is_mintable: bool,
        is_burnable: bool,
        supply_locked: bool,
        
        // Metadata
        created_at: u64,
        last_updated: u64,
    }

    /// Holder information
    struct HolderInfo has key, store {
        id: UID,
        token_id: ID,
        holder: address,
        balance: u64,
        percentage_ownership: u64, // Basis points (10000 = 100%)
        first_acquired: u64,
        last_transaction: u64,
    }

    /// Supply snapshot for historical tracking
    struct SupplySnapshot has key, store {
        id: UID,
        token_id: ID,
        total_supply: u64,
        circulating_supply: u64,
        total_holders: u64,
        timestamp: u64,
        snapshot_reason: String,
    }

    // ==================== Events ====================

    struct SupplyIncreased has copy, drop {
        token_id: ID,
        amount: u64,
        new_total: u64,
        timestamp: u64,
    }

    struct SupplyDecreased has copy, drop {
        token_id: ID,
        amount: u64,
        new_total: u64,
        timestamp: u64,
    }

    struct HolderAdded has copy, drop {
        token_id: ID,
        holder: address,
        initial_balance: u64,
        timestamp: u64,
    }

    struct HolderRemoved has copy, drop {
        token_id: ID,
        holder: address,
        timestamp: u64,
    }

    struct SupplyLocked has copy, drop {
        token_id: ID,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create a new token supply manager
    public fun create_supply_manager(
        token_id: ID,
        total_supply: u64,
        is_mintable: bool,
        is_burnable: bool,
        ctx: &mut TxContext
    ): TokenSupplyManager {
        TokenSupplyManager {
            id: object::new(ctx),
            token_id,
            total_supply,
            circulating_supply: 0,
            reserved_supply: total_supply,
            burned_supply: 0,
            total_holders: 0,
            holder_addresses: vector::empty(),
            is_mintable,
            is_burnable,
            supply_locked: false,
            created_at: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
        }
    }

    /// Issue tokens from reserved supply
    public fun issue_from_reserve(
        manager: &mut TokenSupplyManager,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(!manager.supply_locked, E_SUPPLY_LOCKED);
        assert!(amount <= manager.reserved_supply, E_SUPPLY_EXHAUSTED);
        assert!(amount > 0, E_INVALID_AMOUNT);

        manager.reserved_supply = manager.reserved_supply - amount;
        manager.circulating_supply = manager.circulating_supply + amount;
        manager.last_updated = tx_context::epoch(ctx);

        event::emit(SupplyIncreased {
            token_id: manager.token_id,
            amount,
            new_total: manager.circulating_supply,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Mint new tokens (if allowed)
    public fun mint_tokens(
        manager: &mut TokenSupplyManager,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(manager.is_mintable, E_NOT_AUTHORIZED);
        assert!(!manager.supply_locked, E_SUPPLY_LOCKED);
        assert!(amount > 0, E_INVALID_AMOUNT);

        manager.total_supply = manager.total_supply + amount;
        manager.circulating_supply = manager.circulating_supply + amount;
        manager.last_updated = tx_context::epoch(ctx);

        event::emit(SupplyIncreased {
            token_id: manager.token_id,
            amount,
            new_total: manager.total_supply,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Burn tokens (if allowed)
    public fun burn_tokens(
        manager: &mut TokenSupplyManager,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(manager.is_burnable, E_NOT_AUTHORIZED);
        assert!(amount <= manager.circulating_supply, E_INVALID_AMOUNT);
        assert!(amount > 0, E_INVALID_AMOUNT);

        manager.circulating_supply = manager.circulating_supply - amount;
        manager.burned_supply = manager.burned_supply + amount;
        manager.last_updated = tx_context::epoch(ctx);

        event::emit(SupplyDecreased {
            token_id: manager.token_id,
            amount,
            new_total: manager.circulating_supply,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Add a new token holder
    public fun add_holder(
        manager: &mut TokenSupplyManager,
        holder: address,
        initial_balance: u64,
        ctx: &mut TxContext
    ): HolderInfo {
        manager.total_holders = manager.total_holders + 1;
        vector::push_back(&mut manager.holder_addresses, holder);
        manager.last_updated = tx_context::epoch(ctx);

        let percentage = calculate_percentage(initial_balance, manager.total_supply);

        event::emit(HolderAdded {
            token_id: manager.token_id,
            holder,
            initial_balance,
            timestamp: tx_context::epoch(ctx),
        });

        HolderInfo {
            id: object::new(ctx),
            token_id: manager.token_id,
            holder,
            balance: initial_balance,
            percentage_ownership: percentage,
            first_acquired: tx_context::epoch(ctx),
            last_transaction: tx_context::epoch(ctx),
        }
    }

    /// Update holder balance
    public fun update_holder_balance(
        holder_info: &mut HolderInfo,
        new_balance: u64,
        total_supply: u64,
        ctx: &mut TxContext
    ) {
        holder_info.balance = new_balance;
        holder_info.percentage_ownership = calculate_percentage(new_balance, total_supply);
        holder_info.last_transaction = tx_context::epoch(ctx);
    }

    /// Remove holder (when balance reaches zero)
    public fun remove_holder(
        manager: &mut TokenSupplyManager,
        holder: address,
        ctx: &mut TxContext
    ) {
        // Find and remove holder from vector
        let (found, index) = vector::index_of(&manager.holder_addresses, &holder);
        if (found) {
            vector::remove(&mut manager.holder_addresses, index);
            manager.total_holders = manager.total_holders - 1;
            manager.last_updated = tx_context::epoch(ctx);

            event::emit(HolderRemoved {
                token_id: manager.token_id,
                holder,
                timestamp: tx_context::epoch(ctx),
            });
        };
    }

    /// Lock supply (prevent further minting/burning)
    public fun lock_supply(
        manager: &mut TokenSupplyManager,
        ctx: &mut TxContext
    ) {
        manager.supply_locked = true;
        manager.last_updated = tx_context::epoch(ctx);

        event::emit(SupplyLocked {
            token_id: manager.token_id,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Create supply snapshot
    public fun create_snapshot(
        manager: &TokenSupplyManager,
        reason: String,
        ctx: &mut TxContext
    ): SupplySnapshot {
        SupplySnapshot {
            id: object::new(ctx),
            token_id: manager.token_id,
            total_supply: manager.total_supply,
            circulating_supply: manager.circulating_supply,
            total_holders: manager.total_holders,
            timestamp: tx_context::epoch(ctx),
            snapshot_reason: reason,
        }
    }

    // ==================== Helper Functions ====================

    /// Calculate percentage ownership in basis points
    fun calculate_percentage(balance: u64, total_supply: u64): u64 {
        if (total_supply == 0) {
            return 0
        };
        (balance * 10000) / total_supply
    }

    // ==================== View Functions ====================

    public fun get_total_supply(manager: &TokenSupplyManager): u64 {
        manager.total_supply
    }

    public fun get_circulating_supply(manager: &TokenSupplyManager): u64 {
        manager.circulating_supply
    }

    public fun get_reserved_supply(manager: &TokenSupplyManager): u64 {
        manager.reserved_supply
    }

    public fun get_burned_supply(manager: &TokenSupplyManager): u64 {
        manager.burned_supply
    }

    public fun get_total_holders(manager: &TokenSupplyManager): u64 {
        manager.total_holders
    }

    public fun is_supply_locked(manager: &TokenSupplyManager): bool {
        manager.supply_locked
    }

    public fun get_holder_balance(holder_info: &HolderInfo): u64 {
        holder_info.balance
    }

    public fun get_holder_percentage(holder_info: &HolderInfo): u64 {
        holder_info.percentage_ownership
    }
}
