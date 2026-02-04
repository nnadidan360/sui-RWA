/// Credit OS Session Validator Module
/// Implements transaction authorization through session validation
/// Requirements: 1.3, 12.1

module credit_os::session_validator {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use credit_os::auth_policy::{Self, SessionToken};

    // ============================================================================
    // ERROR CODES
    // ============================================================================
    
    const EInvalidSession: u64 = 1;
    const ESessionExpired: u64 = 2;
    const EUnauthorizedTransaction: u64 = 3;
    const EInvalidSignature: u64 = 4;
    const ERateLimitExceeded: u64 = 5;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Transaction authorization token
    struct TransactionAuth has key, store {
        id: UID,
        session_id: ID,
        account_id: ID,
        authorized_actions: vector<String>,
        expires_at: u64,
        single_use: bool,
        used: bool,
    }

    /// Sponsored transaction for gas-free experience
    struct SponsoredTransaction has key, store {
        id: UID,
        user_account_id: ID,
        transaction_data: vector<u8>,
        gas_budget: u64,
        sponsored_by: address,
        created_at: u64,
        executed: bool,
    }

    /// Rate limiting state for sessions
    struct RateLimitState has store {
        requests_count: u64,
        window_start: u64,
        window_duration: u64, // in milliseconds
        max_requests: u64,
    }

    /// Session validator capability
    struct SessionValidatorCap has key, store {
        id: UID,
    }

    /// Event emitted when transaction is authorized
    struct TransactionAuthorized has copy, drop {
        auth_id: ID,
        session_id: ID,
        account_id: ID,
        actions: vector<String>,
        authorized_at: u64,
    }

    /// Event emitted when sponsored transaction is created
    struct SponsoredTransactionCreated has copy, drop {
        tx_id: ID,
        user_account_id: ID,
        sponsored_by: address,
        gas_budget: u64,
        created_at: u64,
    }

    /// Event emitted when rate limit is exceeded
    struct RateLimitExceeded has copy, drop {
        session_id: ID,
        account_id: ID,
        requests_count: u64,
        max_requests: u64,
        exceeded_at: u64,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the module
    fun init(ctx: &mut TxContext) {
        let validator_cap = SessionValidatorCap {
            id: object::new(ctx),
        };
        transfer::transfer(validator_cap, tx_context::sender(ctx));
    }

    // ============================================================================
    // TRANSACTION AUTHORIZATION
    // ============================================================================

    /// Authorize transaction through session validation
    /// Requirements: 1.3
    public fun authorize_transaction(
        session: &mut SessionToken,
        actions: vector<String>,
        device_fingerprint: String,
        duration: u64,
        single_use: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): TransactionAuth {
        // Validate session
        assert!(
            auth_policy::validate_session(session, device_fingerprint, clock),
            EInvalidSession
        );
        
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + duration;
        
        let auth = TransactionAuth {
            id: object::new(ctx),
            session_id: object::uid_to_inner(auth_policy::get_session_id(session)),
            account_id: auth_policy::get_session_account_id(session),
            authorized_actions: actions,
            expires_at,
            single_use,
            used: false,
        };

        sui::event::emit(TransactionAuthorized {
            auth_id: object::uid_to_inner(&auth.id),
            session_id: auth.session_id,
            account_id: auth.account_id,
            actions: auth.authorized_actions,
            authorized_at: current_time,
        });

        auth
    }

    /// Validate transaction authorization
    public fun validate_transaction_auth(
        auth: &mut TransactionAuth,
        action: String,
        clock: &Clock,
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if authorization is expired
        if (current_time > auth.expires_at) {
            return false
        };
        
        // Check if already used (for single-use auths)
        if (auth.single_use && auth.used) {
            return false
        };
        
        // Check if action is authorized
        let (found, _) = vector::index_of(&auth.authorized_actions, &action);
        if (!found) {
            return false
        };
        
        // Mark as used if single-use
        if (auth.single_use) {
            auth.used = true;
        };
        
        true
    }

    /// Create authorization for specific actions
    public fun create_action_auth(
        session: &mut SessionToken,
        action: String,
        device_fingerprint: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): TransactionAuth {
        let actions = vector::empty<String>();
        vector::push_back(&mut actions, action);
        
        authorize_transaction(
            session,
            actions,
            device_fingerprint,
            300000, // 5 minutes
            true, // single use
            clock,
            ctx
        )
    }

    // ============================================================================
    // SPONSORED TRANSACTIONS
    // ============================================================================

    /// Create sponsored transaction for gas-free experience
    /// Requirements: 1.3
    public fun create_sponsored_transaction(
        user_account_id: ID,
        transaction_data: vector<u8>,
        gas_budget: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): SponsoredTransaction {
        let current_time = clock::timestamp_ms(clock);
        let sponsored_by = tx_context::sender(ctx);
        
        let sponsored_tx = SponsoredTransaction {
            id: object::new(ctx),
            user_account_id,
            transaction_data,
            gas_budget,
            sponsored_by,
            created_at: current_time,
            executed: false,
        };

        sui::event::emit(SponsoredTransactionCreated {
            tx_id: object::uid_to_inner(&sponsored_tx.id),
            user_account_id,
            sponsored_by,
            gas_budget,
            created_at: current_time,
        });

        sponsored_tx
    }

    /// Execute sponsored transaction
    public fun execute_sponsored_transaction(
        sponsored_tx: &mut SponsoredTransaction,
        _validator_cap: &SessionValidatorCap,
    ) {
        assert!(!sponsored_tx.executed, EUnauthorizedTransaction);
        sponsored_tx.executed = true;
    }

