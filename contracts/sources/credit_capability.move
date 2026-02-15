/// Credit Capability module for Credit OS
/// Provides borrowing capability objects with time-bound permissions
module credit_os::credit_capability {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};

    /// Error codes
    const ECapabilityExpired: u64 = 1;
    const ECapabilityRevoked: u64 = 2;
    const EInsufficientCreditLimit: u64 = 3;
    const EInvalidAmount: u64 = 4;
    const ECapabilityNotActive: u64 = 5;

    /// Capability status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_SUSPENDED: u8 = 1;
    const STATUS_REVOKED: u8 = 2;
    const STATUS_EXPIRED: u8 = 3;

    /// Borrowing Capability Object
    struct BorrowingCapability has key, store {
        id: UID,
        owner_account_id: String,
        credit_limit_usd: u64,
        used_credit_usd: u64,
        available_credit_usd: u64,
        interest_rate_bps: u64, // Annual interest rate in basis points
        collateral_type: String, // "rwa", "crypto", or "mixed"
        collateral_refs: vector<address>, // References to collateral objects
        issued_at: u64,
        expires_at: u64,
        last_updated: u64,
        status: u8,
        risk_score: u64, // 0-100, lower is better
    }

    /// Capability usage record
    struct CapabilityUsage has store {
        amount_borrowed: u64,
        timestamp: u64,
        loan_id: address,
    }

    /// Events
    struct CapabilityIssued has copy, drop {
        capability_id: address,
        owner_account_id: String,
        credit_limit: u64,
        interest_rate: u64,
        expires_at: u64,
        timestamp: u64,
    }

    struct CapabilityUsed has copy, drop {
        capability_id: address,
        amount: u64,
        used_credit: u64,
        available_credit: u64,
        timestamp: u64,
    }

    struct CapabilityRevoked has copy, drop {
        capability_id: address,
        reason: String,
        timestamp: u64,
    }

    struct CapabilityExpired has copy, drop {
        capability_id: address,
        timestamp: u64,
    }

    /// Issue a new borrowing capability
    public fun issue_capability(
        owner_account_id: String,
        credit_limit_usd: u64,
        interest_rate_bps: u64,
        collateral_type: String,
        collateral_refs: vector<address>,
        validity_duration_ms: u64,
        risk_score: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): BorrowingCapability {
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + validity_duration_ms;

        let capability = BorrowingCapability {
            id: object::new(ctx),
            owner_account_id,
            credit_limit_usd,
            used_credit_usd: 0,
            available_credit_usd: credit_limit_usd,
            interest_rate_bps,
            collateral_type,
            collateral_refs,
            issued_at: current_time,
            expires_at,
            last_updated: current_time,
            status: STATUS_ACTIVE,
            risk_score,
        };

        let capability_id = object::uid_to_address(&capability.id);

        sui::event::emit(CapabilityIssued {
            capability_id,
            owner_account_id: capability.owner_account_id,
            credit_limit: credit_limit_usd,
            interest_rate: interest_rate_bps,
            expires_at,
            timestamp: current_time,
        });

        capability
    }

    /// Use capability to borrow
    public fun use_capability(
        capability: &mut BorrowingCapability,
        amount: u64,
        loan_id: address,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        // Validate capability
        assert!(capability.status == STATUS_ACTIVE, ECapabilityNotActive);
        assert!(current_time < capability.expires_at, ECapabilityExpired);
        assert!(amount > 0, EInvalidAmount);
        assert!(amount <= capability.available_credit_usd, EInsufficientCreditLimit);

        // Update credit usage
        capability.used_credit_usd = capability.used_credit_usd + amount;
        capability.available_credit_usd = capability.available_credit_usd - amount;
        capability.last_updated = current_time;

        let capability_id = object::uid_to_address(&capability.id);

        sui::event::emit(CapabilityUsed {
            capability_id,
            amount,
            used_credit: capability.used_credit_usd,
            available_credit: capability.available_credit_usd,
            timestamp: current_time,
        });
    }

    /// Repay and restore credit
    public fun restore_credit(
        capability: &mut BorrowingCapability,
        amount: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(amount > 0, EInvalidAmount);
        assert!(amount <= capability.used_credit_usd, EInvalidAmount);

        capability.used_credit_usd = capability.used_credit_usd - amount;
        capability.available_credit_usd = capability.available_credit_usd + amount;
        capability.last_updated = current_time;
    }

    /// Revoke capability (for fraud or policy violation)
    public fun revoke_capability(
        capability: &mut BorrowingCapability,
        reason: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        capability.status = STATUS_REVOKED;
        capability.available_credit_usd = 0;
        capability.last_updated = current_time;

        let capability_id = object::uid_to_address(&capability.id);

        sui::event::emit(CapabilityRevoked {
            capability_id,
            reason,
            timestamp: current_time,
        });
    }

    /// Suspend capability temporarily
    public fun suspend_capability(
        capability: &mut BorrowingCapability,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        capability.status = STATUS_SUSPENDED;
        capability.last_updated = current_time;
    }

    /// Reactivate suspended capability
    public fun reactivate_capability(
        capability: &mut BorrowingCapability,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(capability.status == STATUS_SUSPENDED, ECapabilityNotActive);
        assert!(current_time < capability.expires_at, ECapabilityExpired);

        capability.status = STATUS_ACTIVE;
        capability.last_updated = current_time;
    }

    /// Check if capability is expired
    public fun check_expiration(
        capability: &mut BorrowingCapability,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        if (current_time >= capability.expires_at && capability.status == STATUS_ACTIVE) {
            capability.status = STATUS_EXPIRED;
            capability.available_credit_usd = 0;

            let capability_id = object::uid_to_address(&capability.id);

            sui::event::emit(CapabilityExpired {
                capability_id,
                timestamp: current_time,
            });
        };
    }

    /// Extend capability expiration
    public fun extend_expiration(
        capability: &mut BorrowingCapability,
        additional_duration_ms: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(capability.status == STATUS_ACTIVE, ECapabilityNotActive);

        capability.expires_at = capability.expires_at + additional_duration_ms;
        capability.last_updated = current_time;
    }

    /// Update credit limit
    public fun update_credit_limit(
        capability: &mut BorrowingCapability,
        new_limit: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(capability.status == STATUS_ACTIVE, ECapabilityNotActive);

        let difference = if (new_limit > capability.credit_limit_usd) {
            new_limit - capability.credit_limit_usd
        } else {
            0
        };

        capability.credit_limit_usd = new_limit;
        capability.available_credit_usd = capability.available_credit_usd + difference;
        capability.last_updated = current_time;
    }

    /// Add collateral reference
    public fun add_collateral_ref(
        capability: &mut BorrowingCapability,
        collateral_addr: address,
        _ctx: &mut TxContext
    ) {
        vector::push_back(&mut capability.collateral_refs, collateral_addr);
    }

    // === Getter functions ===

    public fun get_owner_account_id(capability: &BorrowingCapability): String {
        capability.owner_account_id
    }

    public fun get_credit_limit(capability: &BorrowingCapability): u64 {
        capability.credit_limit_usd
    }

    public fun get_used_credit(capability: &BorrowingCapability): u64 {
        capability.used_credit_usd
    }

    public fun get_available_credit(capability: &BorrowingCapability): u64 {
        capability.available_credit_usd
    }

    public fun get_interest_rate(capability: &BorrowingCapability): u64 {
        capability.interest_rate_bps
    }

    public fun get_status(capability: &BorrowingCapability): u8 {
        capability.status
    }

    public fun get_risk_score(capability: &BorrowingCapability): u64 {
        capability.risk_score
    }

    public fun is_active(capability: &BorrowingCapability): bool {
        capability.status == STATUS_ACTIVE
    }

    public fun is_expired(capability: &BorrowingCapability, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time >= capability.expires_at
    }

    public fun get_collateral_type(capability: &BorrowingCapability): String {
        capability.collateral_type
    }

    public fun get_collateral_count(capability: &BorrowingCapability): u64 {
        vector::length(&capability.collateral_refs)
    }
}
