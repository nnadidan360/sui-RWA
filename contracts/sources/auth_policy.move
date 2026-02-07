/// Authentication Policy module for Credit OS
/// Manages authentication requirements and policy validation
module credit_os::auth_policy {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EInvalidAuthMethod: u64 = 1;
    const EPolicyViolation: u64 = 2;
    const EInsufficientAuthMethods: u64 = 3;
    const EDeviceBindingRequired: u64 = 4;
    const EMFARequired: u64 = 5;

    /// Authentication method constants
    const AUTH_EMAIL: u8 = 0;
    const AUTH_PHONE: u8 = 1;
    const AUTH_PASSKEY: u8 = 2;

    /// Policy enforcement levels
    const POLICY_BASIC: u8 = 0;
    const POLICY_ENHANCED: u8 = 1;
    const POLICY_STRICT: u8 = 2;

    /// Authentication attempt record
    struct AuthAttempt has store {
        method: u8,
        device_id: String,
        timestamp: u64,
        success: bool,
        ip_address: String,
    }

    /// Device binding information
    struct DeviceBinding has store {
        device_id: String,
        fingerprint: String,
        first_seen: u64,
        last_used: u64,
        trust_score: u8, // 0-100
        is_trusted: bool,
    }

    /// Policy configuration object
    struct PolicyConfig has key, store {
        id: UID,
        policy_name: String,
        enforcement_level: u8,
        required_auth_methods: vector<u8>,
        session_duration: u64,
        device_binding_required: bool,
        multi_factor_required: bool,
        max_failed_attempts: u8,
        lockout_duration: u64,
        password_policy: PasswordPolicy,
        created_at: u64,
        updated_at: u64,
    }

    /// Password policy structure
    struct PasswordPolicy has store {
        min_length: u8,
        require_uppercase: bool,
        require_lowercase: bool,
        require_numbers: bool,
        require_symbols: bool,
        max_age_days: u16,
        history_count: u8, // Number of previous passwords to remember
    }

    /// Authentication context for validation
    struct AuthContext has store {
        user_account_id: address,
        auth_methods_used: vector<u8>,
        device_bindings: vector<DeviceBinding>,
        recent_attempts: vector<AuthAttempt>,
        failed_attempt_count: u8,
        last_failed_attempt: u64,
        is_locked_out: bool,
        lockout_until: u64,
    }

    /// Event emitted when policy is created
    struct PolicyCreated has copy, drop {
        policy_id: address,
        policy_name: String,
        enforcement_level: u8,
        created_at: u64,
    }

    /// Event emitted when authentication fails
    struct AuthenticationFailed has copy, drop {
        user_account_id: address,
        method: u8,
        device_id: String,
        reason: String,
        timestamp: u64,
    }

    /// Event emitted when account is locked out
    struct AccountLockedOut has copy, drop {
        user_account_id: address,
        lockout_until: u64,
        failed_attempts: u8,
        timestamp: u64,
    }

    /// Create a new authentication policy
    public fun create_policy(
        policy_name: String,
        enforcement_level: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): PolicyConfig {
        let current_time = clock::timestamp_ms(clock);
        
        let password_policy = PasswordPolicy {
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_numbers: true,
            require_symbols: false,
            max_age_days: 90,
            history_count: 5,
        };

        let policy = PolicyConfig {
            id: object::new(ctx),
            policy_name,
            enforcement_level,
            required_auth_methods: vector[AUTH_EMAIL], // Default to email
            session_duration: 86400000, // 24 hours
            device_binding_required: true,
            multi_factor_required: enforcement_level >= POLICY_ENHANCED,
            max_failed_attempts: 5,
            lockout_duration: 1800000, // 30 minutes
            password_policy,
            created_at: current_time,
            updated_at: current_time,
        };

        let policy_id = object::uid_to_address(&policy.id);
        sui::event::emit(PolicyCreated {
            policy_id,
            policy_name: policy.policy_name,
            enforcement_level,
            created_at: current_time,
        });

        policy
    }

    /// Create authentication context for a user
    public fun create_auth_context(
        user_account_id: address,
        _ctx: &mut TxContext
    ): AuthContext {
        AuthContext {
            user_account_id,
            auth_methods_used: vector::empty(),
            device_bindings: vector::empty(),
            recent_attempts: vector::empty(),
            failed_attempt_count: 0,
            last_failed_attempt: 0,
            is_locked_out: false,
            lockout_until: 0,
        }
    }

