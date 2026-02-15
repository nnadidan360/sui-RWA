/**
 * Withdrawal Router Module
 * 
 * Manages dynamic withdrawal routing for crypto and card payments with
 * first-time user incentives and fraud prevention.
 * 
 * Requirements: 5.1, 5.3, 5.4, 12.5
 */

module credit_os::withdrawal_router {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    /// Error codes
    const E_INVALID_AMOUNT: u64 = 1;
    const E_POLICY_NOT_FOUND: u64 = 2;
    const E_INCENTIVE_EXHAUSTED: u64 = 3;
    const E_DAILY_LIMIT_EXCEEDED: u64 = 4;
    const E_UNAUTHORIZED: u64 = 5;
    const E_INVALID_METHOD: u64 = 6;

    /// Withdrawal methods
    const METHOD_CRYPTO: u8 = 1;
    const METHOD_CARD: u8 = 2;
    const METHOD_USDSUI: u8 = 3;

    /// WithdrawalPolicyObject tracks user withdrawal incentives and limits
    struct WithdrawalPolicyObject has key, store {
        id: UID,
        user_account_id: ID,
        
        // Crypto withdrawal incentives (first 3 free)
        free_crypto_withdrawals_remaining: u64,
        total_crypto_withdrawals: u64,
        
        // Card withdrawal incentives (1 month free)
        free_card_maintenance_until: u64, // timestamp
        card_maintenance_fee_paid: u64,
        
        // USDSui incentives (always free)
        total_usdsui_withdrawals: u64,
        
        // Fraud prevention limits
        daily_withdrawal_limit: u64,
        daily_withdrawal_used: u64,
        last_withdrawal_date: u64,
        
        // Tracking
        created_at: u64,
        last_updated: u64
    }

    /// WithdrawalRequest represents a pending withdrawal
    struct WithdrawalRequest has key, store {
        id: UID,
        user_account_id: ID,
        policy_id: ID,
        amount: u64,
        method: u8, // METHOD_CRYPTO, METHOD_CARD, METHOD_USDSUI
        destination: vector<u8>, // address or card identifier
        gas_sponsored: bool,
        fee_amount: u64,
        status: u8, // 0=pending, 1=approved, 2=rejected, 3=completed
        created_at: u64
    }

    /// Events
    struct WithdrawalPolicyCreated has copy, drop {
        policy_id: ID,
        user_account_id: ID,
        free_crypto_withdrawals: u64,
        free_card_months: u64,
        timestamp: u64
    }

    struct WithdrawalRequested has copy, drop {
        request_id: ID,
        user_account_id: ID,
        amount: u64,
        method: u8,
        gas_sponsored: bool,
        timestamp: u64
    }

    struct WithdrawalCompleted has copy, drop {
        request_id: ID,
        user_account_id: ID,
        amount: u64,
        method: u8,
        fee_charged: u64,
        timestamp: u64
    }

    struct IncentiveUsed has copy, drop {
        policy_id: ID,
        user_account_id: ID,
        incentive_type: vector<u8>,
        remaining: u64,
        timestamp: u64
    }

    /// Create a new withdrawal policy for a user (first-time incentives)
    public entry fun create_withdrawal_policy(
        user_account_id: ID,
        ctx: &mut TxContext
    ) {
        let policy = WithdrawalPolicyObject {
            id: object::new(ctx),
            user_account_id,
            
            // First-time user incentives
            free_crypto_withdrawals_remaining: 3,
            total_crypto_withdrawals: 0,
            
            // 1 month free card maintenance (30 days)
            free_card_maintenance_until: tx_context::epoch_timestamp_ms(ctx) + (30 * 24 * 60 * 60 * 1000),
            card_maintenance_fee_paid: 0,
            
            // USDSui tracking
            total_usdsui_withdrawals: 0,
            
            // Daily limits (default $10,000)
            daily_withdrawal_limit: 10000000000, // in smallest units
            daily_withdrawal_used: 0,
            last_withdrawal_date: 0,
            
            created_at: tx_context::epoch_timestamp_ms(ctx),
            last_updated: tx_context::epoch_timestamp_ms(ctx)
        };

        let policy_id = object::id(&policy);

        event::emit(WithdrawalPolicyCreated {
            policy_id,
            user_account_id,
            free_crypto_withdrawals: 3,
            free_card_months: 1,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });

        transfer::public_transfer(policy, tx_context::sender(ctx));
    }

