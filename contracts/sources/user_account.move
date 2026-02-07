/// UserAccountObject module for Credit OS account abstraction
/// Provides walletless user accounts with policy-based controls and recovery mechanisms
module credit_os::user_account {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EInvalidAuthPolicy: u64 = 1;
    const EAccountFrozen: u64 = 2;
    const EInvalidRecoveryPolicy: u64 = 3;
    const ESessionExpired: u64 = 4;
    const EInsufficientPermissions: u64 = 5;
    const EInvalidSpendingLimit: u64 = 6;

    /// Account status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_FROZEN: u8 = 1;
    const STATUS_RECOVERY: u8 = 2;

    /// Authentication policy structure
    struct AuthPolicy has store {
        required_auth_methods: vector<u8>, // email=0, phone=1, passkey=2
        session_duration: u64, // in milliseconds
        device_binding_required: bool,
        multi_factor_required: bool,
        max_concurrent_sessions: u8,
    }

    /// Recovery policy structure
    struct RecoveryPolicy has store {
        email_recovery: bool,
        device_recovery: bool,
        guardian_recovery: bool,
        recovery_delay: u64, // in milliseconds
        required_confirmations: u8,
    }

    /// Spending limits structure
    struct SpendingLimits has store {
        daily_limit: u64,
        monthly_limit: u64,
        per_transaction_limit: u64,
        requires_approval_above: u64,
    }

    /// Session information structure
    struct SessionInfo has store {
        session_id: String,
        device_id: String,
        created_at: u64,
        expires_at: u64,
        last_activity: u64,
        is_active: bool,
    }

    /// Main UserAccountObject structure
    struct UserAccountObject has key, store {
        id: UID,
        internal_user_id: String,
        auth_policy: AuthPolicy,
        recovery_policy: RecoveryPolicy,
        spending_limits: SpendingLimits,
        capability_refs: vector<address>, // References to capability objects
        active_sessions: vector<SessionInfo>,
        status: u8, // active, frozen, recovery
        created_at: u64,
        last_activity: u64,
    }

    /// Event emitted when a UserAccountObject is created
    struct AccountCreated has copy, drop {
        account_id: address,
        internal_user_id: String,
        created_at: u64,
    }

    /// Event emitted when account status changes
    struct AccountStatusChanged has copy, drop {
        account_id: address,
        old_status: u8,
        new_status: u8,
        timestamp: u64,
    }

    /// Event emitted when a session is created
    struct SessionCreated has copy, drop {
        account_id: address,
        session_id: String,
        device_id: String,
        expires_at: u64,
    }

    /// Event emitted when a session is revoked
    struct SessionRevoked has copy, drop {
        account_id: address,
        session_id: String,
        timestamp: u64,
    }

    /// Create a new UserAccountObject with default policies
    public fun create_user_account(
        internal_user_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): UserAccountObject {
        let current_time = clock::timestamp_ms(clock);
        
        let auth_policy = AuthPolicy {
            required_auth_methods: vector[0], // Default to email
            session_duration: 86400000, // 24 hours in milliseconds
            device_binding_required: true,
            multi_factor_required: false,
            max_concurrent_sessions: 5,
        };

        let recovery_policy = RecoveryPolicy {
            email_recovery: true,
            device_recovery: true,
            guardian_recovery: false,
            recovery_delay: 3600000, // 1 hour in milliseconds
            required_confirmations: 1,
        };

        let spending_limits = SpendingLimits {
            daily_limit: 10000000000, // 10,000 SUI (in MIST)
            monthly_limit: 100000000000, // 100,000 SUI
            per_transaction_limit: 1000000000, // 1,000 SUI
            requires_approval_above: 5000000000, // 5,000 SUI
        };

        let account = UserAccountObject {
            id: object::new(ctx),
            internal_user_id,
            auth_policy,
            recovery_policy,
            spending_limits,
            capability_refs: vector::empty(),
            active_sessions: vector::empty(),
            status: STATUS_ACTIVE,
            created_at: current_time,
            last_activity: current_time,
        };

        let account_id = object::uid_to_address(&account.id);
        
        sui::event::emit(AccountCreated {
            account_id,
            internal_user_id: account.internal_user_id,
            created_at: current_time,
        });

        account
    }

    /// Create a session for the user account
    public fun create_session(
        account: &mut UserAccountObject,
        session_id: String,
        device_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(account.status == STATUS_ACTIVE, EAccountFrozen);
        
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + account.auth_policy.session_duration;

        // Remove expired sessions
        cleanup_expired_sessions(account, current_time);

        // Check session limit
        assert!(
            vector::length(&account.active_sessions) < (account.auth_policy.max_concurrent_sessions as u64),
            EInsufficientPermissions
        );

        let session = SessionInfo {
            session_id: session_id,
            device_id,
            created_at: current_time,
            expires_at,
            last_activity: current_time,
            is_active: true,
        };

        vector::push_back(&mut account.active_sessions, session);
        account.last_activity = current_time;

        let account_id = object::uid_to_address(&account.id);
        sui::event::emit(SessionCreated {
            account_id,
            session_id: session.session_id,
            device_id: session.device_id,
            expires_at,
        });
    }