    /// Validate authentication attempt against policy
    public fun validate_auth_attempt(
        policy: &PolicyConfig,
        context: &mut AuthContext,
        method: u8,
        device_id: String,
        ip_address: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if account is locked out
        if (context.is_locked_out && context.lockout_until > current_time) {
            return false
        };

        // Clear lockout if time has passed
        if (context.is_locked_out && context.lockout_until <= current_time) {
            context.is_locked_out = false;
            context.failed_attempt_count = 0;
        };

        // Validate authentication method
        if (!vector::contains(&policy.required_auth_methods, &method)) {
            record_failed_attempt(context, method, device_id, ip_address, 
                                string::utf8(b"Invalid authentication method"), current_time);
            return false
        };

        // Check device binding if required
        if (policy.device_binding_required && !is_device_trusted(context, device_id)) {
            record_failed_attempt(context, method, device_id, ip_address, 
                                string::utf8(b"Device not trusted"), current_time);
            return false
        };

        // Check multi-factor authentication if required
        if (policy.multi_factor_required && vector::length(&context.auth_methods_used) < 2) {
            // This would be the first factor, allow it but require second factor
            vector::push_back(&mut context.auth_methods_used, method);
            return false // Need second factor
        };

        // Record successful attempt
        let attempt = AuthAttempt {
            method,
            device_id,
            timestamp: current_time,
            success: true,
            ip_address,
        };
        vector::push_back(&mut context.recent_attempts, attempt);
        
        // Reset failed attempt counter on success
        context.failed_attempt_count = 0;
        
        true
    }

    /// Record a failed authentication attempt
    fun record_failed_attempt(
        context: &mut AuthContext,
        method: u8,
        device_id: String,
        ip_address: String,
        reason: String,
        timestamp: u64
    ) {
        let attempt = AuthAttempt {
            method,
            device_id,
            timestamp,
            success: false,
            ip_address,
        };
        
        vector::push_back(&mut context.recent_attempts, attempt);
        context.failed_attempt_count = context.failed_attempt_count + 1;
        context.last_failed_attempt = timestamp;

        sui::event::emit(AuthenticationFailed {
            user_account_id: context.user_account_id,
            method,
            device_id,
            reason,
            timestamp,
        });
    }

    /// Check if account should be locked out
    public fun check_lockout(
        policy: &PolicyConfig,
        context: &mut AuthContext,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        if (context.failed_attempt_count >= policy.max_failed_attempts && !context.is_locked_out) {
            let current_time = clock::timestamp_ms(clock);
            context.is_locked_out = true;
            context.lockout_until = current_time + policy.lockout_duration;

            sui::event::emit(AccountLockedOut {
                user_account_id: context.user_account_id,
                lockout_until: context.lockout_until,
                failed_attempts: context.failed_attempt_count,
                timestamp: current_time,
            });
        }
    }

    /// Add or update device binding
    public fun bind_device(
        context: &mut AuthContext,
        device_id: String,
        fingerprint: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let bindings = &mut context.device_bindings;
        let len = vector::length(bindings);
        let mut i = 0;
        let mut found = false;

        // Update existing binding
        while (i < len) {
            let binding = vector::borrow_mut(bindings, i);
            if (binding.device_id == device_id) {
                binding.last_used = current_time;
                binding.trust_score = if (binding.trust_score < 100) { binding.trust_score + 10 } else { 100 };
                found = true;
                break
            };
            i = i + 1;
        };

        // Create new binding if not found
        if (!found) {
            let new_binding = DeviceBinding {
                device_id,
                fingerprint,
                first_seen: current_time,
                last_used: current_time,
                trust_score: 50, // Start with medium trust
                is_trusted: false, // Requires manual approval or time-based trust
            };
            vector::push_back(bindings, new_binding);
        };
    }

    /// Check if device is trusted
    fun is_device_trusted(context: &AuthContext, device_id: String): bool {
        let bindings = &context.device_bindings;
        let len = vector::length(bindings);
        let mut i = 0;

        while (i < len) {
            let binding = vector::borrow(bindings, i);
            if (binding.device_id == device_id) {
                return binding.is_trusted || binding.trust_score >= 80
            };
            i = i + 1;
        };
        false
    }

    /// Update policy configuration
    public fun update_policy(
        policy: &mut PolicyConfig,
        required_auth_methods: vector<u8>,
        session_duration: u64,
        device_binding_required: bool,
        multi_factor_required: bool,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        policy.required_auth_methods = required_auth_methods;
        policy.session_duration = session_duration;
        policy.device_binding_required = device_binding_required;
        policy.multi_factor_required = multi_factor_required;
        policy.updated_at = clock::timestamp_ms(clock);
    }

    // === Getter functions ===

    /// Get policy enforcement level
    public fun get_enforcement_level(policy: &PolicyConfig): u8 {
        policy.enforcement_level
    }

    /// Get required authentication methods
    public fun get_required_auth_methods(policy: &PolicyConfig): &vector<u8> {
        &policy.required_auth_methods
    }

    /// Get session duration
    public fun get_session_duration(policy: &PolicyConfig): u64 {
        policy.session_duration
    }

    /// Check if device binding is required
    public fun is_device_binding_required(policy: &PolicyConfig): bool {
        policy.device_binding_required
    }

    /// Check if multi-factor authentication is required
    public fun is_mfa_required(policy: &PolicyConfig): bool {
        policy.multi_factor_required
    }

    /// Get failed attempt count
    public fun get_failed_attempt_count(context: &AuthContext): u8 {
        context.failed_attempt_count
    }

    /// Check if account is locked out
    public fun is_locked_out(context: &AuthContext): bool {
        context.is_locked_out
    }

    /// Get lockout expiration time
    public fun get_lockout_until(context: &AuthContext): u64 {
        context.lockout_until
    }
}