    /// Request a crypto withdrawal
    public entry fun request_crypto_withdrawal(
        policy: &mut WithdrawalPolicyObject,
        amount: u64,
        destination: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        
        // Check and reset daily limits if new day
        check_and_reset_daily_limit(policy, current_time);
        
        // Check daily limit
        assert!(policy.daily_withdrawal_used + amount <= policy.daily_withdrawal_limit, E_DAILY_LIMIT_EXCEEDED);
        
        // Determine if gas is sponsored (first 3 withdrawals)
        let gas_sponsored = policy.free_crypto_withdrawals_remaining > 0;
        let fee_amount = if (gas_sponsored) { 0 } else { calculate_crypto_fee(amount) };
        
        let request = WithdrawalRequest {
            id: object::new(ctx),
            user_account_id: policy.user_account_id,
            policy_id: object::id(policy),
            amount,
            method: METHOD_CRYPTO,
            destination,
            gas_sponsored,
            fee_amount,
            status: 0, // pending
            created_at: current_time
        };

        let request_id = object::id(&request);

        // Update policy
        if (gas_sponsored) {
            policy.free_crypto_withdrawals_remaining = policy.free_crypto_withdrawals_remaining - 1;
            
            event::emit(IncentiveUsed {
                policy_id: object::id(policy),
                user_account_id: policy.user_account_id,
                incentive_type: b"free_crypto_withdrawal",
                remaining: policy.free_crypto_withdrawals_remaining,
                timestamp: current_time
            });
        };
        
        policy.total_crypto_withdrawals = policy.total_crypto_withdrawals + 1;
        policy.daily_withdrawal_used = policy.daily_withdrawal_used + amount;
        policy.last_updated = current_time;

        event::emit(WithdrawalRequested {
            request_id,
            user_account_id: policy.user_account_id,
            amount,
            method: METHOD_CRYPTO,
            gas_sponsored,
            timestamp: current_time
        });

        transfer::public_transfer(request, tx_context::sender(ctx));
    }

    /// Request a card withdrawal
    public entry fun request_card_withdrawal(
        policy: &mut WithdrawalPolicyObject,
        amount: u64,
        card_identifier: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        
        // Check and reset daily limits if new day
        check_and_reset_daily_limit(policy, current_time);
        
        // Check daily limit
        assert!(policy.daily_withdrawal_used + amount <= policy.daily_withdrawal_limit, E_DAILY_LIMIT_EXCEEDED);
        
        // Check if within free maintenance period
        let is_free_period = current_time < policy.free_card_maintenance_until;
        let fee_amount = if (is_free_period) { 0 } else { calculate_card_fee(amount) };
        
        let request = WithdrawalRequest {
            id: object::new(ctx),
            user_account_id: policy.user_account_id,
            policy_id: object::id(policy),
            amount,
            method: METHOD_CARD,
            destination: card_identifier,
            gas_sponsored: false,
            fee_amount,
            status: 0, // pending
            created_at: current_time
        };

        let request_id = object::id(&request);

        // Update policy
        if (is_free_period) {
            event::emit(IncentiveUsed {
                policy_id: object::id(policy),
                user_account_id: policy.user_account_id,
                incentive_type: b"free_card_maintenance",
                remaining: (policy.free_card_maintenance_until - current_time) / (24 * 60 * 60 * 1000),
                timestamp: current_time
            });
        } else {
            policy.card_maintenance_fee_paid = policy.card_maintenance_fee_paid + fee_amount;
        };
        
        policy.daily_withdrawal_used = policy.daily_withdrawal_used + amount;
        policy.last_updated = current_time;

        event::emit(WithdrawalRequested {
            request_id,
            user_account_id: policy.user_account_id,
            amount,
            method: METHOD_CARD,
            gas_sponsored: false,
            timestamp: current_time
        });

        transfer::public_transfer(request, tx_context::sender(ctx));
    }

