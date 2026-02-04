/// Credit OS Authentication Policy Module
/// Implements policy-based access controls for account abstraction
/// Requirements: 1.2, 1.4, 12.1

module credit_os::auth_policy {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use sui::hash;

    // ============================================================================
    // ERROR CODES
    // ============================================================================
    
    const EInvalidCredentials: u64 = 1;
    const ESessionExpired: u64 = 2;
    const EMaxSessionsReached: u64 = 3;
    const EMultiFactorRequired: u64 = 4;
    const EInvalidDeviceFingerprint: u64 = 5;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Session token for authenticated users
    struct SessionToken has key, store {
        id: UID,
        account_id: ID,
        device_fingerprint: String,
        created_at: u64,
        expires_at: u64,
        last_activity: u64,
        is_active: bool,
    }

    /// Device fingerprint for fraud prevention
    struct DeviceFingerprint has store, copy, drop {
        fingerprint_hash: vector<u8>,
        user_agent_hash: vector<u8>,
        ip_hash: vector<u8>,
        first_seen: u64,
        last_seen: u64,
        trusted: bool,
    }

    /// Authentication credentials
    struct AuthCredentials has drop {
        credential_type: u8, // 0: email, 1: phone, 2: passkey
        identifier: String,
        proof: vector<u8>, // hashed proof
        device_fingerprint: String,
    }

    /// Multi-factor authentication state
    struct MFAState has store {
        primary_verified: bool,
        secondary_verified: bool,
        verification_time: u64,
        attempts: u8,
    }

    /// Policy validator capability
    struct PolicyValidatorCap has key, store {
        id: UID,
    }

    /// Event emitted when session is created
    struct SessionCreated has copy, drop {
        session_id: ID,
        account_id: ID,
        device_fingerprint: String,
        created_at: u64,
        expires_at: u64,
    }

    /// Event emitted when session is revoked
    struct SessionRevoked has copy, drop {
        session_id: ID,
        account_id: ID,
        revoked_at: u64,
        reason: String,
    }

    /// Event emitted when authentication fails
    struct AuthenticationFailed has copy, drop {
        account_id: ID,
        credential_type: u8,
        device_fingerprint: String,
        failed_at: u64,
        reason: String,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the module
    fun init(ctx: &mut TxContext) {
        let validator_cap = PolicyValidatorCap {
            id: object::new(ctx),
        };
        transfer::transfer(validator_cap, tx_context::sender(ctx));
    }

    // ============================================================================
    // SESSION MANAGEMENT
    // ============================================================================

    /// Create a new session token
    /// Requirements: 1.3
    public fun create_session(
        account_id: ID,
        device_fingerprint: String,
        session_duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): SessionToken {
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + session_duration;
        
        let session = SessionToken {
            id: object::new(ctx),
            account_id,
            device_fingerprint,
            created_at: current_time,
            expires_at,
            last_activity: current_time,
            is_active: true,
        };

        sui::event::emit(SessionCreated {
            session_id: object::uid_to_inner(&session.id),
            account_id,
            device_fingerprint,
            created_at: current_time,
            expires_at,
        });

        session
    }

    /// Validate session token
    /// Requirements: 1.3
    public fun validate_session(
        session: &mut SessionToken,
        device_fingerprint: String,
        clock: &Clock,
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if session is active and not expired
        if (!session.is_active || current_time > session.expires_at) {
            return false
        };
        
        // Check device fingerprint consistency
        if (session.device_fingerprint != device_fingerprint) {
            return false
        };
        
        // Update last activity
        session.last_activity = current_time;
        true
    }

    /// Revoke session token
    public fun revoke_session(
        session: &mut SessionToken,
        reason: String,
        clock: &Clock,
    ) {
        session.is_active = false;
        
        sui::event::emit(SessionRevoked {
            session_id: object::uid_to_inner(&session.id),
            account_id: session.account_id,
            revoked_at: clock::timestamp_ms(clock),
            reason,
        });
    }

    /// Refresh session token
    public fun refresh_session(
        session: &mut SessionToken,
        session_duration: u64,
        clock: &Clock,
    ) {
        let current_time = clock::timestamp_ms(clock);
        session.expires_at = current_time + session_duration;
        session.last_activity = current_time;
    }

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    /// Authenticate user credentials
    /// Requirements: 1.1
    public fun authenticate_credentials(
        credentials: AuthCredentials,
        expected_proof_hash: vector<u8>,
        clock: &Clock,
    ): bool {
        // Verify proof hash
        let provided_hash = hash::keccak256(&credentials.proof);
        if (provided_hash != expected_proof_hash) {
            sui::event::emit(AuthenticationFailed {
                account_id: @0x0, // Will be filled by caller
                credential_type: credentials.credential_type,
                device_fingerprint: credentials.identifier,
                failed_at: clock::timestamp_ms(clock),
                reason: string::utf8(b"Invalid credentials"),
            });
            return false
        };
        
        true
    }

    /// Verify multi-factor authentication
    /// Requirements: 1.1
    public fun verify_mfa(
        mfa_state: &mut MFAState,
        credential_type: u8,
        is_verified: bool,
        clock: &Clock,
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check if verification is within time window (5 minutes)
        if (current_time - mfa_state.verification_time > 300000) {
            // Reset MFA state if too much time has passed
            mfa_state.primary_verified = false;
            mfa_state.secondary_verified = false;
            mfa_state.verification_time = current_time;
            mfa_state.attempts = 0;
        };
        
        if (is_verified) {
            if (credential_type == 0) { // primary (email/phone)
                mfa_state.primary_verified = true;
            } else { // secondary (passkey/sms)
                mfa_state.secondary_verified = true;
            };
            mfa_state.verification_time = current_time;
        } else {
            mfa_state.attempts = mfa_state.attempts + 1;
        };
        
        // Return true if both factors are verified
        mfa_state.primary_verified && mfa_state.secondary_verified
    }

