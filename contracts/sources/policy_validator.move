/// Policy Validator module for Credit OS
/// Provides on-chain validation for capability-based permissions and system actions
module credit_os::policy_validator {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};

    /// Error codes
    const EInvalidPolicyType: u64 = 1;
    const EPolicyNotFound: u64 = 2;
    const EValidationFailed: u64 = 3;
    const EInsufficientCapabilities: u64 = 4;
    const EPolicyInactive: u64 = 5;
    const EInvalidValidationRule: u64 = 6;
    const ECapabilityExpired: u64 = 7;
    const ECapabilityRevoked: u64 = 8;

    /// Policy type constants
    const POLICY_AUTHENTICATION: u8 = 0;
    const POLICY_BORROWING: u8 = 1;
    const POLICY_WITHDRAWAL: u8 = 2;
    const POLICY_ASSET_UPLOAD: u8 = 3;
    const POLICY_RECOVERY: u8 = 4;
    const POLICY_ADMIN: u8 = 5;

    /// Validation rule type constants
    const RULE_CAPABILITY_REQUIRED: u8 = 0;
    const RULE_SESSION_VALID: u8 = 1;
    const RULE_SPENDING_LIMIT: u8 = 2;
    const RULE_TIME_RESTRICTION: u8 = 3;
    const RULE_DEVICE_BINDING: u8 = 4;
    const RULE_FRAUD_CHECK: u8 = 5;
    const RULE_MULTI_FACTOR: u8 = 6;

    /// Capability status constants
    const CAPABILITY_ACTIVE: u8 = 0;
    const CAPABILITY_EXPIRED: u8 = 1;
    const CAPABILITY_REVOKED: u8 = 2;
    const CAPABILITY_SUSPENDED: u8 = 3;

    /// Validation rule structure
    struct ValidationRule has store {
        rule_type: u8,
        parameters: vector<u8>, // Encoded rule parameters
        error_message: String,
        is_required: bool,
        priority: u8, // Higher priority rules checked first
    }

    /// Capability requirement structure
    struct CapabilityRequirement has store {
        capability_type: String,
        minimum_level: u64,
        expiry_check: bool,
        revocation_check: bool,
    }

    /// Policy validator configuration
    struct PolicyValidator has key, store {
        id: UID,
        policy_type: u8,
        policy_name: String,
        validation_rules: vector<ValidationRule>,
        capability_requirements: vector<CapabilityRequirement>,
        is_active: bool,
        created_at: u64,
        updated_at: u64,
        version: u64,
    }

    /// Validation context for checking policies
    struct ValidationContext has store {
        user_account_id: address,
        session_token: String,
        device_id: String,
        action_type: String,
        action_parameters: vector<u8>,
        timestamp: u64,
        capabilities: vector<CapabilityInfo>,
        fraud_signals: vector<String>,
    }

    /// Capability information for validation
    struct CapabilityInfo has store {
        capability_id: address,
        capability_type: String,
        level: u64,
        expires_at: u64,
        status: u8,
        granted_at: u64,
        last_used: u64,
    }

    /// Validation result
    struct ValidationResult has store {
        is_valid: bool,
        failed_rules: vector<String>,
        warnings: vector<String>,
        required_actions: vector<String>,
        validation_score: u8, // 0-100 confidence score
    }

    /// Policy registry for managing multiple validators
    struct PolicyRegistry has key, store {
        id: UID,
        validators: vector<address>, // PolicyValidator object IDs
        policy_mappings: vector<PolicyMapping>,
        default_policies: vector<address>,
        created_at: u64,
        updated_at: u64,
    }

    /// Policy mapping for action types
    struct PolicyMapping has store {
        action_type: String,
        policy_validator_id: address,
        is_active: bool,
    }

    /// Event emitted when policy validator is created
    struct PolicyValidatorCreated has copy, drop {
        validator_id: address,
        policy_type: u8,
        policy_name: String,
        created_at: u64,
    }

    /// Event emitted when validation is performed
    struct ValidationPerformed has copy, drop {
        validator_id: address,
        user_account_id: address,
        action_type: String,
        is_valid: bool,
        validation_score: u8,
        timestamp: u64,
    }

    /// Event emitted when validation fails
    struct ValidationFailed has copy, drop {
        validator_id: address,
        user_account_id: address,
        action_type: String,
        failed_rules: vector<String>,
        timestamp: u64,
    }

    /// Create a new policy validator
    public fun create_policy_validator(
        policy_type: u8,
        policy_name: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): PolicyValidator {
        let current_time = clock::timestamp_ms(clock);
        
        let validator = PolicyValidator {
            id: object::new(ctx),
            policy_type,
            policy_name,
            validation_rules: vector::empty(),
            capability_requirements: vector::empty(),
            is_active: true,
            created_at: current_time,
            updated_at: current_time,
            version: 1,
        };

        let validator_id = object::uid_to_address(&validator.id);
        sui::event::emit(PolicyValidatorCreated {
            validator_id,
            policy_type,
            policy_name,
            created_at: current_time,
        });

        validator
    }

    /// Create a policy registry
    public fun create_policy_registry(
        clock: &Clock,
        ctx: &mut TxContext
    ): PolicyRegistry {
        let current_time = clock::timestamp_ms(clock);
        
        PolicyRegistry {
            id: object::new(ctx),
            validators: vector::empty(),
            policy_mappings: vector::empty(),
            default_policies: vector::empty(),
            created_at: current_time,
            updated_at: current_time,
        }
    }

    /// Add a validation rule to a policy validator
    public fun add_validation_rule(
        validator: &mut PolicyValidator,
        rule_type: u8,
        parameters: vector<u8>,
        error_message: String,
        is_required: bool,
        priority: u8,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let rule = ValidationRule {
            rule_type,
            parameters,
            error_message,
            is_required,
            priority,
        };

        vector::push_back(&mut validator.validation_rules, rule);
        validator.updated_at = clock::timestamp_ms(clock);
        validator.version = validator.version + 1;
    }

    /// Add a capability requirement to a policy validator
    public fun add_capability_requirement(
        validator: &mut PolicyValidator,
        capability_type: String,
        minimum_level: u64,
        expiry_check: bool,
        revocation_check: bool,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let requirement = CapabilityRequirement {
            capability_type,
            minimum_level,
            expiry_check,
            revocation_check,
        };

        vector::push_back(&mut validator.capability_requirements, requirement);
        validator.updated_at = clock::timestamp_ms(clock);
        validator.version = validator.version + 1;
    }

    /// Validate an action against a policy
    public fun validate_action(
        validator: &PolicyValidator,
        context: &ValidationContext,
        clock: &Clock,
        _ctx: &mut TxContext
    ): ValidationResult {
        assert!(validator.is_active, EPolicyInactive);
        
        let current_time = clock::timestamp_ms(clock);
        let mut result = ValidationResult {
            is_valid: true,
            failed_rules: vector::empty(),
            warnings: vector::empty(),
            required_actions: vector::empty(),
            validation_score: 100,
        };

        // Validate capability requirements first
        validate_capability_requirements(validator, context, &mut result, current_time);

        // Validate individual rules
        validate_rules(validator, context, &mut result, current_time);

        // Emit validation event
        let validator_id = object::uid_to_address(&validator.id);
        sui::event::emit(ValidationPerformed {
            validator_id,
            user_account_id: context.user_account_id,
            action_type: context.action_type,
            is_valid: result.is_valid,
            validation_score: result.validation_score,
            timestamp: current_time,
        });

        // Emit failure event if validation failed
        if (!result.is_valid) {
            sui::event::emit(ValidationFailed {
                validator_id,
                user_account_id: context.user_account_id,
                action_type: context.action_type,
                failed_rules: result.failed_rules,
                timestamp: current_time,
            });
        };

        result
    }

    /// Validate capability requirements
    fun validate_capability_requirements(
        validator: &PolicyValidator,
        context: &ValidationContext,
        result: &mut ValidationResult,
        current_time: u64
    ) {
        let requirements = &validator.capability_requirements;
        let req_len = vector::length(requirements);
        let mut i = 0;

        while (i < req_len) {
            let requirement = vector::borrow(requirements, i);
            let mut capability_found = false;
            let mut capability_valid = false;

            // Check if user has required capability
            let capabilities = &context.capabilities;
            let cap_len = vector::length(capabilities);
            let mut j = 0;

            while (j < cap_len) {
                let capability = vector::borrow(capabilities, j);
                
                if (capability.capability_type == requirement.capability_type) {
                    capability_found = true;
                    
                    // Check capability level
                    if (capability.level >= requirement.minimum_level) {
                        // Check expiry if required
                        if (requirement.expiry_check && capability.expires_at <= current_time) {
                            vector::push_back(&mut result.failed_rules, 
                                string::utf8(b"Capability expired"));
                            result.validation_score = result.validation_score - 20;
                        } else if (requirement.revocation_check && capability.status != CAPABILITY_ACTIVE) {
                            vector::push_back(&mut result.failed_rules, 
                                string::utf8(b"Capability revoked or suspended"));
                            result.validation_score = result.validation_score - 25;
                        } else {
                            capability_valid = true;
                        }
                    } else {
                        vector::push_back(&mut result.failed_rules, 
                            string::utf8(b"Insufficient capability level"));
                        result.validation_score = result.validation_score - 15;
                    }
                    break
                };
                j = j + 1;
            };

            if (!capability_found) {
                vector::push_back(&mut result.failed_rules, 
                    string::utf8(b"Required capability not found"));
                result.validation_score = result.validation_score - 30;
                result.is_valid = false;
            } else if (!capability_valid) {
                result.is_valid = false;
            };

            i = i + 1;
        };
    }

    /// Validate individual rules
    fun validate_rules(
        validator: &PolicyValidator,
        context: &ValidationContext,
        result: &mut ValidationResult,
        current_time: u64
    ) {
        let rules = &validator.validation_rules;
        let len = vector::length(rules);
        let mut i = 0;

        while (i < len) {
            let rule = vector::borrow(rules, i);
            let rule_result = validate_single_rule(rule, context, current_time);
            
            if (!rule_result) {
                if (rule.is_required) {
                    result.is_valid = false;
                    vector::push_back(&mut result.failed_rules, rule.error_message);
                    result.validation_score = result.validation_score - (rule.priority as u8) * 5;
                } else {
                    vector::push_back(&mut result.warnings, rule.error_message);
                    result.validation_score = result.validation_score - 5;
                }
            };

            i = i + 1;
        };
    }

    /// Validate a single rule
    fun validate_single_rule(
        rule: &ValidationRule,
        context: &ValidationContext,
        current_time: u64
    ): bool {
        if (rule.rule_type == RULE_SESSION_VALID) {
            // Check if session token is not empty and not expired
            !string::is_empty(&context.session_token)
        } else if (rule.rule_type == RULE_DEVICE_BINDING) {
            // Check if device ID is provided
            !string::is_empty(&context.device_id)
        } else if (rule.rule_type == RULE_FRAUD_CHECK) {
            // Check if there are no critical fraud signals
            vector::length(&context.fraud_signals) == 0
        } else if (rule.rule_type == RULE_TIME_RESTRICTION) {
            // Basic time validation - could be enhanced with specific time windows
            current_time > 0
        } else {
            // Default to true for unknown rule types
            true
        }
    }

    /// Register a policy validator in the registry
    public fun register_validator(
        registry: &mut PolicyRegistry,
        validator_id: address,
        action_type: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let mapping = PolicyMapping {
            action_type,
            policy_validator_id: validator_id,
            is_active: true,
        };

        vector::push_back(&mut registry.validators, validator_id);
        vector::push_back(&mut registry.policy_mappings, mapping);
        registry.updated_at = clock::timestamp_ms(clock);
    }

    /// Find validator for action type
    public fun find_validator_for_action(
        registry: &PolicyRegistry,
        action_type: String
    ): Option<address> {
        let mappings = &registry.policy_mappings;
        let len = vector::length(mappings);
        let mut i = 0;

        while (i < len) {
            let mapping = vector::borrow(mappings, i);
            if (mapping.action_type == action_type && mapping.is_active) {
                return option::some(mapping.policy_validator_id)
            };
            i = i + 1;
        };

        option::none()
    }

    /// Create validation context
    public fun create_validation_context(
        user_account_id: address,
        session_token: String,
        device_id: String,
        action_type: String,
        action_parameters: vector<u8>,
        capabilities: vector<CapabilityInfo>,
        fraud_signals: vector<String>,
        clock: &Clock,
        _ctx: &mut TxContext
    ): ValidationContext {
        ValidationContext {
            user_account_id,
            session_token,
            device_id,
            action_type,
            action_parameters,
            timestamp: clock::timestamp_ms(clock),
            capabilities,
            fraud_signals,
        }
    }

    /// Create capability info
    public fun create_capability_info(
        capability_id: address,
        capability_type: String,
        level: u64,
        expires_at: u64,
        status: u8,
        granted_at: u64,
        last_used: u64
    ): CapabilityInfo {
        CapabilityInfo {
            capability_id,
            capability_type,
            level,
            expires_at,
            status,
            granted_at,
            last_used,
        }
    }

    /// Activate/deactivate a policy validator
    public fun set_validator_active(
        validator: &mut PolicyValidator,
        is_active: bool,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        validator.is_active = is_active;
        validator.updated_at = clock::timestamp_ms(clock);
        validator.version = validator.version + 1;
    }

    // === Getter functions ===

    /// Get policy type
    public fun get_policy_type(validator: &PolicyValidator): u8 {
        validator.policy_type
    }

    /// Get policy name
    public fun get_policy_name(validator: &PolicyValidator): String {
        validator.policy_name
    }

    /// Check if validator is active
    public fun is_validator_active(validator: &PolicyValidator): bool {
        validator.is_active
    }

    /// Get validation rule count
    public fun get_rule_count(validator: &PolicyValidator): u64 {
        vector::length(&validator.validation_rules)
    }

    /// Get capability requirement count
    public fun get_capability_requirement_count(validator: &PolicyValidator): u64 {
        vector::length(&validator.capability_requirements)
    }

    /// Get validator version
    public fun get_validator_version(validator: &PolicyValidator): u64 {
        validator.version
    }

    /// Check validation result
    public fun is_validation_successful(result: &ValidationResult): bool {
        result.is_valid
    }

    /// Get validation score
    public fun get_validation_score(result: &ValidationResult): u8 {
        result.validation_score
    }

    /// Get failed rules count
    public fun get_failed_rules_count(result: &ValidationResult): u64 {
        vector::length(&result.failed_rules)
    }

    /// Get warnings count
    public fun get_warnings_count(result: &ValidationResult): u64 {
        vector::length(&result.warnings)
    }
}