    /// Request a USDSui withdrawal (always free)
    public entry fun request_usdsui_withdrawal(
        policy: &mut WithdrawalPolicyObject,
        amount: u64,
        destination: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, E_INVALID_AMOUNT);
        
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        
        // Check and reset daily limits if new day
        check_and_reset_daily_limit(policy, current_time);
        
        // Check daily limit
        assert!(policy.daily_withdrawal_used + amount <= policy.daily_withdrawal_limit, E_DAILY_LIMIT_EXCEEDED);
        
        // USDSui withdrawals are always free (gas sponsored, zero fees)
        let request = WithdrawalRequest {
            id: object::new(ctx),
            user_account_id: policy.user_account_id,
            policy_id: object::id(policy),
            amount,
            method: METHOD_USDSUI,
            destination,
            gas_sponsored: true,
            fee_amount: 0,
            status: 0, // pending
            created_at: current_time
        };

        let request_id = object::id(&request);

        // Update policy
        policy.total_usdsui_withdrawals = policy.total_usdsui_withdrawals + 1;
        policy.daily_withdrawal_used = policy.daily_withdrawal_used + amount;
        policy.last_updated = current_time;

        event::emit(IncentiveUsed {
            policy_id: object::id(policy),
            user_account_id: policy.user_account_id,
            incentive_type: b"usdsui_free_withdrawal",
            remaining: 999999, // unlimited
            timestamp: current_time
        });

        event::emit(WithdrawalRequested {
            request_id,
            user_account_id: policy.user_account_id,
            amount,
            method: METHOD_USDSUI,
            gas_sponsored: true,
            timestamp: current_time
        });

        transfer::public_transfer(request, tx_context::sender(ctx));
    }

    /// Complete a withdrawal request
    public entry fun complete_withdrawal(
        request: WithdrawalRequest,
        ctx: &mut TxContext
    ) {
        let WithdrawalRequest {
            id,
            user_account_id,
            policy_id: _,
            amount,
            method,
            destination: _,
            gas_sponsored: _,
            fee_amount,
            status: _,
            created_at: _
        } = request;

        let request_id = object::uid_to_inner(&id);

        event::emit(WithdrawalCompleted {
            request_id,
            user_account_id,
            amount,
            method,
            fee_charged: fee_amount,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });

        object::delete(id);
    }

    /// Update daily withdrawal limit
    public entry fun update_daily_limit(
        policy: &mut WithdrawalPolicyObject,
        new_limit: u64,
        ctx: &mut TxContext
    ) {
        policy.daily_withdrawal_limit = new_limit;
        policy.last_updated = tx_context::epoch_timestamp_ms(ctx);
    }

    /// Helper: Check and reset daily limits if new day
    fun check_and_reset_daily_limit(
        policy: &mut WithdrawalPolicyObject,
        current_time: u64
    ) {
        let one_day_ms = 24 * 60 * 60 * 1000;
        
        if (policy.last_withdrawal_date == 0 || 
            current_time - policy.last_withdrawal_date >= one_day_ms) {
            policy.daily_withdrawal_used = 0;
            policy.last_withdrawal_date = current_time;
        };
    }

    /// Helper: Calculate crypto withdrawal fee (example: 0.5%)
    fun calculate_crypto_fee(amount: u64): u64 {
        (amount * 5) / 1000 // 0.5%
    }

    /// Helper: Calculate card withdrawal fee (example: 2%)
    fun calculate_card_fee(amount: u64): u64 {
        (amount * 20) / 1000 // 2%
    }

    /// Getters
    public fun get_free_crypto_remaining(policy: &WithdrawalPolicyObject): u64 {
        policy.free_crypto_withdrawals_remaining
    }

    public fun get_free_card_until(policy: &WithdrawalPolicyObject): u64 {
        policy.free_card_maintenance_until
    }

    public fun get_daily_limit_remaining(policy: &WithdrawalPolicyObject): u64 {
        policy.daily_withdrawal_limit - policy.daily_withdrawal_used
    }

    public fun get_total_crypto_withdrawals(policy: &WithdrawalPolicyObject): u64 {
        policy.total_crypto_withdrawals
    }

    public fun get_total_usdsui_withdrawals(policy: &WithdrawalPolicyObject): u64 {
        policy.total_usdsui_withdrawals
    }
}
