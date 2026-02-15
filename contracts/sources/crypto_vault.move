/// Crypto Vault module for Credit OS
/// Provides crypto collateral locking, LTV calculation, and health factor monitoring
module credit_os::crypto_vault {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EVaultFrozen: u64 = 1;
    const EInsufficientCollateral: u64 = 2;
    const EUnhealthyPosition: u64 = 3;
    const EInvalidLTV: u64 = 4;
    const EUnauthorizedWithdrawal: u64 = 5;
    const ELiquidationThresholdNotReached: u64 = 6;

    /// Health factor thresholds (in basis points, 10000 = 100%)
    const LIQUIDATION_THRESHOLD: u64 = 8000; // 80% LTV triggers liquidation
    const WARNING_THRESHOLD_1: u64 = 6500; // 65% LTV
    const WARNING_THRESHOLD_2: u64 = 7000; // 70% LTV
    const WARNING_THRESHOLD_3: u64 = 7500; // 75% LTV

    /// Vault status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_WARNING: u8 = 1;
    const STATUS_CRITICAL: u8 = 2;
    const STATUS_LIQUIDATING: u8 = 3;
    const STATUS_LIQUIDATED: u8 = 4;

    /// Collateral asset entry
    struct CollateralAsset has store {
        asset_type: String,
        amount: u64,
        value_usd: u64,
        deposited_at: u64,
        last_valuation: u64,
    }

    /// Crypto Vault Object
    struct CryptoVaultObject has key, store {
        id: UID,
        owner_account_id: String,
        collateral_assets: vector<CollateralAsset>,
        total_collateral_value_usd: u64,
        borrowed_amount_usd: u64,
        current_ltv: u64,
        health_factor: u64,
        status: u8,
        created_at: u64,
        last_updated: u64,
    }

    /// Events
    struct VaultCreated has copy, drop {
        vault_id: address,
        owner_account_id: String,
        created_at: u64,
    }

    struct CollateralDeposited has copy, drop {
        vault_id: address,
        asset_type: String,
        amount: u64,
        value_usd: u64,
        timestamp: u64,
    }

    struct LTVUpdated has copy, drop {
        vault_id: address,
        old_ltv: u64,
        new_ltv: u64,
        health_factor: u64,
        timestamp: u64,
    }

    struct LiquidationTriggered has copy, drop {
        vault_id: address,
        ltv: u64,
        collateral_value: u64,
        timestamp: u64,
    }

    /// Create vault
    public fun create_vault(
        owner_account_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): CryptoVaultObject {
        let current_time = clock::timestamp_ms(clock);

        let vault = CryptoVaultObject {
            id: object::new(ctx),
            owner_account_id,
            collateral_assets: vector::empty(),
            total_collateral_value_usd: 0,
            borrowed_amount_usd: 0,
            current_ltv: 0,
            health_factor: 10000,
            status: STATUS_ACTIVE,
            created_at: current_time,
            last_updated: current_time,
        };

        let vault_id = object::uid_to_address(&vault.id);
        sui::event::emit(VaultCreated {
            vault_id,
            owner_account_id: vault.owner_account_id,
            created_at: current_time,
        });

        vault
    }

    /// Deposit collateral
    public fun deposit_collateral(
        vault: &mut CryptoVaultObject,
        asset_type: String,
        amount: u64,
        value_usd: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(vault.status == STATUS_ACTIVE || vault.status == STATUS_WARNING, EVaultFrozen);

        let current_time = clock::timestamp_ms(clock);
        let collateral = CollateralAsset {
            asset_type: asset_type,
            amount,
            value_usd,
            deposited_at: current_time,
            last_valuation: current_time,
        };

        vector::push_back(&mut vault.collateral_assets, collateral);
        vault.total_collateral_value_usd = vault.total_collateral_value_usd + value_usd;
        vault.last_updated = current_time;

        update_ltv_and_health(vault);

        let vault_id = object::uid_to_address(&vault.id);
        sui::event::emit(CollateralDeposited {
            vault_id,
            asset_type: collateral.asset_type,
            amount,
            value_usd,
            timestamp: current_time,
        });
    }