    /// Validate a session and update last activity
    public fun validate_session(
        account: &mut UserAccountObject,
        session_id: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        let sessions = &mut account.active_sessions;
        let len = vector::length(sessions);
        let mut i = 0;

        while (i < len) {
            let session = vector::borrow_mut(sessions, i);
            if (session.session_id == session_id && session.is_active) {
                if (session.expires_at > current_time) {
                    session.last_activity = current_time;
                    account.last_activity = current_time;
                    return true
                } else {
                    session.is_active = false;
                    return false
                }
            };
            i = i + 1;
        };
        false
    }

    /// Revoke a specific session
    public fun revoke_session(
        account: &mut UserAccountObject,
        session_id: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let sessions = &mut account.active_sessions;
        let len = vector::length(sessions);
        let mut i = 0;

        while (i < len) {
            let session = vector::borrow_mut(sessions, i);
            if (session.session_id == session_id) {
                session.is_active = false;
                
                let account_id = object::uid_to_address(&account.id);
                sui::event::emit(SessionRevoked {
                    account_id,
                    session_id,
                    timestamp: current_time,
                });
                break
            };
            i = i + 1;
        };
    }

    /// Freeze the account (admin function)
    public fun freeze_account(
        account: &mut UserAccountObject,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let old_status = account.status;
        account.status = STATUS_FROZEN;

        // Revoke all active sessions
        let sessions = &mut account.active_sessions;
        let len = vector::length(sessions);
        let mut i = 0;
        while (i < len) {
            let session = vector::borrow_mut(sessions, i);
            session.is_active = false;
            i = i + 1;
        };

        let account_id = object::uid_to_address(&account.id);
        sui::event::emit(AccountStatusChanged {
            account_id,
            old_status,
            new_status: STATUS_FROZEN,
            timestamp: current_time,
        });
    }

    /// Unfreeze the account (admin function)
    public fun unfreeze_account(
        account: &mut UserAccountObject,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let old_status = account.status;
        account.status = STATUS_ACTIVE;

        let account_id = object::uid_to_address(&account.id);
        sui::event::emit(AccountStatusChanged {
            account_id,
            old_status,
            new_status: STATUS_ACTIVE,
            timestamp: current_time,
        });
    }

    /// Add a capability reference to the account
    public fun add_capability_ref(
        account: &mut UserAccountObject,
        capability_addr: address,
        _ctx: &mut TxContext
    ) {
        assert!(account.status == STATUS_ACTIVE, EAccountFrozen);
        vector::push_back(&mut account.capability_refs, capability_addr);
    }

    /// Remove a capability reference from the account
    public fun remove_capability_ref(
        account: &mut UserAccountObject,
        capability_addr: address,
        _ctx: &mut TxContext
    ) {
        let refs = &mut account.capability_refs;
        let len = vector::length(refs);
        let mut i = 0;

        while (i < len) {
            if (*vector::borrow(refs, i) == capability_addr) {
                vector::remove(refs, i);
                break
            };
            i = i + 1;
        };
    }

    /// Update spending limits
    public fun update_spending_limits(
        account: &mut UserAccountObject,
        daily_limit: u64,
        monthly_limit: u64,
        per_transaction_limit: u64,
        requires_approval_above: u64,
        _ctx: &mut TxContext
    ) {
        assert!(account.status == STATUS_ACTIVE, EAccountFrozen);
        
        account.spending_limits = SpendingLimits {
            daily_limit,
            monthly_limit,
            per_transaction_limit,
            requires_approval_above,
        };
    }

    /// Clean up expired sessions
    fun cleanup_expired_sessions(account: &mut UserAccountObject, current_time: u64) {
        let sessions = &mut account.active_sessions;
        let mut i = 0;
        
        while (i < vector::length(sessions)) {
            let session = vector::borrow_mut(sessions, i);
            if (session.expires_at <= current_time) {
                session.is_active = false;
            };
            i = i + 1;
        };
    }

    // === Getter functions ===

    /// Get the internal user ID
    public fun get_internal_user_id(account: &UserAccountObject): String {
        account.internal_user_id
    }

    /// Get account status
    public fun get_status(account: &UserAccountObject): u8 {
        account.status
    }

    /// Get active session count
    public fun get_active_session_count(account: &UserAccountObject): u64 {
        let sessions = &account.active_sessions;
        let len = vector::length(sessions);
        let mut count = 0;
        let mut i = 0;

        while (i < len) {
            let session = vector::borrow(sessions, i);
            if (session.is_active) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    /// Get capability references
    public fun get_capability_refs(account: &UserAccountObject): &vector<address> {
        &account.capability_refs
    }

    /// Check if account is active
    public fun is_active(account: &UserAccountObject): bool {
        account.status == STATUS_ACTIVE
    }

    /// Get spending limits
    public fun get_spending_limits(account: &UserAccountObject): (u64, u64, u64, u64) {
        (
            account.spending_limits.daily_limit,
            account.spending_limits.monthly_limit,
            account.spending_limits.per_transaction_limit,
            account.spending_limits.requires_approval_above
        )
    }
}