    /// Validate sponsored transaction
    public fun validate_sponsored_transaction(
        sponsored_tx: &SponsoredTransaction,
        expected_user: ID,
    ): bool {
        !sponsored_tx.executed && sponsored_tx.user_account_id == expected_user
    }

    // ============================================================================
    // RATE LIMITING
    // ============================================================================

    /// Create rate limit state
    public fun create_rate_limit_state(
        max_requests: u64,
        window_duration: u64,
        clock: &Clock,
    ): RateLimitState {
        RateLimitState {
            requests_count: 0,
            window_start: clock::timestamp_ms(clock),
            window_duration,
            max_requests,
        }
    }

    /// Check rate limit for session
    public fun check_rate_limit(
        rate_limit: &mut RateLimitState,
        session_id: ID,
        account_id: ID,
        clock: &Clock,
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Reset window if expired
        if (current_time - rate_limit.window_start > rate_limit.window_duration) {
            rate_limit.requests_count = 0;
            rate_limit.window_start = current_time;
        };
        
        // Check if limit exceeded
        if (rate_limit.requests_count >= rate_limit.max_requests) {
            sui::event::emit(RateLimitExceeded {
                session_id,
                account_id,
                requests_count: rate_limit.requests_count,
                max_requests: rate_limit.max_requests,
                exceeded_at: current_time,
            });
            return false
        };
        
        // Increment request count
        rate_limit.requests_count = rate_limit.requests_count + 1;
        true
    }

    /// Update rate limit parameters
    public fun update_rate_limit(
        rate_limit: &mut RateLimitState,
        max_requests: u64,
        window_duration: u64,
        _validator_cap: &SessionValidatorCap,
    ) {
        rate_limit.max_requests = max_requests;
        rate_limit.window_duration = window_duration;
    }

    // ============================================================================
    // SESSION VALIDATION HELPERS
    // ============================================================================

    /// Validate session and create short-lived auth
    public fun quick_auth(
        session: &mut SessionToken,
        action: String,
        device_fingerprint: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): bool {
        // Validate session first
        if (!auth_policy::validate_session(session, device_fingerprint, clock)) {
            return false
        };
        
        // Create and immediately validate auth
        let auth = create_action_auth(session, action, device_fingerprint, clock, ctx);
        let result = validate_transaction_auth(&mut auth, action, clock);
        
        // Clean up auth object
        let TransactionAuth { 
            id, 
            session_id: _, 
            account_id: _, 
            authorized_actions: _, 
            expires_at: _, 
            single_use: _, 
            used: _ 
        } = auth;
        object::delete(id);
        
        result
    }

    /// Batch validate multiple actions
    public fun batch_validate_actions(
        session: &mut SessionToken,
        actions: vector<String>,
        device_fingerprint: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): vector<bool> {
        let results = vector::empty<bool>();
        let i = 0;
        let len = vector::length(&actions);
        
        while (i < len) {
            let action = *vector::borrow(&actions, i);
            let result = quick_auth(session, action, device_fingerprint, clock, ctx);
            vector::push_back(&mut results, result);
            i = i + 1;
        };
        
        results
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    /// Get transaction auth session ID
    public fun get_auth_session_id(auth: &TransactionAuth): ID {
        auth.session_id
    }

    /// Get transaction auth account ID
    public fun get_auth_account_id(auth: &TransactionAuth): ID {
        auth.account_id
    }

    /// Get authorized actions
    public fun get_authorized_actions(auth: &TransactionAuth): &vector<String> {
        &auth.authorized_actions
    }

    /// Check if auth is single use
    public fun is_single_use(auth: &TransactionAuth): bool {
        auth.single_use
    }

    /// Check if auth is used
    public fun is_used(auth: &TransactionAuth): bool {
        auth.used
    }

    /// Get sponsored transaction user account ID
    public fun get_sponsored_user_account_id(sponsored_tx: &SponsoredTransaction): ID {
        sponsored_tx.user_account_id
    }

    /// Get sponsored transaction gas budget
    public fun get_sponsored_gas_budget(sponsored_tx: &SponsoredTransaction): u64 {
        sponsored_tx.gas_budget
    }

    /// Check if sponsored transaction is executed
    public fun is_sponsored_executed(sponsored_tx: &SponsoredTransaction): bool {
        sponsored_tx.executed
    }

    /// Get rate limit current count
    public fun get_rate_limit_count(rate_limit: &RateLimitState): u64 {
        rate_limit.requests_count
    }

    /// Get rate limit max requests
    public fun get_rate_limit_max(rate_limit: &RateLimitState): u64 {
        rate_limit.max_requests
    }

    // ============================================================================
    // TESTS
    // ============================================================================

    #[test_only]
    public fun test_authorize_transaction(ctx: &mut TxContext): TransactionAuth {
        use sui::clock;
        
        let clock = clock::create_for_testing(ctx);
        let mut session = auth_policy::test_create_session(ctx);
        
        let actions = vector::empty<String>();
        vector::push_back(&mut actions, string::utf8(b"transfer"));
        
        let auth = authorize_transaction(
            &mut session,
            actions,
            string::utf8(b"test_device"),
            300000, // 5 minutes
            true,
            &clock,
            ctx
        );
        
        // Clean up
        auth_policy::destroy_session_for_testing(session);
        clock::destroy_for_testing(clock);
        
        auth
    }
}