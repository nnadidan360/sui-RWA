// PHASE 2: Asset Tokenization and Fractionalization
// Task 17.1 - AMM Pool
// Automated market making for fractional tokens

module credit_os::amm_pool {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;

    // ==================== Error Codes ====================
    const E_INSUFFICIENT_LIQUIDITY: u64 = 1;
    const E_SLIPPAGE_EXCEEDED: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_POOL_INACTIVE: u64 = 4;
    const E_ZERO_LIQUIDITY: u64 = 5;

    // ==================== Constants ====================
    const MINIMUM_LIQUIDITY: u64 = 1000;
    const FEE_BPS: u64 = 30; // 0.3% fee

    // ==================== Structs ====================

    /// AMM liquidity pool
    struct LiquidityPool has key {
        id: UID,
        token_id: ID,
        
        // Reserves
        token_reserve: u64,
        sui_reserve: Balance<SUI>,
        
        // Liquidity tracking
        total_liquidity_shares: u64,
        
        // Pool statistics
        total_volume: u64,
        total_fees: u64,
        trade_count: u64,
        
        // Status
        is_active: bool,
        created_at: u64,
    }

    /// Liquidity provider share
    struct LiquidityShare has key, store {
        id: UID,
        pool_id: ID,
        provider: address,
        shares: u64,
        token_deposited: u64,
        sui_deposited: u64,
        created_at: u64,
    }

    // ==================== Events ====================

    struct PoolCreated has copy, drop {
        pool_id: ID,
        token_id: ID,
        initial_token_reserve: u64,
        initial_sui_reserve: u64,
        timestamp: u64,
    }

    struct LiquidityAdded has copy, drop {
        pool_id: ID,
        provider: address,
        token_amount: u64,
        sui_amount: u64,
        shares_minted: u64,
        timestamp: u64,
    }

    struct LiquidityRemoved has copy, drop {
        pool_id: ID,
        provider: address,
        token_amount: u64,
        sui_amount: u64,
        shares_burned: u64,
        timestamp: u64,
    }