    // ============================================================================
    // DEVICE FINGERPRINTING
    // ============================================================================

    /// Create device fingerprint
    /// Requirements: 6.1
    public fun create_device_fingerprint(
        fingerprint: String,
        user_agent: String,
        ip_address: String,
        clock: &Clock,
    ): DeviceFingerprint {
        let current_time = clock::timestamp_ms(clock);
        
        DeviceFingerprint {
            fingerprint_hash: hash::keccak256(fingerprint.bytes()),
            user_agent_hash: hash::keccak256(user_agent.bytes()),
            ip_hash: hash::keccak256(ip_address.bytes()),
            first_seen: current_time,
            last_seen: current_time,
            trusted: false,
        }
    }

    /// Update device fingerprint
    public fun update_device_fingerprint(
        device: &mut DeviceFingerprint,
        clock: &Clock,
    ) {
        device.last_seen = clock::timestamp_ms(clock);
    }

    /// Mark device as trusted
    public fun trust_device(
        device: &mut DeviceFingerprint,
        _validator_cap: &PolicyValidatorCap,
    ) {
        device.trusted = true;
    }

    /// Validate device consistency
    /// Requirements: 5.5
    public fun validate_device_consistency(
        stored_device: &DeviceFingerprint,
        current_fingerprint: String,
        current_user_agent: String,
        current_ip: String,
    ): bool {
        let current_fingerprint_hash = hash::keccak256(current_fingerprint.bytes());
        let current_user_agent_hash = hash::keccak256(current_user_agent.bytes());
        let current_ip_hash = hash::keccak256(current_ip.bytes());
        
        // Check fingerprint consistency
        if (stored_device.fingerprint_hash != current_fingerprint_hash) {
            return false
        };
        
        // Check user agent consistency (allow some variation)
        if (stored_device.user_agent_hash != current_user_agent_hash) {
            return false
        };
        
        // IP can change, so we don't enforce strict consistency
        true
    }

    // ============================================================================
    // POLICY VALIDATION
    // ============================================================================

    /// Validate authentication policy compliance
    /// Requirements: 10.5
    public fun validate_auth_policy(
        email_required: bool,
        phone_required: bool,
        passkey_required: bool,
        mfa_required: bool,
        provided_email: bool,
        provided_phone: bool,
        provided_passkey: bool,
        mfa_completed: bool,
    ): bool {
        // Check required authentication methods
        if (email_required && !provided_email) return false;
        if (phone_required && !provided_phone) return false;
        if (passkey_required && !provided_passkey) return false;
        
        // Check MFA requirement
        if (mfa_required && !mfa_completed) return false;
        
        true
    }

    /// Validate session policy compliance
    public fun validate_session_policy(
        session: &SessionToken,
        max_sessions: u8,
        current_session_count: u8,
        clock: &Clock,
    ): bool {
        let current_time = clock::timestamp_ms(clock);
        
        // Check session limits
        if (current_session_count >= max_sessions) {
            return false
        };
        
        // Check session expiry
        if (current_time > session.expires_at) {
            return false
        };
        
        // Check if session is active
        session.is_active
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    /// Get session account ID
    public fun get_session_account_id(session: &SessionToken): ID {
        session.account_id
    }

    /// Get session device fingerprint
    public fun get_session_device_fingerprint(session: &SessionToken): &String {
        &session.device_fingerprint
    }

    /// Get session expiry time
    public fun get_session_expires_at(session: &SessionToken): u64 {
        session.expires_at
    }

    /// Check if session is active
    public fun is_session_active(session: &SessionToken): bool {
        session.is_active
    }

    /// Check if device is trusted
    public fun is_device_trusted(device: &DeviceFingerprint): bool {
        device.trusted
    }

    /// Get device first seen time
    public fun get_device_first_seen(device: &DeviceFingerprint): u64 {
        device.first_seen
    }

    /// Get device last seen time
    public fun get_device_last_seen(device: &DeviceFingerprint): u64 {
        device.last_seen
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    /// Create authentication credentials
    public fun create_auth_credentials(
        credential_type: u8,
        identifier: String,
        proof: vector<u8>,
        device_fingerprint: String,
    ): AuthCredentials {
        AuthCredentials {
            credential_type,
            identifier,
            proof,
            device_fingerprint,
        }
    }

    /// Create MFA state
    public fun create_mfa_state(clock: &Clock): MFAState {
        MFAState {
            primary_verified: false,
            secondary_verified: false,
            verification_time: clock::timestamp_ms(clock),
            attempts: 0,
        }
    }

    // ============================================================================
    // TESTS
    // ============================================================================

    #[test_only]
    public fun test_create_session(ctx: &mut TxContext): SessionToken {
        use sui::clock;
        
        let clock = clock::create_for_testing(ctx);
        let session = create_session(
            @0x1.to_id(),
            string::utf8(b"test_device"),
            86400000, // 24 hours
            &clock,
            ctx
        );
        
        clock::destroy_for_testing(clock);
        session
    }
}