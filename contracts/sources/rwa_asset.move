/// RWA Asset Attestation module for Credit OS
/// Provides on-chain attestation NFTs for Real World Assets with document hashes and jurisdiction codes
module credit_os::rwa_asset {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const EInvalidJurisdiction: u64 = 1;
    const EInvalidDocumentHash: u64 = 2;
    const EAttestationRevoked: u64 = 3;
    const EUnauthorizedUpdate: u64 = 4;
    const EInvalidConfidenceScore: u64 = 5;

    /// Attestation status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_VERIFIED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;
    const STATUS_REVOKED: u8 = 3;

    /// Document hash structure
    struct DocumentHash has store, copy, drop {
        hash: String, // SHA-256 hash
        document_type: String, // deed, title, invoice, etc.
        uploaded_at: u64,
    }

    /// RWA Attestation Object - NFT representing verified real-world asset
    struct RWAAttestationObject has key, store {
        id: UID,
        internal_asset_id: String, // MongoDB asset ID
        owner_account_id: String, // Internal user ID
        asset_type: String, // property, vehicle, equipment, invoice, etc.
        jurisdiction_code: String, // ISO 3166-1 alpha-2 country code
        document_hashes: vector<DocumentHash>,
        confidence_score: u64, // 0-100 score from asset intelligence
        verification_status: u8, // pending, verified, rejected, revoked
        verified_by: String, // Verifier ID or "system"
        created_at: u64,
        verified_at: u64,
        last_updated: u64,
        metadata_uri: String, // IPFS or storage URI for additional metadata
    }

    /// Event emitted when attestation is created
    struct AttestationCreated has copy, drop {
        attestation_id: address,
        internal_asset_id: String,
        owner_account_id: String,
        asset_type: String,
        jurisdiction_code: String,
        created_at: u64,
    }

    /// Event emitted when attestation is verified
    struct AttestationVerified has copy, drop {
        attestation_id: address,
        verified_by: String,
        confidence_score: u64,
        verified_at: u64,
    }

    /// Event emitted when attestation is revoked
    struct AttestationRevoked has copy, drop {
        attestation_id: address,
        revoked_by: String,
        reason: String,
        revoked_at: u64,
    }

    /// Event emitted when attestation is updated
    struct AttestationUpdated has copy, drop {
        attestation_id: address,
        updated_by: String,
        updated_at: u64,
    }

    /// Create a new RWA attestation object
    public fun create_attestation(
        internal_asset_id: String,
        owner_account_id: String,
        asset_type: String,
        jurisdiction_code: String,
        metadata_uri: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): RWAAttestationObject {
        let current_time = clock::timestamp_ms(clock);

        let attestation = RWAAttestationObject {
            id: object::new(ctx),
            internal_asset_id,
            owner_account_id,
            asset_type,
            jurisdiction_code,
            document_hashes: vector::empty(),
            confidence_score: 0,
            verification_status: STATUS_PENDING,
            verified_by: string::utf8(b""),
            created_at: current_time,
            verified_at: 0,
            last_updated: current_time,
            metadata_uri,
        };

        let attestation_id = object::uid_to_address(&attestation.id);

        sui::event::emit(AttestationCreated {
            attestation_id,
            internal_asset_id: attestation.internal_asset_id,
            owner_account_id: attestation.owner_account_id,
            asset_type: attestation.asset_type,
            jurisdiction_code: attestation.jurisdiction_code,
            created_at: current_time,
        });

        attestation
    }

    /// Add a document hash to the attestation
    public fun add_document_hash(
        attestation: &mut RWAAttestationObject,
        hash: String,
        document_type: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(attestation.verification_status != STATUS_REVOKED, EAttestationRevoked);
        
        let current_time = clock::timestamp_ms(clock);
        
        let doc_hash = DocumentHash {
            hash,
            document_type,
            uploaded_at: current_time,
        };

        vector::push_back(&mut attestation.document_hashes, doc_hash);
        attestation.last_updated = current_time;
    }

    /// Verify the attestation with confidence score
    public fun verify_attestation(
        attestation: &mut RWAAttestationObject,
        verifier_id: String,
        confidence_score: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(confidence_score <= 100, EInvalidConfidenceScore);
        assert!(attestation.verification_status != STATUS_REVOKED, EAttestationRevoked);
        
        let current_time = clock::timestamp_ms(clock);
        
        attestation.verification_status = STATUS_VERIFIED;
        attestation.verified_by = verifier_id;
        attestation.confidence_score = confidence_score;
        attestation.verified_at = current_time;
        attestation.last_updated = current_time;

        let attestation_id = object::uid_to_address(&attestation.id);

        sui::event::emit(AttestationVerified {
            attestation_id,
            verified_by: verifier_id,
            confidence_score,
            verified_at: current_time,
        });
    }

