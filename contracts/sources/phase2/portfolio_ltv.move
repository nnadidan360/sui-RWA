// PHASE 2: Enhanced Collateral System
// Task 19.1 - Portfolio LTV Calculator
// Diversified collateral calculations

module credit_os::portfolio_ltv {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::vector;

    const E_INVALID_WEIGHT: u64 = 1;
    const E_EMPTY_PORTFOLIO: u64 = 2;
    const E_LTV_EXCEEDED: u64 = 3;

    const MAX_PORTFOLIO_LTV: u64 = 6000;
    const CRYPTO_WEIGHT: u64 = 100;
    const FRACTIONAL_TOKEN_WEIGHT: u64 = 80;

    struct PortfolioCollateral has key {
        id: UID,
        owner: address,
        crypto_assets: vector<CollateralAsset>,
        fractional_tokens: vector<CollateralAsset>,
        total_value: u64,
        weighted_value: u64,
        max_borrow: u64,
        current_borrowed: u64,
        portfolio_ltv: u64,
        health_factor: u64,
        created_at: u64,
        last_updated: u64,
    }

    struct CollateralAsset has store {
        asset_id: ID,
        asset_type: u8,
        value: u64,
        weight: u64,
        weighted_value: u64,
    }

    struct PortfolioUpdated has copy, drop {
        portfolio_id: ID,
        total_value: u64,
        max_borrow: u64,
        ltv: u64,
        timestamp: u64,
    }

    public fun create_portfolio(
        owner: address,
        ctx: &mut TxContext
    ): PortfolioCollateral {
        PortfolioCollateral {
            id: object::new(ctx),
            owner,
            crypto_assets: vector::empty(),
            fractional_tokens: vector::empty(),
            total_value: 0,
            weighted_value: 0,
            max_borrow: 0,
            current_borrowed: 0,
            portfolio_ltv: 0,
            health_factor: 10000,
            created_at: tx_context::epoch(ctx),
            last_updated: tx_context::epoch(ctx),
        }
    }

    public fun add_crypto_asset(
        portfolio: &mut PortfolioCollateral,
        asset_id: ID,
        value: u64,
        ctx: &mut TxContext
    ) {
        let weighted = (value * CRYPTO_WEIGHT) / 100;
        let asset = CollateralAsset {
            asset_id,
            asset_type: 0,
            value,
            weight: CRYPTO_WEIGHT,
            weighted_value: weighted,
        };
        vector::push_back(&mut portfolio.crypto_assets, asset);
        recalculate_portfolio(portfolio, ctx);
    }

    public fun add_fractional_token(
        portfolio: &mut PortfolioCollateral,
        asset_id: ID,
        value: u64,
        ctx: &mut TxContext
    ) {
        let weighted = (value * FRACTIONAL_TOKEN_WEIGHT) / 100;
        let asset = CollateralAsset {
            asset_id,
            asset_type: 1,
            value,
            weight: FRACTIONAL_TOKEN_WEIGHT,
            weighted_value: weighted,
        };
        vector::push_back(&mut portfolio.fractional_tokens, asset);
        recalculate_portfolio(portfolio, ctx);
    }

    fun recalculate_portfolio(
        portfolio: &mut PortfolioCollateral,
        ctx: &mut TxContext
    ) {
        let total: u64 = 0;
        let weighted: u64 = 0;

        let i = 0;
        while (i < vector::length(&portfolio.crypto_assets)) {
            let asset = vector::borrow(&portfolio.crypto_assets, i);
            total = total + asset.value;
            weighted = weighted + asset.weighted_value;
            i = i + 1;
        };

        let j = 0;
        while (j < vector::length(&portfolio.fractional_tokens)) {
            let asset = vector::borrow(&portfolio.fractional_tokens, j);
            total = total + asset.value;
            weighted = weighted + asset.weighted_value;
            j = j + 1;
        };

        portfolio.total_value = total;
        portfolio.weighted_value = weighted;
        portfolio.max_borrow = (weighted * MAX_PORTFOLIO_LTV) / 10000;
        
        if (portfolio.current_borrowed > 0 && weighted > 0) {
            portfolio.portfolio_ltv = (portfolio.current_borrowed * 10000) / weighted;
            portfolio.health_factor = (weighted * 10000) / portfolio.current_borrowed;
        };

        portfolio.last_updated = tx_context::epoch(ctx);

        event::emit(PortfolioUpdated {
            portfolio_id: object::id(portfolio),
            total_value: total,
            max_borrow: portfolio.max_borrow,
            ltv: portfolio.portfolio_ltv,
            timestamp: tx_context::epoch(ctx),
        });
    }

    public fun get_max_borrow(portfolio: &PortfolioCollateral): u64 {
        portfolio.max_borrow
    }

    public fun get_health_factor(portfolio: &PortfolioCollateral): u64 {
        portfolio.health_factor
    }
}
