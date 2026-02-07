/// Recovery Policy module for Credit OS
/// Manages account recovery mechanisms without private key exposure
module credit_os::recovery_policy {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EInvalidRecoveryMethod: u64 = 1;
    const ERecoveryNotInitiated: u64 = 2;
    const ERecoveryExpired: u64 = 3;
    const EInsufficientConfirmations: u64 = 4;
    const ERecoveryAlreadyActive: u64 = 5;
    const EInvalidGuardian: u64 = 6;

    /// Recovery method constants
    const RECOVERY_EMAIL: u8 = 0;
    const RECOVERY_DEVICE: u8 = 1;
    const RECOVERY_GUARDIAN: u8 = 2;
    const RECOVERY_SOCIAL: u8 = 3;

    /// Recovery status constants
    const STATUS_NONE: u8 = 0;
    const STATUS_INITIATED: u8 = 1;
    const STATUS_PENDING: u8 = 2;
    const STATUS_APPROVED: u8 = 3;
    const STATUS_COMPLETED: u8 = 4;
    const STATUS_EXPIRED: u8 = 5;
    const STATUS_CANCELLED: u8 = 6;

    /// Guardian information
    struct Guardian has store {
        guardian_id: String,
        guardian_type: u8, // email, phone, another account
        contact_info: String,
        added_at: u64,
        is_active: bool,
        trust_level: u8, // 1-5 scale
    }

    /// Recovery confirmation
    struct RecoveryConfirmation has store {
        method: u8,
        confirmer_id: String,
        confirmation_code: String,
        confirmed_at: u64,
        is_valid: bool,
    }

    /// Recovery request
    struct RecoveryRequest has store {
        request_id: String,
        user_account_id: address,
        recovery_methods: vector<u8>,
        initiated_at: u64,
        expires_at: u64,
        required_confirmations: u8,
        confirmations: vector<RecoveryConfirmation>,
        status: u8,
        initiator_device_id: String,
        recovery_reason: String,
    }

    /// Recovery policy configuration
    struct RecoveryPolicy has key, store {
        id: UID,
        user_account_id: address,
        email_recovery: bool,
        device_recovery: bool,
        guardian_recovery: bool,
        social_recovery: bool,
        recovery_delay: u64, // Delay before recovery can be executed
        required_confirmations: u8,
        guardians: vector<Guardian>,
        trusted_devices: vector<String>,
        recovery_window: u64, // How long recovery request is valid
        created_at: u64,
        updated_at: u64,
    }

    /// Active recovery state
    struct RecoveryState has key, store {
        id: UID,
        user_account_id: address,
        active_request: option::Option<RecoveryRequest>,
        recovery_history: vector<RecoveryRequest>,
        last_recovery_attempt: u64,
        failed_recovery_attempts: u8,
    }

    /// Event emitted when recovery is initiated
    struct RecoveryInitiated has copy, drop {
        user_account_id: address,
        request_id: String,
        recovery_methods: vector<u8>,
        expires_at: u64,
        timestamp: u64,
    }

    /// Event emitted when recovery confirmation is received
    struct RecoveryConfirmed has copy, drop {
        user_account_id: address,
        request_id: String,
        method: u8,
        confirmer_id: String,
        timestamp: u64,
    }

    /// Event emitted when recovery is completed
    struct RecoveryCompleted has copy, drop {
        user_account_id: address,
        request_id: String,
        recovery_methods_used: vector<u8>,
        timestamp: u64,
    }

    /// Event emitted when guardian is added
    struct GuardianAdded has copy, drop {
        user_account_id: address,
        guardian_id: String,
        guardian_type: u8,
        timestamp: u64,
    }

    /// Create a new recovery policy
    public fun create_recovery_policy(
        user_account_id: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): RecoveryPolicy {
        let current_time = clock::timestamp_ms(clock);
        
        RecoveryPolicy {
            id: object::new(ctx),
            user_account_id,
            email_recovery: true,
            device_recovery: true,
            guardian_recovery: false,
            social_recovery: false,
            recovery_delay: 3600000, // 1 hour delay
            required_confirmations: 1,
            guardians: vector::empty(),
            trusted_devices: vector::empty(),
            recovery_window: 86400000, // 24 hours
            created_at: current_time,
            updated_at: current_time,
        }
    }

