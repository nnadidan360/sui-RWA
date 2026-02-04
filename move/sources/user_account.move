/// Credit OS User Account Module
/// Implements account abstraction for walletless user experience
/// Requirements: 1.2, 1.4, 12.1

module credit_os::user_account {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    // ============================================================================
    // ERROR CODES
    // ============================================================================
    
    const EAccountFrozen: u64 = 1;
    const EInvalidPolicy: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EAccountInRecovery: u64 = 4;
    const EInvalidSpendingLimit: u64 = 5;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Main user account object for account abstraction
    /// Stores policy-based controls and recovery mechanisms
    struct UserAccountObject has key, store {
        id: UID,
        auth_policy: AuthPolicy,
        recovery_policy: RecoveryPolicy,
        spending_limits: SpendingLimits,
        capability_refs: vector<ID>,
        status: u8, // 0: active, 1: frozen, 2: recovery
        created_at: u64,
    }

    /// Authentication policy for the account
    struct AuthPolicy has store, copy, drop {
        email_auth: bool,
        phone_auth: bool,
        passkey_auth: bool,
        multi_factor_required: bool,
        session_duration: u64, // in milliseconds
        max_sessions: u8,
    }

    /// Recovery policy for account restoration
    struct RecoveryPolicy has store, copy, drop {
        email_recovery: bool,
        device_recovery: bool,
        guardian_recovery: bool,
        guardian_count: u8,
        recovery_delay: u64, // in milliseconds
    }

    /// Spending limits for fraud prevention
    struct SpendingLimits has store, copy, drop {
        daily_limit: u64,
        monthly_limit: u64,
        single_tx_limit: u64,
        current_daily_spent: u64,
        current_monthly_spent: u64,
        last_reset_day: u64,
        last_reset_month: u64,
    }

    /// Capability for account management
    struct AccountManagerCap has key, store {
        id: UID,
    }

    /// Event emitted when account is created
    struct AccountCreated has copy, drop {
        account_id: ID,
        created_at: u64,
    }

    /// Event emitted when account is frozen
    struct AccountFrozen has copy, drop {
        account_id: ID,
        frozen_at: u64,
        reason: String,
    }

    /// Event emitted when account is recovered
    struct AccountRecovered has copy, drop {
        account_id: ID,
        recovered_at: u64,
        recovery_method: String,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the module (called once during deployment)
    fun init(ctx: &mut TxContext) {
        let manager_cap = AccountManagerCap {
            id: object::new(ctx),
        };
        transfer::transfer(manager_cap, tx_context::sender(ctx));
    }

    // ============================================================================
    // ACCOUNT CREATION
    // ============================================================================

    /// Create a new user account with account abstraction
    /// Requirements: 1.2, 12.1
    public fun create_account(
        auth_policy: AuthPolicy,
        recovery_policy: RecoveryPolicy,
        daily_limit: u64,
        monthly_limit: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): UserAccountObject {
        let current_time = clock::timestamp_ms(clock);
        
        let spending_limits = SpendingLimits {
            daily_limit,
            monthly_limit,
            single_tx_limit: daily_limit / 10, // 10% of daily limit per transaction
            current_daily_spent: 0,
            current_monthly_spent: 0,
            last_reset_day: current_time,
            last_reset_month: current_time,
        };

        let account = UserAccountObject {
            id: object::new(ctx),
            auth_policy,
            recovery_policy,
            spending_limits,
            capability_refs: vector::empty(),
            status: 0, // active
            created_at: current_time,
        };

        sui::event::emit(AccountCreated {
            account_id: object::uid_to_inner(&account.id),
            created_at: current_time,
        });

        account
    }

