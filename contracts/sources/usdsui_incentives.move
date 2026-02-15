/**
 * USDSui Incentives Module
 * 
 * Manages USDSui-specific incentives for TVL growth including
 * gas sponsorship and zero-fee withdrawals.
 * 
 * Requirements: 5.2, 12.5
 */

module credit_os::usdsui_incentives {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    /// Error codes
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;

    /// USDSuiIncentivePool manages TVL growth incentives
    struct USDSuiIncentivePool has key {
        id: UID,
        total_tvl: u64,
        gas_sponsorship_fund: Balance<SUI>,
        total_gas_sponsored: u64,
        total_withdrawals: u64,
        total_users: u64,
        created_at: u64,
        last_updated: u64
    }

    /// USDSuiWithdrawal represents a zero-fee withdrawal
    struct USDSuiWithdrawal has key, store {
        id: UID,
        user_account_id: ID,
        amount: u64,
        gas_sponsored: bool,
        fee_amount: u64, // always 0 for USDSui
        tvl_contribution: u64,
        created_at: u64
    }

    /// Events
    struct IncentivePoolCreated has copy, drop {
        pool_id: ID,
        initial_fund: u64,
        timestamp: u64
    }

    struct USDSuiWithdrawalProcessed has copy, drop {
        withdrawal_id: ID,
        user_account_id: ID,
        amount: u64,
        gas_sponsored: bool,
        tvl_after: u64,
        timestamp: u64
    }

    struct TVLUpdated has copy, drop {
        pool_id: ID,
        previous_tvl: u64,
        new_tvl: u64,
        change: u64,
        timestamp: u64
    }

    struct GasSponsored has copy, drop {
        pool_id: ID,
        user_account_id: ID,
        gas_amount: u64,
        total_sponsored: u64,
        timestamp: u64
    }

    /// Initialize USDSui incentive pool
    public entry fun create_incentive_pool(
        initial_fund: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let fund_amount = coin::value(&initial_fund);
        
        let pool = USDSuiIncentivePool {
            id: object::new(ctx),
            total_tvl: 0,
            gas_sponsorship_fund: coin::into_balance(initial_fund),
            total_gas_sponsored: 0,
            total_withdrawals: 0,
            total_users: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            last_updated: tx_context::epoch_timestamp_ms(ctx)
        };

        let pool_id = object::id(&pool);

        event::emit(IncentivePoolCreated {
            pool_id,
            initial_fund: fund_amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });

        transfer::share_object(pool);
    }

    /// Process USDSui withdrawal with zero fees and gas sponsorship
    public entry fun process_usdsui_withdrawal(
        pool: &mut USDSuiIncentivePool,
        user_account_id: ID,
        amount: u64,
        gas_amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(balance::value(&pool.gas_sponsorship_fund) >= gas_amount, E_INSUFFICIENT_BALANCE);

        let current_time = tx_context::epoch_timestamp_ms(ctx);

        // Sponsor gas from pool
        let gas_coin = coin::take(&mut pool.gas_sponsorship_fund, gas_amount, ctx);
        transfer::public_transfer(gas_coin, tx_context::sender(ctx));

        // Create withdrawal record
        let withdrawal = USDSuiWithdrawal {
            id: object::new(ctx),
            user_account_id,
            amount,
            gas_sponsored: true,
            fee_amount: 0, // Always zero for USDSui
            tvl_contribution: amount,
            created_at: current_time
        };

        let withdrawal_id = object::id(&withdrawal);

        // Update pool stats
        pool.total_gas_sponsored = pool.total_gas_sponsored + gas_amount;
        pool.total_withdrawals = pool.total_withdrawals + 1;
        pool.last_updated = current_time;

        event::emit(GasSponsored {
            pool_id: object::id(pool),
            user_account_id,
            gas_amount,
            total_sponsored: pool.total_gas_sponsored,
            timestamp: current_time
        });

        event::emit(USDSuiWithdrawalProcessed {
            withdrawal_id,
            user_account_id,
            amount,
            gas_sponsored: true,
            tvl_after: pool.total_tvl,
            timestamp: current_time
        });

        transfer::public_transfer(withdrawal, tx_context::sender(ctx));
    }

    /// Update TVL when USDSui is deposited
    public entry fun update_tvl(
        pool: &mut USDSuiIncentivePool,
        amount: u64,
        is_deposit: bool,
        ctx: &mut TxContext
    ) {
        let previous_tvl = pool.total_tvl;
        
        if (is_deposit) {
            pool.total_tvl = pool.total_tvl + amount;
        } else {
            assert!(pool.total_tvl >= amount, E_INSUFFICIENT_BALANCE);
            pool.total_tvl = pool.total_tvl - amount;
        };

        let change = if (is_deposit) { amount } else { amount };

        pool.last_updated = tx_context::epoch_timestamp_ms(ctx);

        event::emit(TVLUpdated {
            pool_id: object::id(pool),
            previous_tvl,
            new_tvl: pool.total_tvl,
            change,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Add funds to gas sponsorship pool
    public entry fun add_gas_fund(
        pool: &mut USDSuiIncentivePool,
        fund: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let fund_amount = coin::value(&fund);
        balance::join(&mut pool.gas_sponsorship_fund, coin::into_balance(fund));
        pool.last_updated = tx_context::epoch_timestamp_ms(ctx);
    }

    /// Increment user count
    public entry fun increment_user_count(
        pool: &mut USDSuiIncentivePool,
        ctx: &mut TxContext
    ) {
        pool.total_users = pool.total_users + 1;
        pool.last_updated = tx_context::epoch_timestamp_ms(ctx);
    }

    /// Getters
    public fun get_total_tvl(pool: &USDSuiIncentivePool): u64 {
        pool.total_tvl
    }

    public fun get_gas_fund_balance(pool: &USDSuiIncentivePool): u64 {
        balance::value(&pool.gas_sponsorship_fund)
    }

    public fun get_total_gas_sponsored(pool: &USDSuiIncentivePool): u64 {
        pool.total_gas_sponsored
    }

    public fun get_total_withdrawals(pool: &USDSuiIncentivePool): u64 {
        pool.total_withdrawals
    }

    public fun get_total_users(pool: &USDSuiIncentivePool): u64 {
        pool.total_users
    }
}