    /// Update borrowed amount
    public fun update_borrowed_amount(
        vault: &mut CryptoVaultObject,
        new_borrowed_amount: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        vault.borrowed_amount_usd = new_borrowed_amount;
        vault.last_updated = current_time;
        update_ltv_and_health(vault);
    }

    /// Update collateral values
    public fun update_collateral_values(
        vault: &mut CryptoVaultObject,
        asset_type: String,
        new_value_usd: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let assets = &mut vault.collateral_assets;
        let len = vector::length(assets);
        let mut i = 0;

        while (i < len) {
            let asset = vector::borrow_mut(assets, i);
            if (asset.asset_type == asset_type) {
                let old_value = asset.value_usd;
                asset.value_usd = new_value_usd;
                asset.last_valuation = current_time;
                vault.total_collateral_value_usd = vault.total_collateral_value_usd - old_value + new_value_usd;
                break
            };
            i = i + 1;
        };

        vault.last_updated = current_time;
        update_ltv_and_health(vault);
    }

    /// Calculate LTV and health
    fun update_ltv_and_health(vault: &mut CryptoVaultObject) {
        let old_ltv = vault.current_ltv;

        if (vault.total_collateral_value_usd == 0) {
            vault.current_ltv = 0;
            vault.health_factor = 10000;
            return
        };

        vault.current_ltv = (vault.borrowed_amount_usd * 10000) / vault.total_collateral_value_usd;
        vault.health_factor = if (vault.current_ltv == 0) { 10000 } else { 10000 - vault.current_ltv };

        vault.status = if (vault.current_ltv >= LIQUIDATION_THRESHOLD) {
            STATUS_CRITICAL
        } else if (vault.current_ltv >= WARNING_THRESHOLD_3) {
            STATUS_WARNING
        } else {
            STATUS_ACTIVE
        };

        let vault_id = object::uid_to_address(&vault.id);
        sui::event::emit(LTVUpdated {
            vault_id,
            old_ltv,
            new_ltv: vault.current_ltv,
            health_factor: vault.health_factor,
            timestamp: vault.last_updated,
        });
    }

    /// Check if can liquidate
    public fun can_liquidate(vault: &CryptoVaultObject): bool {
        vault.current_ltv >= LIQUIDATION_THRESHOLD
    }

    /// Start liquidation
    public fun start_liquidation(
        vault: &mut CryptoVaultObject,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(can_liquidate(vault), ELiquidationThresholdNotReached);

        let current_time = clock::timestamp_ms(clock);
        vault.status = STATUS_LIQUIDATING;
        vault.last_updated = current_time;

        let vault_id = object::uid_to_address(&vault.id);
        sui::event::emit(LiquidationTriggered {
            vault_id,
            ltv: vault.current_ltv,
            collateral_value: vault.total_collateral_value_usd,
            timestamp: current_time,
        });
    }

    // Getters
    public fun get_owner_account_id(vault: &CryptoVaultObject): String {
        vault.owner_account_id
    }

    public fun get_total_collateral_value(vault: &CryptoVaultObject): u64 {
        vault.total_collateral_value_usd
    }

    public fun get_borrowed_amount(vault: &CryptoVaultObject): u64 {
        vault.borrowed_amount_usd
    }

    public fun get_current_ltv(vault: &CryptoVaultObject): u64 {
        vault.current_ltv
    }

    public fun get_health_factor(vault: &CryptoVaultObject): u64 {
        vault.health_factor
    }

    public fun get_status(vault: &CryptoVaultObject): u8 {
        vault.status
    }

    public fun is_healthy(vault: &CryptoVaultObject): bool {
        vault.health_factor >= 5000 && vault.status != STATUS_LIQUIDATING && vault.status != STATUS_LIQUIDATED
    }

    public fun get_liquidation_threshold(): u64 {
        LIQUIDATION_THRESHOLD
    }
}