    /// Create recovery state for tracking active recoveries
    public fun create_recovery_state(
        user_account_id: address,
        ctx: &mut TxContext
    ): RecoveryState {
        RecoveryState {
            id: object::new(ctx),
            user_account_id,
            active_request: option::none(),
            recovery_history: vector::empty(),
            last_recovery_attempt: 0,
            failed_recovery_attempts: 0,
        }
    }

    /// Initiate account recovery
    public fun initiate_recovery(
        policy: &RecoveryPolicy,
        state: &mut RecoveryState,
        recovery_methods: vector<u8>,
        initiator_device_id: String,
        recovery_reason: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): String {
        // Check if there's already an active recovery
        assert!(option::is_none(&state.active_request), ERecoveryAlreadyActive);

        let current_time = clock::timestamp_ms(clock);
        let request_id = generate_request_id(ctx, current_time);
        
        // Validate recovery methods are enabled
        let mut i = 0;
        let len = vector::length(&recovery_methods);
        while (i < len) {
            let method = *vector::borrow(&recovery_methods, i);
            assert!(is_recovery_method_enabled(policy, method), EInvalidRecoveryMethod);
            i = i + 1;
        };

        let recovery_request = RecoveryRequest {
            request_id,
            user_account_id: policy.user_account_id,
            recovery_methods,
            initiated_at: current_time,
            expires_at: current_time + policy.recovery_window,
            required_confirmations: policy.required_confirmations,
            confirmations: vector::empty(),
            status: STATUS_INITIATED,
            initiator_device_id,
            recovery_reason,
        };

        option::fill(&mut state.active_request, recovery_request);
        state.last_recovery_attempt = current_time;

        sui::event::emit(RecoveryInitiated {
            user_account_id: policy.user_account_id,
            request_id,
            recovery_methods,
            expires_at: current_time + policy.recovery_window,
            timestamp: current_time,
        });

        request_id
    }

    /// Submit recovery confirmation
    public fun submit_recovery_confirmation(
        policy: &RecoveryPolicy,
        state: &mut RecoveryState,
        method: u8,
        confirmer_id: String,
        confirmation_code: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ): bool {
        assert!(option::is_some(&state.active_request), ERecoveryNotInitiated);
        
        let current_time = clock::timestamp_ms(clock);
        let request = option::borrow_mut(&mut state.active_request);
        
        // Check if request is still valid
        assert!(request.expires_at > current_time, ERecoveryExpired);
        assert!(request.status == STATUS_INITIATED || request.status == STATUS_PENDING, ERecoveryExpired);

        // Validate the recovery method
        assert!(vector::contains(&request.recovery_methods, &method), EInvalidRecoveryMethod);

        // Create confirmation
        let confirmation = RecoveryConfirmation {
            method,
            confirmer_id,
            confirmation_code,
            confirmed_at: current_time,
            is_valid: true, // In real implementation, this would be validated
        };

        vector::push_back(&mut request.confirmations, confirmation);
        request.status = STATUS_PENDING;

        sui::event::emit(RecoveryConfirmed {
            user_account_id: request.user_account_id,
            request_id: request.request_id,
            method,
            confirmer_id,
            timestamp: current_time,
        });

        // Check if we have enough confirmations
        let confirmation_count = vector::length(&request.confirmations);
        if (confirmation_count >= (policy.required_confirmations as u64)) {
            request.status = STATUS_APPROVED;
            return true
        };

        false
    }

    /// Complete the recovery process
    public fun complete_recovery(
        policy: &RecoveryPolicy,
        state: &mut RecoveryState,
        clock: &Clock,
        _ctx: &mut TxContext
    ): bool {
        assert!(option::is_some(&state.active_request), ERecoveryNotInitiated);
        
        let current_time = clock::timestamp_ms(clock);
        let request = option::borrow_mut(&mut state.active_request);
        
        // Check if recovery is approved and delay has passed
        assert!(request.status == STATUS_APPROVED, EInsufficientConfirmations);
        assert!(current_time >= request.initiated_at + policy.recovery_delay, ERecoveryExpired);

        // Mark as completed
        request.status = STATUS_COMPLETED;
        
        // Move to history
        let completed_request = option::extract(&mut state.active_request);
        vector::push_back(&mut state.recovery_history, completed_request);

        sui::event::emit(RecoveryCompleted {
            user_account_id: policy.user_account_id,
            request_id: request.request_id,
            recovery_methods_used: request.recovery_methods,
            timestamp: current_time,
        });

        true
    }