    struct Swap has copy, drop {
        pool_id: ID,
        trader: address,
        token_in: bool, // true if swapping token for SUI
        amount_in: u64,
        amount_out: u64,
        fee: u64,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create liquidity pool
    public fun create_pool(
        token_id: ID,
        initial_token_amount: u64,
        initial_sui: Coin<SUI>,
        ctx: &mut TxContext
    ): (LiquidityPool, LiquidityShare) {
        assert!(initial_token_amount >= MINIMUM_LIQUIDITY, E_INVALID_AMOUNT);
        
        let initial_sui_amount = coin::value(&initial_sui);
        assert!(initial_sui_amount >= MINIMUM_LIQUIDITY, E_INVALID_AMOUNT);

        // Calculate initial liquidity shares (geometric mean)
        let initial_shares = sqrt(initial_token_amount * initial_sui_amount);

        let pool = LiquidityPool {
            id: object::new(ctx),
            token_id,
            token_reserve: initial_token_amount,
            sui_reserve: coin::into_balance(initial_sui),
            total_liquidity_shares: initial_shares,
            total_volume: 0,
            total_fees: 0,
            trade_count: 0,
            is_active: true,
            created_at: tx_context::epoch(ctx),
        };

        let pool_id = object::id(&pool);
        let provider = tx_context::sender(ctx);

        let share = LiquidityShare {
            id: object::new(ctx),
            pool_id,
            provider,
            shares: initial_shares,
            token_deposited: initial_token_amount,
            sui_deposited: initial_sui_amount,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(PoolCreated {
            pool_id,
            token_id,
            initial_token_reserve: initial_token_amount,
            initial_sui_reserve: initial_sui_amount,
            timestamp: tx_context::epoch(ctx),
        });

        (pool, share)
    }

    /// Add liquidity to pool
    public fun add_liquidity(
        pool: &mut LiquidityPool,
        token_amount: u64,
        sui_payment: Coin<SUI>,
        ctx: &mut TxContext
    ): LiquidityShare {
        assert!(pool.is_active, E_POOL_INACTIVE);
        assert!(token_amount > 0, E_INVALID_AMOUNT);

        let sui_amount = coin::value(&sui_payment);
        assert!(sui_amount > 0, E_INVALID_AMOUNT);

        // Calculate proportional amounts
        let token_reserve = pool.token_reserve;
        let sui_reserve = balance::value(&pool.sui_reserve);

        // Calculate shares to mint (proportional to existing pool)
        let shares = if (pool.total_liquidity_shares == 0) {
            sqrt(token_amount * sui_amount)
        } else {
            let token_share = (token_amount * pool.total_liquidity_shares) / token_reserve;
            let sui_share = (sui_amount * pool.total_liquidity_shares) / sui_reserve;
            if (token_share < sui_share) { token_share } else { sui_share }
        };

        // Update pool reserves
        pool.token_reserve = pool.token_reserve + token_amount;
        balance::join(&mut pool.sui_reserve, coin::into_balance(sui_payment));
        pool.total_liquidity_shares = pool.total_liquidity_shares + shares;

        let provider = tx_context::sender(ctx);

        let share = LiquidityShare {
            id: object::new(ctx),
            pool_id: object::id(pool),
            provider,
            shares,
            token_deposited: token_amount,
            sui_deposited: sui_amount,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(LiquidityAdded {
            pool_id: object::id(pool),
            provider,
            token_amount,
            sui_amount,
            shares_minted: shares,
            timestamp: tx_context::epoch(ctx),
        });

        share
    }

    /// Remove liquidity from pool
    public fun remove_liquidity(
        pool: &mut LiquidityPool,
        share: LiquidityShare,
        ctx: &mut TxContext
    ): (u64, Coin<SUI>) {
        let LiquidityShare {
            id,
            pool_id: _,
            provider,
            shares,
            token_deposited: _,
            sui_deposited: _,
            created_at: _,
        } = share;

        object::delete(id);

        // Calculate amounts to return
        let token_amount = (shares * pool.token_reserve) / pool.total_liquidity_shares;
        let sui_amount = (shares * balance::value(&pool.sui_reserve)) / pool.total_liquidity_shares;

        // Update pool
        pool.token_reserve = pool.token_reserve - token_amount;
        pool.total_liquidity_shares = pool.total_liquidity_shares - shares;

        let sui_coin = coin::take(&mut pool.sui_reserve, sui_amount, ctx);

        event::emit(LiquidityRemoved {
            pool_id: object::id(pool),
            provider,
            token_amount,
            sui_amount,
            shares_burned: shares,
            timestamp: tx_context::epoch(ctx),
        });

        (token_amount, sui_coin)
    }

    /// Swap tokens for SUI
    public fun swap_token_for_sui(
        pool: &mut LiquidityPool,
        token_amount: u64,
        min_sui_out: u64,
        ctx: &mut TxContext
    ): Coin<SUI> {
        assert!(pool.is_active, E_POOL_INACTIVE);
        assert!(token_amount > 0, E_INVALID_AMOUNT);

        // Calculate output amount using constant product formula
        // (x + dx * 0.997) * (y - dy) = x * y
        let token_reserve = pool.token_reserve;
        let sui_reserve = balance::value(&pool.sui_reserve);

        let amount_in_with_fee = token_amount * (10000 - FEE_BPS);
        let numerator = amount_in_with_fee * sui_reserve;
        let denominator = (token_reserve * 10000) + amount_in_with_fee;
        let sui_out = numerator / denominator;

        assert!(sui_out >= min_sui_out, E_SLIPPAGE_EXCEEDED);
        assert!(sui_out < sui_reserve, E_INSUFFICIENT_LIQUIDITY);

        // Calculate fee
        let fee = (token_amount * FEE_BPS) / 10000;

        // Update pool
        pool.token_reserve = pool.token_reserve + token_amount;
        pool.total_volume = pool.total_volume + sui_out;
        pool.total_fees = pool.total_fees + fee;
        pool.trade_count = pool.trade_count + 1;

        let sui_coin = coin::take(&mut pool.sui_reserve, sui_out, ctx);

        event::emit(Swap {
            pool_id: object::id(pool),
            trader: tx_context::sender(ctx),
            token_in: true,
            amount_in: token_amount,
            amount_out: sui_out,
            fee,
            timestamp: tx_context::epoch(ctx),
        });

        sui_coin
    }

    /// Swap SUI for tokens
    public fun swap_sui_for_token(
        pool: &mut LiquidityPool,
        sui_payment: Coin<SUI>,
        min_token_out: u64,
        ctx: &mut TxContext
    ): u64 {
        assert!(pool.is_active, E_POOL_INACTIVE);
        
        let sui_amount = coin::value(&sui_payment);
        assert!(sui_amount > 0, E_INVALID_AMOUNT);

        // Calculate output amount
        let token_reserve = pool.token_reserve;
        let sui_reserve = balance::value(&pool.sui_reserve);

        let amount_in_with_fee = sui_amount * (10000 - FEE_BPS);
        let numerator = amount_in_with_fee * token_reserve;
        let denominator = (sui_reserve * 10000) + amount_in_with_fee;
        let token_out = numerator / denominator;

        assert!(token_out >= min_token_out, E_SLIPPAGE_EXCEEDED);
        assert!(token_out < token_reserve, E_INSUFFICIENT_LIQUIDITY);

        // Calculate fee
        let fee = (sui_amount * FEE_BPS) / 10000;

        // Update pool
        balance::join(&mut pool.sui_reserve, coin::into_balance(sui_payment));
        pool.token_reserve = pool.token_reserve - token_out;
        pool.total_volume = pool.total_volume + sui_amount;
        pool.total_fees = pool.total_fees + fee;
        pool.trade_count = pool.trade_count + 1;

        event::emit(Swap {
            pool_id: object::id(pool),
            trader: tx_context::sender(ctx),
            token_in: false,
            amount_in: sui_amount,
            amount_out: token_out,
            fee,
            timestamp: tx_context::epoch(ctx),
        });

        token_out
    }

    // ==================== Helper Functions ====================

    /// Calculate square root (Babylonian method)
    fun sqrt(x: u64): u64 {
        if (x == 0) return 0;
        let z = (x + 1) / 2;
        let y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        };
        y
    }

    // ==================== View Functions ====================

    public fun get_reserves(pool: &LiquidityPool): (u64, u64) {
        (pool.token_reserve, balance::value(&pool.sui_reserve))
    }

    public fun get_price(pool: &LiquidityPool): u64 {
        let sui_reserve = balance::value(&pool.sui_reserve);
        if (pool.token_reserve == 0) { return 0 };
        (sui_reserve * 1000000) / pool.token_reserve
    }

    public fun get_total_liquidity(pool: &LiquidityPool): u64 {
        pool.total_liquidity_shares
    }

    public fun get_share_value(pool: &LiquidityPool, shares: u64): (u64, u64) {
        if (pool.total_liquidity_shares == 0) { return (0, 0) };
        let token_value = (shares * pool.token_reserve) / pool.total_liquidity_shares;
        let sui_value = (shares * balance::value(&pool.sui_reserve)) / pool.total_liquidity_shares;
        (token_value, sui_value)
    }
}