    /// Reject the attestation
    public fun reject_attestation(
        attestation: &mut RWAAttestationObject,
        verifier_id: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(attestation.verification_status != STATUS_REVOKED, EAttestationRevoked);
        
        let current_time = clock::timestamp_ms(clock);
        
        attestation.verification_status = STATUS_REJECTED;
        attestation.verified_by = verifier_id;
        attestation.last_updated = current_time;
    }

    /// Revoke the attestation (admin function)
    public fun revoke_attestation(
        attestation: &mut RWAAttestationObject,
        revoker_id: String,
        reason: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        attestation.verification_status = STATUS_REVOKED;
        attestation.last_updated = current_time;

        let attestation_id = object::uid_to_address(&attestation.id);

        sui::event::emit(AttestationRevoked {
            attestation_id,
            revoked_by: revoker_id,
            reason,
            revoked_at: current_time,
        });
    }

    /// Update confidence score (for re-evaluation)
    public fun update_confidence_score(
        attestation: &mut RWAAttestationObject,
        new_score: u64,
        updated_by: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(new_score <= 100, EInvalidConfidenceScore);
        assert!(attestation.verification_status == STATUS_VERIFIED, EUnauthorizedUpdate);
        
        let current_time = clock::timestamp_ms(clock);
        
        attestation.confidence_score = new_score;
        attestation.last_updated = current_time;

        let attestation_id = object::uid_to_address(&attestation.id);

        sui::event::emit(AttestationUpdated {
            attestation_id,
            updated_by,
            updated_at: current_time,
        });
    }

    /// Update metadata URI
    public fun update_metadata_uri(
        attestation: &mut RWAAttestationObject,
        new_uri: String,
        updated_by: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(attestation.verification_status != STATUS_REVOKED, EAttestationRevoked);
        
        let current_time = clock::timestamp_ms(clock);
        
        attestation.metadata_uri = new_uri;
        attestation.last_updated = current_time;

        let attestation_id = object::uid_to_address(&attestation.id);

        sui::event::emit(AttestationUpdated {
            attestation_id,
            updated_by,
            updated_at: current_time,
        });
    }

    // === Getter functions ===

    /// Get internal asset ID
    public fun get_internal_asset_id(attestation: &RWAAttestationObject): String {
        attestation.internal_asset_id
    }

    /// Get owner account ID
    public fun get_owner_account_id(attestation: &RWAAttestationObject): String {
        attestation.owner_account_id
    }

    /// Get asset type
    public fun get_asset_type(attestation: &RWAAttestationObject): String {
        attestation.asset_type
    }

    /// Get jurisdiction code
    public fun get_jurisdiction_code(attestation: &RWAAttestationObject): String {
        attestation.jurisdiction_code
    }

    /// Get confidence score
    public fun get_confidence_score(attestation: &RWAAttestationObject): u64 {
        attestation.confidence_score
    }

    /// Get verification status
    public fun get_verification_status(attestation: &RWAAttestationObject): u8 {
        attestation.verification_status
    }

    /// Get verified by
    public fun get_verified_by(attestation: &RWAAttestationObject): String {
        attestation.verified_by
    }

    /// Get document hash count
    public fun get_document_hash_count(attestation: &RWAAttestationObject): u64 {
        vector::length(&attestation.document_hashes)
    }

    /// Get metadata URI
    public fun get_metadata_uri(attestation: &RWAAttestationObject): String {
        attestation.metadata_uri
    }

    /// Check if attestation is verified
    public fun is_verified(attestation: &RWAAttestationObject): bool {
        attestation.verification_status == STATUS_VERIFIED
    }

    /// Check if attestation is revoked
    public fun is_revoked(attestation: &RWAAttestationObject): bool {
        attestation.verification_status == STATUS_REVOKED
    }

    /// Get created timestamp
    public fun get_created_at(attestation: &RWAAttestationObject): u64 {
        attestation.created_at
    }

    /// Get verified timestamp
    public fun get_verified_at(attestation: &RWAAttestationObject): u64 {
        attestation.verified_at
    }
}