    /// Cancel active recovery
    public fun cancel_recovery(
        state: &mut RecoveryState,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(option::is_some(&state.active_request), ERecoveryNotInitiated);
        
        let request = option::borrow_mut(&mut state.active_request);
        request.status = STATUS_CANCELLED;
        
        // Move to history
        let cancelled_request = option::extract(&mut state.active_request);
        vector::push_back(&mut state.recovery_history, cancelled_request);
    }

    /// Add a guardian to the recovery policy
    public fun add_guardian(
        policy: &mut RecoveryPolicy,
        guardian_id: String,
        guardian_type: u8,
        contact_info: String,
        trust_level: u8,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        let guardian = Guardian {
            guardian_id,
            guardian_type,
            contact_info,
            added_at: current_time,
            is_active: true,
            trust_level,
        };

        vector::push_back(&mut policy.guardians, guardian);
        policy.updated_at = current_time;

        sui::event::emit(GuardianAdded {
            user_account_id: policy.user_account_id,
            guardian_id,
            guardian_type,
            timestamp: current_time,
        });
    }

    /// Remove a guardian
    public fun remove_guardian(
        policy: &mut RecoveryPolicy,
        guardian_id: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let guardians = &mut policy.guardians;
        let len = vector::length(guardians);
        let mut i = 0;

        while (i < len) {
            let guardian = vector::borrow(guardians, i);
            if (guardian.guardian_id == guardian_id) {
                vector::remove(guardians, i);
                break
            };
            i = i + 1;
        };

        policy.updated_at = clock::timestamp_ms(clock);
    }

    /// Add trusted device
    public fun add_trusted_device(
        policy: &mut RecoveryPolicy,
        device_id: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        if (!vector::contains(&policy.trusted_devices, &device_id)) {
            vector::push_back(&mut policy.trusted_devices, device_id);
            policy.updated_at = clock::timestamp_ms(clock);
        };
    }

    /// Check if recovery method is enabled
    fun is_recovery_method_enabled(policy: &RecoveryPolicy, method: u8): bool {
        if (method == RECOVERY_EMAIL) { policy.email_recovery }
        else if (method == RECOVERY_DEVICE) { policy.device_recovery }
        else if (method == RECOVERY_GUARDIAN) { policy.guardian_recovery }
        else if (method == RECOVERY_SOCIAL) { policy.social_recovery }
        else { false }
    }

    /// Generate a unique request ID
    fun generate_request_id(ctx: &mut TxContext, timestamp: u64): String {
        let uid = object::new(ctx);
        let addr = object::uid_to_address(&uid);
        object::delete(uid);
        
        // Combine address and timestamp for uniqueness
        let addr_bytes = std::bcs::to_bytes(&addr);
        let time_bytes = std::bcs::to_bytes(&timestamp);
        vector::append(&mut addr_bytes, time_bytes);
        
        // Convert to string (simplified - in real implementation would use proper encoding)
        string::utf8(addr_bytes)
    }

    // === Getter functions ===

    /// Check if email recovery is enabled
    public fun is_email_recovery_enabled(policy: &RecoveryPolicy): bool {
        policy.email_recovery
    }

    /// Check if device recovery is enabled
    public fun is_device_recovery_enabled(policy: &RecoveryPolicy): bool {
        policy.device_recovery
    }

    /// Check if guardian recovery is enabled
    public fun is_guardian_recovery_enabled(policy: &RecoveryPolicy): bool {
        policy.guardian_recovery
    }

    /// Get recovery delay
    public fun get_recovery_delay(policy: &RecoveryPolicy): u64 {
        policy.recovery_delay
    }

    /// Get required confirmations
    public fun get_required_confirmations(policy: &RecoveryPolicy): u8 {
        policy.required_confirmations
    }

    /// Check if there's an active recovery
    public fun has_active_recovery(state: &RecoveryState): bool {
        option::is_some(&state.active_request)
    }

    /// Get guardian count
    public fun get_guardian_count(policy: &RecoveryPolicy): u64 {
        vector::length(&policy.guardians)
    }

    /// Get trusted device count
    public fun get_trusted_device_count(policy: &RecoveryPolicy): u64 {
        vector::length(&policy.trusted_devices)
    }
}