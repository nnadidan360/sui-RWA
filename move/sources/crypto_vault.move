module credit_os::crypto_vault {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use sui::event;
    use sui::math;

    // Error codes
    const E_INSUFFICIENT_COLLATERAL: u64 = 1;
    const E_VAULT_NOT_FOUND: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;
    const E_INVALID_LTV_RATIO: u64 = 4;
    const E_VAULT_UNHEALTHY: u64 = 5;
    const E_INSUFFICIENT_BALANCE: u64 = 6;
    const E_INVALID_ASSET_TYPE: u64 = 7;
    const E_VAULT_LOCKED: u64 = 8;

    // LTV thresholds (in basis points, 10000 = 100%)
    const MAX_LTV_RATIO: u64 = 8000; // 80%
    const LIQUIDATION_THRESHOLD: u64 = 8500; // 85%
    const WARNING_THRESHOLD: u64 = 7500; // 75%

    // Vault status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_WARNING: u8 = 1;
    const STATUS_CRITICAL: u8 = 2;
    const STATUS_LIQUIDATING: u8 = 3;
    const STATUS_CLOSED: u8 = 4;

    /// Crypto Vault Object for managing collateralized assets
    struct CryptoVaultObject<phantom T> has key, store {
        id: UID,
        vault_id: String,
        owner: address,
        collateral_balance: Balance<T>,
        collateral_type: String,
        borrowed_amount: u64,
        borrowed_currency: String,
        ltv_ratio: u64, // In basis points (10000 = 100%)
        health_factor: u64, // In basis points (10000 = 1.0)
        status: u8,
        created_at: u64,
        last_updated: u64,
        liquidation_price: u64, // Price at which liquidation triggers
        interest_rate: u64, // Annual interest rate in basis points
        accrued_interest: u64,
    }

    /// Capability for managing vaults (admin only)
    struct VaultManagerCapability has key, store {
        id: UID,
    }

    /// Event emitted when vault is created
    struct VaultCreated has copy, drop {
        vault_id: String,
        owner: address,
        collateral_type: String,
        collateral_amount: u64,
        borrowed_amount: u64,
        ltv_ratio: u64,
    }

    /// Event emitted when collateral is deposited
    struct CollateralDeposited has copy, drop {
        vault_id: String,
        owner: address,
        amount: u64,
        new_balance: u64,
        new_ltv_ratio: u64,
    }

    /// Event emitted when collateral is withdrawn
    struct CollateralWithdrawn has copy, drop {
        vault_id: String,
        owner: address,
        amount: u64,
        new_balance: u64,
        new_ltv_ratio: u64,
    }

    /// Event emitted when vault status changes
    struct VaultStatusChanged has copy, drop {
        vault_id: String,
        owner: address,
        old_status: u8,
        new_status: u8,
        health_factor: u64,
        ltv_ratio: u64,
    }

    /// Event emitted when loan is repaid
    struct LoanRepaid has copy, drop {
        vault_id: String,
        owner: address,
        repaid_amount: u64,
        remaining_debt: u64,
        new_ltv_ratio: u64,
    }

    /// Initialize module and create admin capability
    fun init(ctx: &mut TxContext) {
        let capability = VaultManagerCapability {
            id: object::new(ctx),
        };
        transfer::transfer(capability, tx_context::sender(ctx));
    }

    /// Create new crypto vault with collateral
    public entry fun create_vault<T>(
        collateral: Coin<T>,
        collateral_type: String,
        borrowed_amount: u64,
        borrowed_currency: String,
        collateral_price: u64, // Price per unit in USD (scaled by 1e8)
        interest_rate: u64, // Annual rate in basis points
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let collateral_amount = coin::value(&collateral);
        let collateral_value = (collateral_amount as u64) * collateral_price / 100000000; // Adjust for price scaling
        
        // Calculate LTV ratio
        let ltv_ratio = if (collateral_value > 0) {
            (borrowed_amount * 10000) / collateral_value
        } else {
            10000 // 100% if no collateral value
        };

        // Validate LTV ratio
        assert!(ltv_ratio <= MAX_LTV_RATIO, E_INVALID_LTV_RATIO);

        let current_time = clock::timestamp_ms(clock);
        let vault_id = generate_vault_id(tx_context::sender(ctx), current_time);

        // Calculate health factor (inverse of LTV ratio, scaled)
        let health_factor = if (ltv_ratio > 0) {
            (10000 * 10000) / ltv_ratio
        } else {
            10000 // Perfect health if no debt
        };

        // Calculate liquidation price
        let liquidation_price = if (collateral_amount > 0) {
            (borrowed_amount * LIQUIDATION_THRESHOLD * 100000000) / (collateral_amount * 10000)
        } else {
            0
        };

        let vault = CryptoVaultObject {
            id: object::new(ctx),
            vault_id,
            owner: tx_context::sender(ctx),
            collateral_balance: coin::into_balance(collateral),
            collateral_type,
            borrowed_amount,
            borrowed_currency,
            ltv_ratio,
            health_factor,
            status: STATUS_ACTIVE,
            created_at: current_time,
            last_updated: current_time,
            liquidation_price,
            interest_rate,
            accrued_interest: 0,
        };

        // Emit creation event
        event::emit(VaultCreated {
            vault_id,
            owner: tx_context::sender(ctx),
            collateral_type: vault.collateral_type,
            collateral_amount,
            borrowed_amount,
            ltv_ratio,
        });

        // Transfer vault to owner
        transfer::transfer(vault, tx_context::sender(ctx));
    }

    /// Deposit additional collateral to vault
    public entry fun deposit_collateral<T>(
        vault: &mut CryptoVaultObject<T>,
        collateral: Coin<T>,
        collateral_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only owner can deposit
        assert!(tx_context::sender(ctx) == vault.owner, E_UNAUTHORIZED);

        let deposit_amount = coin::value(&collateral);
        balance::join(&mut vault.collateral_balance, coin::into_balance(collateral));
        
        let new_collateral_amount = balance::value(&vault.collateral_balance);
        let new_collateral_value = (new_collateral_amount as u64) * collateral_price / 100000000;
        
        // Recalculate LTV ratio
        vault.ltv_ratio = if (new_collateral_value > 0) {
            (vault.borrowed_amount * 10000) / new_collateral_value
        } else {
            10000
        };

        // Update health factor
        vault.health_factor = if (vault.ltv_ratio > 0) {
            (10000 * 10000) / vault.ltv_ratio
        } else {
            10000
        };

        // Update liquidation price
        vault.liquidation_price = if (new_collateral_amount > 0) {
            (vault.borrowed_amount * LIQUIDATION_THRESHOLD * 100000000) / (new_collateral_amount * 10000)
        } else {
            0
        };

        vault.last_updated = clock::timestamp_ms(clock);

        // Update vault status based on new LTV
        update_vault_status(vault);

        // Emit deposit event
        event::emit(CollateralDeposited {
            vault_id: vault.vault_id,
            owner: vault.owner,
            amount: deposit_amount,
            new_balance: new_collateral_amount,
            new_ltv_ratio: vault.ltv_ratio,
        });
    }

    /// Withdraw collateral from vault (if health allows)
    public entry fun withdraw_collateral<T>(
        vault: &mut CryptoVaultObject<T>,
        withdraw_amount: u64,
        collateral_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        // Only owner can withdraw
        assert!(tx_context::sender(ctx) == vault.owner, E_UNAUTHORIZED);
        
        let current_balance = balance::value(&vault.collateral_balance);
        assert!(withdraw_amount <= current_balance, E_INSUFFICIENT_BALANCE);

        // Calculate new LTV after withdrawal
        let remaining_collateral = current_balance - withdraw_amount;
        let remaining_value = (remaining_collateral as u64) * collateral_price / 100000000;
        
        let new_ltv_ratio = if (remaining_value > 0) {
            (vault.borrowed_amount * 10000) / remaining_value
        } else if (vault.borrowed_amount > 0) {
            10000 // 100% if no collateral but debt exists
        } else {
            0 // No debt, no problem
        };

        // Ensure withdrawal doesn't make vault unhealthy
        assert!(new_ltv_ratio <= MAX_LTV_RATIO, E_VAULT_UNHEALTHY);

        // Perform withdrawal
        let withdrawn_balance = balance::split(&mut vault.collateral_balance, withdraw_amount);
        let withdrawn_coin = coin::from_balance(withdrawn_balance, ctx);

        // Update vault metrics
        vault.ltv_ratio = new_ltv_ratio;
        vault.health_factor = if (new_ltv_ratio > 0) {
            (10000 * 10000) / new_ltv_ratio
        } else {
            10000
        };

        vault.liquidation_price = if (remaining_collateral > 0) {
            (vault.borrowed_amount * LIQUIDATION_THRESHOLD * 100000000) / (remaining_collateral * 10000)
        } else {
            0
        };

        vault.last_updated = clock::timestamp_ms(clock);

        // Update vault status
        update_vault_status(vault);

        // Emit withdrawal event
        event::emit(CollateralWithdrawn {
            vault_id: vault.vault_id,
            owner: vault.owner,
            amount: withdraw_amount,
            new_balance: remaining_collateral,
            new_ltv_ratio: new_ltv_ratio,
        });

        withdrawn_coin
    }

    /// Repay loan and reduce debt
    public entry fun repay_loan<T>(
        vault: &mut CryptoVaultObject<T>,
        repayment_amount: u64,
        collateral_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only owner can repay
        assert!(tx_context::sender(ctx) == vault.owner, E_UNAUTHORIZED);

        // Update accrued interest before repayment
        update_accrued_interest(vault, clock);

        let total_debt = vault.borrowed_amount + vault.accrued_interest;
        let actual_repayment = math::min(repayment_amount, total_debt);

        // Apply repayment (interest first, then principal)
        if (actual_repayment >= vault.accrued_interest) {
            let principal_payment = actual_repayment - vault.accrued_interest;
            vault.accrued_interest = 0;
            vault.borrowed_amount = vault.borrowed_amount - principal_payment;
        } else {
            vault.accrued_interest = vault.accrued_interest - actual_repayment;
        };

        // Recalculate LTV ratio
        let collateral_amount = balance::value(&vault.collateral_balance);
        let collateral_value = (collateral_amount as u64) * collateral_price / 100000000;
        
        vault.ltv_ratio = if (collateral_value > 0 && vault.borrowed_amount > 0) {
            (vault.borrowed_amount * 10000) / collateral_value
        } else {
            0
        };

        // Update health factor
        vault.health_factor = if (vault.ltv_ratio > 0) {
            (10000 * 10000) / vault.ltv_ratio
        } else {
            10000
        };

        vault.last_updated = clock::timestamp_ms(clock);

        // Update vault status
        update_vault_status(vault);

        // Emit repayment event
        event::emit(LoanRepaid {
            vault_id: vault.vault_id,
            owner: vault.owner,
            repaid_amount: actual_repayment,
            remaining_debt: vault.borrowed_amount + vault.accrued_interest,
            new_ltv_ratio: vault.ltv_ratio,
        });
    }

    /// Update vault status based on current health metrics
    fun update_vault_status<T>(vault: &mut CryptoVaultObject<T>) {
        let old_status = vault.status;
        let new_status = if (vault.borrowed_amount == 0) {
            STATUS_CLOSED
        } else if (vault.ltv_ratio >= LIQUIDATION_THRESHOLD) {
            STATUS_CRITICAL
        } else if (vault.ltv_ratio >= WARNING_THRESHOLD) {
            STATUS_WARNING
        } else {
            STATUS_ACTIVE
        };

        if (new_status != old_status) {
            vault.status = new_status;
            
            event::emit(VaultStatusChanged {
                vault_id: vault.vault_id,
                owner: vault.owner,
                old_status,
                new_status,
                health_factor: vault.health_factor,
                ltv_ratio: vault.ltv_ratio,
            });
        };
    }

    /// Update accrued interest based on time elapsed
    fun update_accrued_interest<T>(vault: &mut CryptoVaultObject<T>, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock);
        let time_elapsed = current_time - vault.last_updated;
        
        if (time_elapsed > 0 && vault.borrowed_amount > 0) {
            // Calculate interest: principal * rate * time / (365 * 24 * 60 * 60 * 1000)
            // Simplified: principal * rate * time_in_ms / (31536000000 * 10000)
            let interest_accrued = (vault.borrowed_amount * vault.interest_rate * time_elapsed) / (31536000000 * 10000);
            vault.accrued_interest = vault.accrued_interest + interest_accrued;
        };
    }

    /// Generate unique vault ID
    fun generate_vault_id(owner: address, timestamp: u64): String {
        // Simple vault ID generation - in production would use more sophisticated method
        let addr_bytes = std::bcs::to_bytes(&owner);
        let time_bytes = std::bcs::to_bytes(&timestamp);
        
        // Combine and create string representation
        string::utf8(b"VAULT-") // Placeholder - would implement proper ID generation
    }

    /// Get vault details
    public fun get_vault_details<T>(vault: &CryptoVaultObject<T>): (
        String,  // vault_id
        address, // owner
        u64,     // collateral_balance
        String,  // collateral_type
        u64,     // borrowed_amount
        u64,     // ltv_ratio
        u64,     // health_factor
        u8,      // status
        u64,     // liquidation_price
        u64,     // accrued_interest
    ) {
        (
            vault.vault_id,
            vault.owner,
            balance::value(&vault.collateral_balance),
            vault.collateral_type,
            vault.borrowed_amount,
            vault.ltv_ratio,
            vault.health_factor,
            vault.status,
            vault.liquidation_price,
            vault.accrued_interest,
        )
    }

    /// Check if vault is healthy (not at risk of liquidation)
    public fun is_vault_healthy<T>(vault: &CryptoVaultObject<T>): bool {
        vault.ltv_ratio < LIQUIDATION_THRESHOLD
    }

    /// Check if vault needs liquidation
    public fun needs_liquidation<T>(vault: &CryptoVaultObject<T>): bool {
        vault.ltv_ratio >= LIQUIDATION_THRESHOLD && vault.borrowed_amount > 0
    }

    /// Get vault health metrics
    public fun get_health_metrics<T>(vault: &CryptoVaultObject<T>): (u64, u64, u8) {
        (vault.ltv_ratio, vault.health_factor, vault.status)
    }

    /// Calculate maximum borrowable amount for given collateral
    public fun calculate_max_borrow_amount(
        collateral_amount: u64,
        collateral_price: u64,
        max_ltv: u64
    ): u64 {
        let collateral_value = (collateral_amount as u64) * collateral_price / 100000000;
        (collateral_value * max_ltv) / 10000
    }

    /// Calculate required collateral for loan amount
    public fun calculate_required_collateral(
        loan_amount: u64,
        collateral_price: u64,
        target_ltv: u64
    ): u64 {
        if (target_ltv == 0 || collateral_price == 0) {
            return 0
        };
        
        let required_value = (loan_amount * 10000) / target_ltv;
        (required_value * 100000000) / collateral_price
    }

    // Test functions for development
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_vault<T>(
        collateral: Coin<T>,
        owner: address,
        ctx: &mut TxContext
    ): CryptoVaultObject<T> {
        let collateral_amount = coin::value(&collateral);
        
        CryptoVaultObject {
            id: object::new(ctx),
            vault_id: string::utf8(b"TEST-VAULT-001"),
            owner,
            collateral_balance: coin::into_balance(collateral),
            collateral_type: string::utf8(b"SUI"),
            borrowed_amount: 1000,
            borrowed_currency: string::utf8(b"USDC"),
            ltv_ratio: 5000, // 50%
            health_factor: 20000, // 2.0
            status: STATUS_ACTIVE,
            created_at: 1000000,
            last_updated: 1000000,
            liquidation_price: 500000000, // $5.00
            interest_rate: 500, // 5%
            accrued_interest: 0,
        }
    }
}