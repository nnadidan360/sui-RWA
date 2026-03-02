// PHASE 2: Cross-Collateralization
// Task 19.1 - Mixed asset type lending

module credit_os::cross_collateral {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    const E_INSUFFICIENT_COLLATERAL: u64 = 1;

    struct CrossCollateralLoan has key {
        id: UID,
        borrower: address,
        portfolio_id: ID,
        principal: u64,
        interest_rate: u64,
        collateral_types: vector<u8>,
        status: u8,
        created_at: u64,
    }

    struct LoanCreated has copy, drop {
        loan_id: ID,
        borrower: address,
        principal: u64,
        timestamp: u64,
    }

    public fun create_loan(
        borrower: address,
        portfolio_id: ID,
        principal: u64,
        interest_rate: u64,
        ctx: &mut TxContext
    ): CrossCollateralLoan {
        let loan = CrossCollateralLoan {
            id: object::new(ctx),
            borrower,
            portfolio_id,
            principal,
            interest_rate,
            collateral_types: vector::empty(),
            status: 0,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(LoanCreated {
            loan_id: object::id(&loan),
            borrower,
            principal,
            timestamp: tx_context::epoch(ctx),
        });

        loan
    }

    public fun get_principal(loan: &CrossCollateralLoan): u64 {
        loan.principal
    }
}