    /// Create account with default policies for new users
    /// Requirements: 1.1
    public fun create_default_account(
        email_auth: bool,
        phone_auth: bool,
        passkey_auth: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): UserAccountObject {
        let auth_policy = AuthPolicy {
            email_auth,
            phone_auth,
            passkey_auth,
            multi_factor_required: email_auth && (phone_auth || passkey_auth),
            session_duration: 86400000, // 24 hours
            max_sessions: 5,
        };

        let recovery_policy = RecoveryPolicy {
            email_recovery: email_auth,
            device_recovery: true,
            guardian_recovery: false,
            guardian_count: 0,
            recovery_delay: 3600000, // 1 hour
        };

        create_account(
            auth_policy,
            recovery_policy,
            1000000, // $10,000 daily limit in cents
            5000000, // $50,000 monthly limit in cents
            clock,
            ctx
        )
    }

    // ============================================================================
    // ACCOUNT MANAGEMENT
    // ============================================================================

    /// Freeze account (fraud response)
    /// Requirements: 1.5, 6.4
    public fun freeze_account(
        account: &mut UserAccountObject,
        reason: String,
        _manager_cap: &AccountManagerCap,
        clock: &Clock,
    ) {
        account.status = 1; // frozen
        
        sui::event::emit(AccountFrozen {
            account_id: object::uid_to_inner(&account.id),
            frozen_at: clock::timestamp_ms(clock),
            reason,
        });
    }

    /// Unfreeze account
    public fun unfreeze_account(
        account: &mut UserAccountObject,
        _manager_cap: &AccountManagerCap,
    ) {
        account.status = 0; // active
    }

    /// Start account recovery process
    /// Requirements: 1.4
    public fun start_recovery(
        account: &mut UserAccountObject,
        recovery_method: String,
        clock: &Clock,
    ) {
        assert!(account.status != 1, EAccountFrozen);
        account.status = 2; // recovery mode
        
        sui::event::emit(AccountRecovered {
            account_id: object::uid_to_inner(&account.id),
            recovered_at: clock::timestamp_ms(clock),
            recovery_method,
        });
    }

    /// Complete account recovery
    public fun complete_recovery(
        account: &mut UserAccountObject,
        new_auth_policy: AuthPolicy,
        _manager_cap: &AccountManagerCap,
    ) {
        assert!(account.status == 2, EAccountInRecovery);
        account.auth_policy = new_auth_policy;
        account.status = 0; // active
    }

    // ============================================================================
    // CAPABILITY MANAGEMENT
    // ============================================================================

    /// Add capability reference to account
    /// Requirements: 4.3
    public fun add_capability_ref(
        account: &mut UserAccountObject,
        capability_id: ID,
        _manager_cap: &AccountManagerCap,
    ) {
        assert!(account.status == 0, EAccountFrozen);
        vector::push_back(&mut account.capability_refs, capability_id);
    }

    /// Remove capability reference from account
    public fun remove_capability_ref(
        account: &mut UserAccountObject,
        capability_id: ID,
        _manager_cap: &AccountManagerCap,
    ) {
        let (found, index) = vector::index_of(&account.capability_refs, &capability_id);
        if (found) {
            vector::remove(&mut account.capability_refs, index);
        };
    }

    /// Revoke all capabilities (fraud response)
    /// Requirements: 6.4
    public fun revoke_all_capabilities(
        account: &mut UserAccountObject,
        _manager_cap: &AccountManagerCap,
    ) {
        account.capability_refs = vector::empty();
    }

    // ============================================================================
    // SPENDING LIMITS
    // ============================================================================

