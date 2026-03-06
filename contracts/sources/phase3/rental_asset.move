// PHASE 3: Yield-Generating Products
// Task 22.1 - Rental Asset Management
// Move contract for rental income asset management

module credit_os::rental_asset {
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
    const E_INVALID_AMOUNT: u64 = 2;
    const E_PROPERTY_OCCUPIED: u64 = 3;
    const E_NO_TENANT: u64 = 4;
    const E_INVALID_YIELD: u64 = 5;

    // ==================== Structs ====================

    /// Rental income asset representing a property
    struct RentalIncomeAsset has key, store {
        id: UID,
        owner: address,
        property_address: vector<u8>,
        property_type: u8, // 0=single-family, 1=multi-family, 2=apartment, 3=commercial
        property_value: u64,
        
        // Rental details
        monthly_rent: u64,
        occupancy_rate: u64, // Percentage (0-100)
        
        // Financial tracking
        total_income: u64,
        total_expenses: u64,
        projected_annual_income: u64,
        projected_annual_expenses: u64,
        
        // Tokenization
        is_tokenized: bool,
        token_id: ID,
        management_fee_bps: u64, // Basis points (1000 = 10%)
        
        // Status
        status: u8, // 0=vacant, 1=active, 2=maintenance, 3=suspended
        created_at: u64,
    }

    /// Tenant information
    struct Tenant has key, store {
        id: UID,
        rental_asset_id: ID,
        tenant_address: address,
        lease_start: u64,
        lease_end: u64,
        monthly_rent: u64,
        security_deposit: Balance<SUI>,
        payment_count: u64,
        late_payment_count: u64,
    }

    /// Property expense record
    struct PropertyExpense has key, store {
        id: UID,
        rental_asset_id: ID,
        category: u8, // 0=mortgage, 1=tax, 2=insurance, 3=maintenance, 4=utilities, 5=management
        amount: u64,
        frequency: u8, // 0=monthly, 1=quarterly, 2=annual, 3=one-time
        date: u64,
        recurring: bool,
    }

    // ==================== Events ====================

    struct RentalAssetCreated has copy, drop {
        asset_id: ID,
        owner: address,
        property_value: u64,
        monthly_rent: u64,
        timestamp: u64,
    }

    struct TenantAdded has copy, drop {
        asset_id: ID,
        tenant_id: ID,
        tenant_address: address,
        monthly_rent: u64,
        lease_start: u64,
        lease_end: u64,
        timestamp: u64,
    }

    struct PaymentRecorded has copy, drop {
        asset_id: ID,
        tenant_id: ID,
        amount: u64,
        is_late: bool,
        timestamp: u64,
    }

    struct ExpenseAdded has copy, drop {
        asset_id: ID,
        expense_id: ID,
        category: u8,
        amount: u64,
        timestamp: u64,
    }

    struct YieldCalculated has copy, drop {
        asset_id: ID,
        annual_income: u64,
        annual_expenses: u64,
        net_yield_bps: u64, // Basis points
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create a new rental income asset
    public fun create_rental_asset(
        property_address: vector<u8>,
        property_type: u8,
        property_value: u64,
        monthly_rent: u64,
        projected_annual_expenses: u64,
        ctx: &mut TxContext
    ): RentalIncomeAsset {
        let asset = RentalIncomeAsset {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            property_address,
            property_type,
            property_value,
            monthly_rent,
            occupancy_rate: 0,
            total_income: 0,
            total_expenses: 0,
            projected_annual_income: monthly_rent * 12,
            projected_annual_expenses,
            is_tokenized: false,
            token_id: object::id_from_address(@0x0),
            management_fee_bps: 1000, // 10%
            status: 0, // vacant
            created_at: tx_context::epoch(ctx),
        };

        event::emit(RentalAssetCreated {
            asset_id: object::id(&asset),
            owner: tx_context::sender(ctx),
            property_value,
            monthly_rent,
            timestamp: tx_context::epoch(ctx),
        });

        asset
    }

