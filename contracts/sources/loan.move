/// Loan module for Credit OS
/// Provides transparent loan tracking and management on Sui blockchain
module credit_os::loan {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    /// Error codes
    const ELoanNotActive: u64 = 1;
    const EInvalidPayment: u64 = 2;
    const ELoanDefaulted: u64 = 3;
    const EUnauthorized: u64 = 4;

    /// Loan status constants
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_REPAID: u8 = 1;
    const STATUS_DEFAULTED: u8 = 2;
    const STATUS_LIQUIDATED: u8 = 3;

    /// Payment record
    struct PaymentRecord has store, copy, drop {
        amount: u64,
        timestamp: u64,
        payment_type: String, // "principal", "interest", "penalty"
    }

    /// Loan Object - transparent loan tracking
    struct LoanObject has key, store {
        id: UID,
        borrower_account_id: String,
        capability_id: address,
        principal_amount: u64,
        interest_rate_bps: u64,
        total_amount_due: u64,
        amount_paid: u64,
        amount_remaining: u64,
        collateral_type: String,
        collateral_refs: vector<address>,
        originated_at: u64,
        due_date: u64,
        last_payment_at: u64,
        status: u8,
        payment_history: vector<PaymentRecord>,
    }

    /// Events
    struct LoanOriginated has copy, drop {
        loan_id: address,
        borrower_account_id: String,
        principal_amount: u64,
        interest_rate: u64,
        due_date: u64,
        timestamp: u64,
    }

    struct PaymentMade has copy, drop {
        loan_id: address,
        amount: u64,
        amount_remaining: u64,
        payment_type: String,
        timestamp: u64,
    }

    struct LoanRepaid has copy, drop {
        loan_id: address,
        total_paid: u64,
        timestamp: u64,
    }

    struct LoanDefaulted has copy, drop {
        loan_id: address,
        amount_remaining: u64,
        timestamp: u64,
    }

    /// Originate a new loan
    public fun originate_loan(
        borrower_account_id: String,
        capability_id: address,
        principal_amount: u64,
        interest_rate_bps: u64,
        loan_duration_ms: u64,
        collateral_type: String,
        collateral_refs: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ): LoanObject {
        let current_time = clock::timestamp_ms(clock);
        let due_date = current_time + loan_duration_ms;

        // Calculate total amount due (principal + interest)
        let interest_amount = (principal_amount * interest_rate_bps) / 10000;
        let total_amount_due = principal_amount + interest_amount;

        let loan = LoanObject {
            id: object::new(ctx),
            borrower_account_id,
            capability_id,
            principal_amount,
            interest_rate_bps,
            total_amount_due,
            amount_paid: 0,
            amount_remaining: total_amount_due,
            collateral_type,
            collateral_refs,
            originated_at: current_time,
            due_date,
            last_payment_at: 0,
            status: STATUS_ACTIVE,
            payment_history: vector::empty(),
        };

        let loan_id = object::uid_to_address(&loan.id);

        sui::event::emit(LoanOriginated {
            loan_id,
            borrower_account_id: loan.borrower_account_id,
            principal_amount,
            interest_rate: interest_rate_bps,
            due_date,
            timestamp: current_time,
        });

        loan
    }

    /// Make a payment on the loan
    public fun make_payment(
        loan: &mut LoanObject,
        amount: u64,
        payment_type: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_ACTIVE, ELoanNotActive);
        assert!(amount > 0 && amount <= loan.amount_remaining, EInvalidPayment);

        let current_time = clock::timestamp_ms(clock);

        // Record payment
        let payment = PaymentRecord {
            amount,
            timestamp: current_time,
            payment_type: payment_type,
        };

        vector::push_back(&mut loan.payment_history, payment);

        // Update loan amounts
        loan.amount_paid = loan.amount_paid + amount;
        loan.amount_remaining = loan.amount_remaining - amount;
        loan.last_payment_at = current_time;

        let loan_id = object::uid_to_address(&loan.id);

        sui::event::emit(PaymentMade {
            loan_id,
            amount,
            amount_remaining: loan.amount_remaining,
            payment_type: payment.payment_type,
            timestamp: current_time,
        });

        // Check if loan is fully repaid
        if (loan.amount_remaining == 0) {
            loan.status = STATUS_REPAID;

            sui::event::emit(LoanRepaid {
                loan_id,
                total_paid: loan.amount_paid,
                timestamp: current_time,
            });
        };
    }

    /// Mark loan as defaulted
    public fun mark_defaulted(
        loan: &mut LoanObject,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_ACTIVE, ELoanNotActive);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time > loan.due_date, ELoanNotActive);

        loan.status = STATUS_DEFAULTED;

        let loan_id = object::uid_to_address(&loan.id);

        sui::event::emit(LoanDefaulted {
            loan_id,
            amount_remaining: loan.amount_remaining,
            timestamp: current_time,
        });
    }

    /// Mark loan as liquidated
    public fun mark_liquidated(
        loan: &mut LoanObject,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_DEFAULTED, ELoanDefaulted);

        let current_time = clock::timestamp_ms(clock);
        loan.status = STATUS_LIQUIDATED;
        loan.last_payment_at = current_time;
    }

    /// Check if loan is overdue
    public fun is_overdue(loan: &LoanObject, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time > loan.due_date && loan.status == STATUS_ACTIVE
    }

    /// Calculate days overdue
    public fun days_overdue(loan: &LoanObject, clock: &Clock): u64 {
        let current_time = clock::timestamp_ms(clock);
        if (current_time <= loan.due_date) {
            return 0
        };

        let overdue_ms = current_time - loan.due_date;
        overdue_ms / 86400000 // Convert to days
    }

    // === Getter functions ===

    public fun get_borrower_account_id(loan: &LoanObject): String {
        loan.borrower_account_id
    }

    public fun get_principal_amount(loan: &LoanObject): u64 {
        loan.principal_amount
    }

    public fun get_total_amount_due(loan: &LoanObject): u64 {
        loan.total_amount_due
    }

    public fun get_amount_paid(loan: &LoanObject): u64 {
        loan.amount_paid
    }

    public fun get_amount_remaining(loan: &LoanObject): u64 {
        loan.amount_remaining
    }

    public fun get_interest_rate(loan: &LoanObject): u64 {
        loan.interest_rate_bps
    }

    public fun get_status(loan: &LoanObject): u8 {
        loan.status
    }

    public fun get_due_date(loan: &LoanObject): u64 {
        loan.due_date
    }

    public fun get_payment_count(loan: &LoanObject): u64 {
        vector::length(&loan.payment_history)
    }

    public fun is_active(loan: &LoanObject): bool {
        loan.status == STATUS_ACTIVE
    }

    public fun is_repaid(loan: &LoanObject): bool {
        loan.status == STATUS_REPAID
    }

    public fun get_collateral_type(loan: &LoanObject): String {
        loan.collateral_type
    }
}