    /// Check and update spending limits
    /// Requirements: 5.5
    public fun check_spending_limit(
        account: &mut UserAccountObject,
        amount: u64,
        clock: &Clock,
    ): bool {
        assert!(account.status == 0, EAccountFrozen);
        
        let current_time = clock::timestamp_ms(clock);
        let current_day = current_time / 86400000; // milliseconds to days
        let current_month = current_time / (86400000 * 30); // approximate month
        
        // Reset daily spending if new day
        if (current_day > account.spending_limits.last_reset_day) {
            account.spending_limits.current_daily_spent = 0;
            account.spending_limits.last_reset_day = current_day;
        };
        
        // Reset monthly spending if new month
        if (current_month > account.spending_limits.last_reset_month) {
            account.spending_limits.current_monthly_spent = 0;
            account.spending_limits.last_reset_month = current_month;
        };
        
        // Check limits
        let new_daily_spent = account.spending_limits.current_daily_spent + amount;
        let new_monthly_spent = account.spending_limits.current_monthly_spent + amount;
        
        if (amount > account.spending_limits.single_tx_limit ||
            new_daily_spent > account.spending_limits.daily_limit ||
            new_monthly_spent > account.spending_limits.monthly_limit) {
            false
        } else {
            account.spending_limits.current_daily_spent = new_daily_spent;
            account.spending_limits.current_monthly_spent = new_monthly_spent;
            true
        }
    }

    /// Update spending limits
    public fun update_spending_limits(
        account: &mut UserAccountObject,
        daily_limit: u64,
        monthly_limit: u64,
        _manager_cap: &AccountManagerCap,
    ) {
        account.spending_limits.daily_limit = daily_limit;
        account.spending_limits.monthly_limit = monthly_limit;
        account.spending_limits.single_tx_limit = daily_limit / 10;
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    /// Get account status
    public fun get_status(account: &UserAccountObject): u8 {
        account.status
    }

    /// Get account creation time
    public fun get_created_at(account: &UserAccountObject): u64 {
        account.created_at
    }

    /// Get auth policy
    public fun get_auth_policy(account: &UserAccountObject): &AuthPolicy {
        &account.auth_policy
    }

    /// Get recovery policy
    public fun get_recovery_policy(account: &UserAccountObject): &RecoveryPolicy {
        &account.recovery_policy
    }

    /// Get spending limits
    public fun get_spending_limits(account: &UserAccountObject): &SpendingLimits {
        &account.spending_limits
    }

    /// Get capability references
    public fun get_capability_refs(account: &UserAccountObject): &vector<ID> {
        &account.capability_refs
    }

    /// Check if account is active
    public fun is_active(account: &UserAccountObject): bool {
        account.status == 0
    }

    /// Check if account is frozen
    public fun is_frozen(account: &UserAccountObject): bool {
        account.status == 1
    }

    /// Check if account is in recovery
    public fun is_in_recovery(account: &UserAccountObject): bool {
        account.status == 2
    }

    // ============================================================================
    // POLICY HELPERS
    // ============================================================================

    /// Create auth policy
    public fun create_auth_policy(
        email_auth: bool,
        phone_auth: bool,
        passkey_auth: bool,
        multi_factor_required: bool,
        session_duration: u64,
        max_sessions: u8,
    ): AuthPolicy {
        AuthPolicy {
            email_auth,
            phone_auth,
            passkey_auth,
            multi_factor_required,
            session_duration,
            max_sessions,
        }
    }

    /// Create recovery policy
    public fun create_recovery_policy(
        email_recovery: bool,
        device_recovery: bool,
        guardian_recovery: bool,
        guardian_count: u8,
        recovery_delay: u64,
    ): RecoveryPolicy {
        RecoveryPolicy {
            email_recovery,
            device_recovery,
            guardian_recovery,
            guardian_count,
            recovery_delay,
        }
    }

    // ============================================================================
    // TESTS
    // ============================================================================

    #[test_only]
    public fun test_create_account(ctx: &mut TxContext): UserAccountObject {
        use sui::test_scenario;
        use sui::clock;
        
        let clock = clock::create_for_testing(ctx);
        let auth_policy = create_auth_policy(true, false, false, false, 86400000, 5);
        let recovery_policy = create_recovery_policy(true, true, false, 0, 3600000);
        
        let account = create_account(
            auth_policy,
            recovery_policy,
            1000000,
            5000000,
            &clock,
            ctx
        );
        
        clock::destroy_for_testing(clock);
        account
    }
}