    /// Add tenant to rental property
    public entry fun add_tenant(
        asset: &mut RentalIncomeAsset,
        tenant_address: address,
        lease_start: u64,
        lease_end: u64,
        monthly_rent: u64,
        security_deposit: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(asset.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);
        assert!(asset.status == 0, E_PROPERTY_OCCUPIED); // Must be vacant

        let tenant = Tenant {
            id: object::new(ctx),
            rental_asset_id: object::id(asset),
            tenant_address,
            lease_start,
            lease_end,
            monthly_rent,
            security_deposit: coin::into_balance(security_deposit),
            payment_count: 0,
            late_payment_count: 0,
        };

        let tenant_id = object::id(&tenant);

        // Update asset
        asset.monthly_rent = monthly_rent;
        asset.projected_annual_income = monthly_rent * 12;
        asset.occupancy_rate = 100;
        asset.status = 1; // active

        event::emit(TenantAdded {
            asset_id: object::id(asset),
            tenant_id,
            tenant_address,
            monthly_rent,
            lease_start,
            lease_end,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(tenant, asset.owner);
    }

    /// Record rental payment
    public entry fun record_payment(
        asset: &mut RentalIncomeAsset,
        tenant: &mut Tenant,
        payment: Coin<SUI>,
        is_late: bool,
        ctx: &mut TxContext
    ) {
        assert!(asset.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);
        assert!(tenant.rental_asset_id == object::id(asset), E_NOT_AUTHORIZED);

        let amount = coin::value(&payment);
        
        asset.total_income = asset.total_income + amount;
        tenant.payment_count = tenant.payment_count + 1;
        
        if (is_late) {
            tenant.late_payment_count = tenant.late_payment_count + 1;
        };

        event::emit(PaymentRecorded {
            asset_id: object::id(asset),
            tenant_id: object::id(tenant),
            amount,
            is_late,
            timestamp: tx_context::epoch(ctx),
        });

        // Transfer payment to owner
        transfer::public_transfer(payment, asset.owner);
    }

    /// Add expense to rental property
    public entry fun add_expense(
        asset: &mut RentalIncomeAsset,
        category: u8,
        amount: u64,
        frequency: u8,
        recurring: bool,
        ctx: &mut TxContext
    ) {
        assert!(asset.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);

        let expense = PropertyExpense {
            id: object::new(ctx),
            rental_asset_id: object::id(asset),
            category,
            amount,
            frequency,
            date: tx_context::epoch(ctx),
            recurring,
        };

        let expense_id = object::id(&expense);

        asset.total_expenses = asset.total_expenses + amount;

        // Update projected annual expenses if recurring
        if (recurring) {
            let annual_amount = get_annual_amount(amount, frequency);
            asset.projected_annual_expenses = asset.projected_annual_expenses + annual_amount;
        };

        event::emit(ExpenseAdded {
            asset_id: object::id(asset),
            expense_id,
            category,
            amount,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(expense, asset.owner);
    }

    /// Calculate net yield
    public fun calculate_yield(asset: &RentalIncomeAsset): u64 {
        if (asset.property_value == 0) {
            return 0
        };

        let net_income = if (asset.projected_annual_income > asset.projected_annual_expenses) {
            asset.projected_annual_income - asset.projected_annual_expenses
        } else {
            0
        };

        // Return yield in basis points (10000 = 100%)
        (net_income * 10000) / asset.property_value
    }

    /// Update occupancy status
    public entry fun update_occupancy(
        asset: &mut RentalIncomeAsset,
        current_epoch: u64,
        ctx: &mut TxContext
    ) {
        assert!(asset.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);

        // In production, would check tenant lease end date
        // For now, just update status
        if (asset.occupancy_rate == 0) {
            asset.status = 0; // vacant
        } else {
            asset.status = 1; // active
        };
    }

    /// Mark asset as tokenized
    public entry fun mark_tokenized(
        asset: &mut RentalIncomeAsset,
        token_id: ID,
        ctx: &mut TxContext
    ) {
        assert!(asset.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);
        
        asset.is_tokenized = true;
        asset.token_id = token_id;
    }

    // ==================== Helper Functions ====================

    fun get_annual_amount(amount: u64, frequency: u8): u64 {
        if (frequency == 0) { // monthly
            amount * 12
        } else if (frequency == 1) { // quarterly
            amount * 4
        } else if (frequency == 2) { // annual
            amount
        } else { // one-time
            0
        }
    }

    // ==================== View Functions ====================

    public fun get_monthly_rent(asset: &RentalIncomeAsset): u64 {
        asset.monthly_rent
    }

    public fun get_occupancy_rate(asset: &RentalIncomeAsset): u64 {
        asset.occupancy_rate
    }

    public fun get_total_income(asset: &RentalIncomeAsset): u64 {
        asset.total_income
    }

    public fun get_total_expenses(asset: &RentalIncomeAsset): u64 {
        asset.total_expenses
    }

    public fun get_projected_annual_income(asset: &RentalIncomeAsset): u64 {
        asset.projected_annual_income
    }

    public fun get_projected_annual_expenses(asset: &RentalIncomeAsset): u64 {
        asset.projected_annual_expenses
    }

    public fun is_tokenized(asset: &RentalIncomeAsset): bool {
        asset.is_tokenized
    }

    public fun get_status(asset: &RentalIncomeAsset): u8 {
        asset.status
    }

    public fun get_owner(asset: &RentalIncomeAsset): address {
        asset.owner
    }
}
