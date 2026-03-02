// PHASE 2: Fractional Token Liquidation
// Task 19.1 - Token-based recovery

module credit_os::fractional_liquidation {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    const E_HEALTHY_POSITION: u64 = 1;

    struct LiquidationEvent has key {
        id: UID,
        loan_id: ID,
        liquidator: address,
        tokens_seized: u64,
        debt_recovered: u64,
        executed_at: u64,
    }

    struct TokensLiquidated has copy, drop {
        loan_id: ID,
        amount: u64,
        timestamp: u64,
    }

    public fun execute_liquidation(
        loan_id: ID,
        liquidator: address,
        tokens_seized: u64,
        debt_recovered: u64,
        ctx: &mut TxContext
    ): LiquidationEvent {
        let liquidation = LiquidationEvent {
            id: object::new(ctx),
            loan_id,
            liquidator,
            tokens_seized,
            debt_recovered,
            executed_at: tx_context::epoch(ctx),
        };

        event::emit(TokensLiquidated {
            loan_id,
            amount: tokens_seized,
            timestamp: tx_context::epoch(ctx),
        });

        liquidation
    }
}
