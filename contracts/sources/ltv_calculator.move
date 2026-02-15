/// LTV Calculator module for Credit OS
/// Provides health factor computation and risk assessment
module credit_os::ltv_calculator {
    use std::vector;

    /// Error codes
    const EInvalidCollateralValue: u64 = 1;
    const EInvalidDebtAmount: u64 = 2;

    /// LTV thresholds (in basis points)
    const SAFE_LTV: u64 = 5000; // 50%
    const WARNING_LTV: u64 = 6500; // 65%
    const CRITICAL_LTV: u64 = 7500; // 75%
    const LIQUIDATION_LTV: u64 = 8000; // 80%

    /// Risk level constants
    const RISK_SAFE: u8 = 0;
    const RISK_MODERATE: u8 = 1;
    const RISK_WARNING: u8 = 2;
    const RISK_CRITICAL: u8 = 3;
    const RISK_LIQUIDATION: u8 = 4;

    /// Calculate LTV ratio in basis points
    public fun calculate_ltv(
        collateral_value_usd: u64,
        debt_amount_usd: u64
    ): u64 {
        if (collateral_value_usd == 0) {
            return 0
        };

        (debt_amount_usd * 10000) / collateral_value_usd
    }

    /// Calculate health factor (inverse of LTV)
    public fun calculate_health_factor(ltv: u64): u64 {
        if (ltv >= 10000) {
            return 0
        };

        10000 - ltv
    }

    /// Calculate maximum borrowable amount
    public fun calculate_max_borrow(
        collateral_value_usd: u64,
        target_ltv: u64
    ): u64 {
        (collateral_value_usd * target_ltv) / 10000
    }

    /// Calculate required collateral for a loan
    public fun calculate_required_collateral(
        loan_amount_usd: u64,
        target_ltv: u64
    ): u64 {
        if (target_ltv == 0) {
            return 0
        };

        (loan_amount_usd * 10000) / target_ltv
    }

    /// Get risk level based on LTV
    public fun get_risk_level(ltv: u64): u8 {
        if (ltv >= LIQUIDATION_LTV) {
            RISK_LIQUIDATION
        } else if (ltv >= CRITICAL_LTV) {
            RISK_CRITICAL
        } else if (ltv >= WARNING_LTV) {
            RISK_WARNING
        } else if (ltv >= SAFE_LTV) {
            RISK_MODERATE
        } else {
            RISK_SAFE
        }
    }

    /// Check if position is healthy
    public fun is_healthy(ltv: u64): bool {
        ltv < CRITICAL_LTV
    }

    /// Check if position needs liquidation
    public fun needs_liquidation(ltv: u64): bool {
        ltv >= LIQUIDATION_LTV
    }

    /// Calculate liquidation price for an asset
    public fun calculate_liquidation_price(
        current_price: u64,
        current_ltv: u64,
        liquidation_ltv: u64
    ): u64 {
        if (current_ltv == 0 || liquidation_ltv == 0) {
            return 0
        };

        // Price at which LTV reaches liquidation threshold
        (current_price * current_ltv) / liquidation_ltv
    }

    /// Calculate additional collateral needed to reach target LTV
    public fun calculate_additional_collateral_needed(
        current_collateral_value: u64,
        debt_amount: u64,
        target_ltv: u64
    ): u64 {
        let required_collateral = calculate_required_collateral(debt_amount, target_ltv);
        
        if (required_collateral > current_collateral_value) {
            required_collateral - current_collateral_value
        } else {
            0
        }
    }

    /// Calculate how much can be withdrawn while maintaining target LTV
    public fun calculate_withdrawable_collateral(
        current_collateral_value: u64,
        debt_amount: u64,
        target_ltv: u64
    ): u64 {
        let required_collateral = calculate_required_collateral(debt_amount, target_ltv);
        
        if (current_collateral_value > required_collateral) {
            current_collateral_value - required_collateral
        } else {
            0
        }
    }

    /// Calculate portfolio LTV for multiple collateral types
    public fun calculate_portfolio_ltv(
        collateral_values: vector<u64>,
        debt_amount: u64
    ): u64 {
        let mut total_collateral = 0u64;
        let len = vector::length(&collateral_values);
        let mut i = 0;

        while (i < len) {
            total_collateral = total_collateral + *vector::borrow(&collateral_values, i);
            i = i + 1;
        };

        calculate_ltv(total_collateral, debt_amount)
    }

    /// Calculate weighted average LTV across multiple positions
    public fun calculate_weighted_ltv(
        ltvs: vector<u64>,
        weights: vector<u64>
    ): u64 {
        let len = vector::length(&ltvs);
        assert!(len == vector::length(&weights), 0);

        if (len == 0) {
            return 0
        };

        let mut weighted_sum = 0u64;
        let mut total_weight = 0u64;
        let mut i = 0;

        while (i < len) {
            let ltv = *vector::borrow(&ltvs, i);
            let weight = *vector::borrow(&weights, i);
            weighted_sum = weighted_sum + (ltv * weight);
            total_weight = total_weight + weight;
            i = i + 1;
        };

        if (total_weight == 0) {
            return 0
        };

        weighted_sum / total_weight
    }

    // === Getter functions ===

    /// Get safe LTV threshold
    public fun get_safe_ltv(): u64 {
        SAFE_LTV
    }

    /// Get warning LTV threshold
    public fun get_warning_ltv(): u64 {
        WARNING_LTV
    }

    /// Get critical LTV threshold
    public fun get_critical_ltv(): u64 {
        CRITICAL_LTV
    }

    /// Get liquidation LTV threshold
    public fun get_liquidation_ltv(): u64 {
        LIQUIDATION_LTV
    }

    /// Get all thresholds
    public fun get_all_thresholds(): (u64, u64, u64, u64) {
        (SAFE_LTV, WARNING_LTV, CRITICAL_LTV, LIQUIDATION_LTV)
    }
}
