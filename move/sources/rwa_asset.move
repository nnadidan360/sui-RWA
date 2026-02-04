module credit_os::rwa_asset {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use sui::clock::{Self, Clock};
    use sui::event;

    // Error codes
    const E_INVALID_CONFIDENCE_SCORE: u64 = 1;
    const E_ATTESTATION_EXPIRED: u64 = 2;
    const E_ATTESTATION_REVOKED: u64 = 3;
    const E_UNAUTHORIZED: u64 = 4;
    const E_INVALID_STATUS: u64 = 5;

    // Attestation status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_EXPIRED: u8 = 1;
    const STATUS_REVOKED: u8 = 2;

    /// RWA Attestation Object representing verified real-world asset
    struct RWAAttestationObject has key, store {
        id: UID,
        attestation_id: String,
        document_hash: String,
        asset_type: String,
        jurisdiction: String,
        confidence_score: u8,
        verification_status: String,
        attested_at: u64,
        expires_at: u64,
        status: u8,
        metadata: String,
        owner: address,
        created_by: address,
    }

    /// Capability for creating attestations (admin only)
    struct AttestationCapability has key, store {
        id: UID,
    }

    /// Event emitted when attestation is created
    struct AttestationCreated has copy, drop {
        attestation_id: String,
        object_id: address,
        document_hash: String,
        asset_type: String,
        owner: address,
        confidence_score: u8,
    }

    /// Event emitted when attestation status is updated
    struct AttestationStatusUpdated has copy, drop {
        attestation_id: String,
        object_id: address,
        old_status: u8,
        new_status: u8,
        reason: String,
    }

    /// Event emitted when attestation is transferred
    struct AttestationTransferred has copy, drop {
        attestation_id: String,
        object_id: address,
        from: address,
        to: address,
    }

    /// Initialize module and create admin capability
    fun init(ctx: &mut TxContext) {
        let capability = AttestationCapability {
            id: object::new(ctx),
        };
        transfer::transfer(capability, tx_context::sender(ctx));
    }

    /// Mint new RWA attestation NFT
    public entry fun mint_attestation(
        _capability: &AttestationCapability,
        attestation_id: String,
        document_hash: String,
        asset_type: String,
        jurisdiction: String,
        confidence_score: u8,
        verification_status: String,
        metadata: String,
        owner: address,
        expires_at: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate confidence score
        assert!(confidence_score <= 100, E_INVALID_CONFIDENCE_SCORE);

        let current_time = clock::timestamp_ms(clock);
        
        let attestation = RWAAttestationObject {
            id: object::new(ctx),
            attestation_id,
            document_hash,
            asset_type,
            jurisdiction,
            confidence_score,
            verification_status,
            attested_at: current_time,
            expires_at,
            status: STATUS_ACTIVE,
            metadata,
            owner,
            created_by: tx_context::sender(ctx),
        };

        let object_id = object::uid_to_address(&attestation.id);

        // Emit creation event
        event::emit(AttestationCreated {
            attestation_id,
            object_id,
            document_hash,
            asset_type,
            owner,
            confidence_score,
        });

        // Transfer to owner
        transfer::transfer(attestation, owner);
    }

    /// Update attestation status (expire or revoke)
    public entry fun update_attestation_status(
        attestation: &mut RWAAttestationObject,
        new_status: u8,
        reason: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only owner or creator can update status
        let sender = tx_context::sender(ctx);
        assert!(sender == attestation.owner || sender == attestation.created_by, E_UNAUTHORIZED);

        // Validate status
        assert!(new_status <= STATUS_REVOKED, E_INVALID_STATUS);

        let old_status = attestation.status;
        attestation.status = new_status;

        // If expiring, update expires_at to current time
        if (new_status == STATUS_EXPIRED) {
            attestation.expires_at = clock::timestamp_ms(clock);
        };

        let object_id = object::uid_to_address(&attestation.id);

        // Emit status update event
        event::emit(AttestationStatusUpdated {
            attestation_id: attestation.attestation_id,
            object_id,
            old_status,
            new_status,
            reason,
        });
    }

    /// Transfer attestation to new owner
    public entry fun transfer_attestation(
        attestation: RWAAttestationObject,
        new_owner: address,
        ctx: &mut TxContext
    ) {
        let old_owner = attestation.owner;
        let sender = tx_context::sender(ctx);
        
        // Only current owner can transfer
        assert!(sender == old_owner, E_UNAUTHORIZED);

        // Update owner in object
        attestation.owner = new_owner;

        let object_id = object::uid_to_address(&attestation.id);

        // Emit transfer event
        event::emit(AttestationTransferred {
            attestation_id: attestation.attestation_id,
            object_id,
            from: old_owner,
            to: new_owner,
        });

        // Transfer to new owner
        transfer::transfer(attestation, new_owner);
    }

    /// Check if attestation is valid (not expired or revoked)
    public fun is_attestation_valid(
        attestation: &RWAAttestationObject,
        clock: &Clock
    ): bool {
        if (attestation.status == STATUS_REVOKED) {
            return false
        };

        let current_time = clock::timestamp_ms(clock);
        if (current_time > attestation.expires_at) {
            return false
        };

        true
    }

    /// Get attestation details
    public fun get_attestation_details(attestation: &RWAAttestationObject): (
        String,  // attestation_id
        String,  // document_hash
        String,  // asset_type
        String,  // jurisdiction
        u8,      // confidence_score
        String,  // verification_status
        u64,     // attested_at
        u64,     // expires_at
        u8,      // status
        address, // owner
    ) {
        (
            attestation.attestation_id,
            attestation.document_hash,
            attestation.asset_type,
            attestation.jurisdiction,
            attestation.confidence_score,
            attestation.verification_status,
            attestation.attested_at,
            attestation.expires_at,
            attestation.status,
            attestation.owner,
        )
    }

    /// Get attestation metadata
    public fun get_attestation_metadata(attestation: &RWAAttestationObject): String {
        attestation.metadata
    }

    /// Verify document hash matches attestation
    public fun verify_document_hash(
        attestation: &RWAAttestationObject,
        document_hash: String
    ): bool {
        attestation.document_hash == document_hash
    }

    /// Check if attestation meets minimum confidence threshold
    public fun meets_confidence_threshold(
        attestation: &RWAAttestationObject,
        threshold: u8
    ): bool {
        attestation.confidence_score >= threshold
    }

    /// Get attestation age in milliseconds
    public fun get_attestation_age(
        attestation: &RWAAttestationObject,
        clock: &Clock
    ): u64 {
        let current_time = clock::timestamp_ms(clock);
        if (current_time > attestation.attested_at) {
            current_time - attestation.attested_at
        } else {
            0
        }
    }

    /// Check if attestation is for specific asset type
    public fun is_asset_type(
        attestation: &RWAAttestationObject,
        asset_type: String
    ): bool {
        attestation.asset_type == asset_type
    }

    /// Check if attestation is for specific jurisdiction
    public fun is_jurisdiction(
        attestation: &RWAAttestationObject,
        jurisdiction: String
    ): bool {
        attestation.jurisdiction == jurisdiction
    }

    /// Batch verify multiple attestations
    public fun batch_verify_attestations(
        attestations: &vector<RWAAttestationObject>,
        clock: &Clock
    ): vector<bool> {
        let results = vector::empty<bool>();
        let i = 0;
        let len = vector::length(attestations);
        
        while (i < len) {
            let attestation = vector::borrow(attestations, i);
            let is_valid = is_attestation_valid(attestation, clock);
            vector::push_back(&mut results, is_valid);
            i = i + 1;
        };
        
        results
    }

    /// Create attestation capability (admin function)
    public entry fun create_attestation_capability(
        _admin_cap: &AttestationCapability,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let capability = AttestationCapability {
            id: object::new(ctx),
        };
        transfer::transfer(capability, recipient);
    }

    // Test functions for development
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_attestation(
        capability: &AttestationCapability,
        owner: address,
        ctx: &mut TxContext
    ): RWAAttestationObject {
        let current_time = 1000000; // Mock timestamp
        let expires_at = current_time + 31536000000; // 1 year from now
        
        RWAAttestationObject {
            id: object::new(ctx),
            attestation_id: string::utf8(b"TEST-12345678"),
            document_hash: string::utf8(b"abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234"),
            asset_type: string::utf8(b"real_estate"),
            jurisdiction: string::utf8(b"US"),
            confidence_score: 85,
            verification_status: string::utf8(b"verified"),
            attested_at: current_time,
            expires_at,
            status: STATUS_ACTIVE,
            metadata: string::utf8(b"{}"),
            owner,
            created_by: tx_context::sender(ctx),
        }
    }
}