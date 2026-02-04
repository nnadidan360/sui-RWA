/// Credit OS Recovery Policy Module
/// Implements account recovery mechanisms without private key exposure
/// Requirements: 1.4, 12.1

module credit_os::recovery_policy {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use sui::hash;

    // ============================================================================
    // ERROR CODES
    // ============================================================================
    
    const ERecoveryNotAllowed: u64 = 1;
    const EInvalidRecoveryMethod: u64 = 2;
    const ERecoveryExpired: u64 = 3;
    const EInsufficientGuardians: u64 = 4;
    const ERecoveryAlreadyActive: u64 = 5;
    const EInvalidProof: u64 = 6;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /// Recovery request for account restoration
    struct RecoveryRequest has key, store {
        id: UID,
        account_id: ID,
        recovery_method: u8, // 0: email, 1: device, 2: guardian
        initiated_by: address,
        initiated_at: u64,
        expires_at: u64,
        status: u8, // 0: pending, 1: approved, 2: rejected, 3: expired
        proof_hash: vector<u8>,
        guardian_approvals: vector<address>,
        required_approvals: u8,
    }

    /// Guardian configuration for account recovery
    struct GuardianConfig has store, copy, drop {
        guardian_addresses: vector<address>,
        required_approvals: u8,
        recovery_delay: u64, // in milliseconds
        max_recovery_attempts: u8,
    }

    /// Recovery manager capability
    struct RecoveryManagerCap has key, store {
        id: UID,
    }

    /// Event emitted when recovery is initiated
    struct RecoveryInitiated has copy, drop {
        request_id: ID,
        account_id: ID,
        recovery_method: u8,
        initiated_by: address,
        initiated_at: u64,
        expires_at: u64,
    }

    /// Event emitted when recovery is completed
    struct RecoveryCompleted has copy, drop {
        request_id: ID,
        account_id: ID,
        recovery_method: u8,
        completed_at: u64,
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// Initialize the module
    fun init(ctx: &mut TxContext) {
        let manager_cap = RecoveryManagerCap {
            id: object::new(ctx),
        };
        transfer::transfer(manager_cap, tx_context::sender(ctx));
    }

    // ============================================================================
    // RECOVERY REQUEST MANAGEMENT
    // ============================================================================

    /// Initiate email recovery
    /// Requirements: 1.4
    public fun initiate_email_recovery(
        account_id: ID,
        email_proof: vector<u8>,
        recovery_delay: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): RecoveryRequest {
        let current_time = clock::timestamp_ms(clock);
        let expires_at = current_time + recovery_delay;
        
        let request = RecoveryRequest {
            id: object::new(ctx),
            account_id,
            recovery_method: 0, // email
            initiated_by: tx_context::sender(ctx),
            initiated_at: current_time,
            expires_at,
            status: 0, // pending
            proof_hash: hash::keccak256(&email_proof),
            guardian_approvals: vector::empty(),
            required_approvals: 0,
        };

        sui::event::emit(RecoveryInitiated {
            request_id: object::uid_to_inner(&request.id),
            account_id,
            recovery_method: 0,
            initiated_by: tx_context::sender(ctx),
            initiated_at: current_time,
            expires_at,
        });

        request
    }

    /// Complete recovery process
    public fun complete_recovery(
        request: &mut RecoveryRequest,
        _manager_cap: &RecoveryManagerCap,
        clock: &Clock,
    ) {
        assert!(request.status == 1, ERecoveryNotAllowed);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time <= request.expires_at, ERecoveryExpired);
        
        sui::event::emit(RecoveryCompleted {
            request_id: object::uid_to_inner(&request.id),
            account_id: request.account_id,
            recovery_method: request.recovery_method,
            completed_at: current_time,
        });
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    /// Get recovery request account ID
    public fun get_request_account_id(request: &RecoveryRequest): ID {
        request.account_id
    }

    /// Get recovery status
    public fun get_recovery_status(request: &RecoveryRequest): u8 {
        request.status
    }

    /// Check if recovery is approved
    public fun is_recovery_approved(request: &RecoveryRequest): bool {
        request.status == 1
    }
}