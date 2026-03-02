// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Dividend Distribution System
// Automated income distribution for fractional token holders

module credit_os::dividend_pool {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use std::vector;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_NO_DIVIDENDS_AVAILABLE: u64 = 3;
    const E_ALREADY_CLAIMED: u64 = 4;
    const E_INVALID_AMOUNT: u64 = 5;

    // ==================== Constants ====================
    const MINIMUM_DISTRIBUTION: u64 = 1000000000; // 1 SUI minimum
    const CLAIM_PERIOD_EPOCHS: u64 = 30; // 30 epochs to claim

    // ==================== Structs ====================

    /// Dividend pool for a fractional asset token
    struct DividendPool has key {
        id: UID,
        token_id: ID,
        total_deposited: Balance<SUI>,
        total_distributed: u64,
        total_claimed: u64,
        distribution_count: u64,
        last_distribution: u64,
        total_holders: u64,
        auto_distribute: bool,
        minimum_distribution: u64,
        created_at: u64,
    }

    /// Individual dividend distribution
    struct DividendDistribution has key, store {
        id: UID,
        pool_id: ID,
        distribution_number: u64,
        total_amount: u64,
        amount_per_token: u64,
        total_supply: u64,
        total_claimed: u64,
        distributed_at: u64,
        claim_deadline: u64,
        is_active: bool,
    }

    /// Holder's claim record
    struct DividendClaim has key, store {
        id: UID,
        distribution_id: ID,
        holder: address,
        token_balance: u64,
        claimable_amount: u64,
        claimed_at: u64,
        is_claimed: bool,
    }

    // ==================== Events ====================

    struct DividendDeposited has copy, drop {
        pool_id: ID,
        amount: u64,
        timestamp: u64,
    }

    struct DividendDistributed has copy, drop {
        pool_id: ID,
        distribution_id: ID,
        total_amount: u64,
        amount_per_token: u64,
        timestamp: u64,
    }

    struct DividendClaimed has copy, drop {
        distribution_id: ID,
        holder: address,
        amount: u64,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create dividend pool
    public fun create_pool(
        token_id: ID,
        ctx: &mut TxContext
    ): DividendPool {
        DividendPool {
            id: object::new(ctx),
            token_id,
            total_deposited: balance::zero(),
            total_distributed: 0,
            total_claimed: 0,
            distribution_count: 0,
            last_distribution: 0,
            total_holders: 0,
            auto_distribute: false,
            minimum_distribution: MINIMUM_DISTRIBUTION,
            created_at: tx_context::epoch(ctx),
        }
    }

    /// Deposit dividends to pool
    public entry fun deposit_dividend(
        pool: &mut DividendPool,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, E_INVALID_AMOUNT);

        balance::join(&mut pool.total_deposited, coin::into_balance(payment));

        event::emit(DividendDeposited {
            pool_id: object::id(pool),
            amount,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Create distribution
    public fun create_distribution(
        pool: &mut DividendPool,
        total_supply: u64,
        ctx: &mut TxContext
    ): DividendDistribution {
        let available = balance::value(&pool.total_deposited);
        assert!(available >= pool.minimum_distribution, E_NO_DIVIDENDS_AVAILABLE);

        let amount_per_token = available / total_supply;
        pool.distribution_count = pool.distribution_count + 1;
        pool.total_distributed = pool.total_distributed + available;
        pool.last_distribution = tx_context::epoch(ctx);

        let distribution = DividendDistribution {
            id: object::new(ctx),
            pool_id: object::id(pool),
            distribution_number: pool.distribution_count,
            total_amount: available,
            amount_per_token,
            total_supply,
            total_claimed: 0,
            distributed_at: tx_context::epoch(ctx),
            claim_deadline: tx_context::epoch(ctx) + CLAIM_PERIOD_EPOCHS,
            is_active: true,
        };

        let distribution_id = object::id(&distribution);

        event::emit(DividendDistributed {
            pool_id: object::id(pool),
            distribution_id,
            total_amount: available,
            amount_per_token,
            timestamp: tx_context::epoch(ctx),
        });

        distribution
    }

    /// Claim dividends
    public entry fun claim_dividend(
        pool: &mut DividendPool,
        distribution: &mut DividendDistribution,
        claim: DividendClaim,
        ctx: &mut TxContext
    ) {
        assert!(distribution.is_active, E_NOT_AUTHORIZED);
        assert!(!claim.is_claimed, E_ALREADY_CLAIMED);
        assert!(tx_context::epoch(ctx) <= distribution.claim_deadline, E_NOT_AUTHORIZED);

        let DividendClaim {
            id: claim_id,
            distribution_id: _,
            holder,
            token_balance: _,
            claimable_amount,
            claimed_at: _,
            is_claimed: _,
        } = claim;

        object::delete(claim_id);

        // Withdraw from pool
        let payout = coin::take(&mut pool.total_deposited, claimable_amount, ctx);
        
        pool.total_claimed = pool.total_claimed + claimable_amount;
        distribution.total_claimed = distribution.total_claimed + claimable_amount;

        event::emit(DividendClaimed {
            distribution_id: object::id(distribution),
            holder,
            amount: claimable_amount,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::public_transfer(payout, holder);
    }

    /// Create claim for holder
    public fun create_claim(
        distribution_id: ID,
        holder: address,
        token_balance: u64,
        amount_per_token: u64,
        ctx: &mut TxContext
    ): DividendClaim {
        let claimable = token_balance * amount_per_token;

        DividendClaim {
            id: object::new(ctx),
            distribution_id,
            holder,
            token_balance,
            claimable_amount: claimable,
            claimed_at: 0,
            is_claimed: false,
        }
    }

    // ==================== View Functions ====================

    public fun get_pool_balance(pool: &DividendPool): u64 {
        balance::value(&pool.total_deposited)
    }

    public fun get_total_distributed(pool: &DividendPool): u64 {
        pool.total_distributed
    }

    public fun get_distribution_count(pool: &DividendPool): u64 {
        pool.distribution_count
    }
}
