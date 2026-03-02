// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.1 - Fractionalization Smart Contract
// Enables splitting RWA assets into tradeable fractional tokens

module credit_os::fractionalization {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_ALREADY_FRACTIONALIZED: u64 = 2;
    const E_INVALID_SUPPLY: u64 = 3;
    const E_INSUFFICIENT_BALANCE: u64 = 4;
    const E_ASSET_NOT_VERIFIED: u64 = 5;
    const E_MINIMUM_VALUE_NOT_MET: u64 = 6;
    const E_INVALID_TOKEN_PRICE: u64 = 7;

    // ==================== Constants ====================
    const MINIMUM_ASSET_VALUE: u64 = 10000; // $10,000 minimum
    const MINIMUM_TOKEN_SUPPLY: u64 = 100; // At least 100 tokens
    const MAXIMUM_TOKEN_SUPPLY: u64 = 10000000; // Max 10M tokens
    const FRACTIONALIZATION_FEE: u64 = 25000000; // $25 in MIST (25 SUI)

    // ==================== Structs ====================

    /// Represents a fractionalized asset token
    struct FractionalAssetToken has key, store {
        id: UID,
        // Link to original RWA asset
        original_asset_id: ID,
        asset_type: String, // "property", "equipment", "vehicle"
        asset_name: String,
        asset_description: String,
        
        // Token economics
        total_supply: u64,
        token_price: u64, // Price per token in cents
        tokens_issued: u64,
        tokens_available: u64,
        
        // Ownership
        creator: address,
        created_at: u64,
        
        // Status
        is_active: bool,
        is_tradeable: bool,
        
        // Valuation
        asset_value: u64, // Total asset value in cents
        last_valuation_update: u64,
        
        // Dividend tracking
        dividend_pool_id: ID,
        total_dividends_distributed: u64,
        
        // Metadata
        metadata_uri: String, // IPFS link to detailed info
        verification_hash: vector<u8>,
    }

    /// Registry of all fractionalized assets
    struct FractionalizationRegistry has key {
        id: UID,
        total_assets_fractionalized: u64,
        total_token_supply: u64,
        total_value_locked: u64,
        assets: vector<ID>, // List of all fractional token IDs
    }

    /// Token holder balance tracking
    struct TokenBalance has key, store {
        id: UID,
        token_id: ID,
        owner: address,
        balance: u64,
        acquired_at: u64,
        total_dividends_received: u64,
    }

    /// Fractionalization request (for processing)
    struct FractionalizationRequest has key {
        id: UID,
        asset_id: ID,
        requester: address,
        requested_supply: u64,
        requested_price: u64,
        fee_paid: Balance<SUI>,
        status: String, // "pending", "approved", "rejected"
        created_at: u64,
    }

    // ==================== Events ====================

    struct AssetFractionalized has copy, drop {
        token_id: ID,
        asset_id: ID,
        creator: address,
        total_supply: u64,
        token_price: u64,
        asset_value: u64,
        timestamp: u64,
    }

    struct TokensIssued has copy, drop {
        token_id: ID,
        recipient: address,
        amount: u64,
        timestamp: u64,
    }

    struct TokensTransferred has copy, drop {
        token_id: ID,
        from: address,
        to: address,
        amount: u64,
        timestamp: u64,
    }

    struct ValuationUpdated has copy, drop {
        token_id: ID,
        old_value: u64,
        new_value: u64,
        new_token_price: u64,
        timestamp: u64,
    }

    // ==================== Initialization ====================

    /// Initialize the fractionalization registry (called once)
    fun init(ctx: &mut TxContext) {
        let registry = FractionalizationRegistry {
            id: object::new(ctx),
            total_assets_fractionalized: 0,
            total_token_supply: 0,
            total_value_locked: 0,
            assets: vector::empty(),
        };
        transfer::share_object(registry);
    }

    // ==================== Core Functions ====================

    /// Create a fractionalization request (requires fee payment)
    public entry fun request_fractionalization(
        asset_id: ID,
        requested_supply: u64,
        requested_price: u64,
        fee_payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(requested_supply >= MINIMUM_TOKEN_SUPPLY, E_INVALID_SUPPLY);
        assert!(requested_supply <= MAXIMUM_TOKEN_SUPPLY, E_INVALID_SUPPLY);
        assert!(requested_price > 0, E_INVALID_TOKEN_PRICE);
        
        let asset_value = requested_supply * requested_price;
        assert!(asset_value >= MINIMUM_ASSET_VALUE, E_MINIMUM_VALUE_NOT_MET);

        // Check fee payment
        let fee_balance = coin::into_balance(fee_payment);
        assert!(balance::value(&fee_balance) >= FRACTIONALIZATION_FEE, E_INSUFFICIENT_BALANCE);

        let request = FractionalizationRequest {
            id: object::new(ctx),
            asset_id,
            requester: tx_context::sender(ctx),
            requested_supply,
            requested_price,
            fee_paid: fee_balance,
            status: string::utf8(b"pending"),
            created_at: tx_context::epoch(ctx),
        };

        transfer::share_object(request);
    }

    /// Approve and create fractional asset token (admin function)
    public entry fun approve_fractionalization(
        request: FractionalizationRequest,
        registry: &mut FractionalizationRegistry,
        asset_name: vector<u8>,
        asset_description: vector<u8>,
        asset_type: vector<u8>,
        metadata_uri: vector<u8>,
        verification_hash: vector<u8>,
        dividend_pool_id: ID,
        ctx: &mut TxContext
    ) {
        let FractionalizationRequest {
            id: request_id,
            asset_id,
            requester,
            requested_supply,
            requested_price,
            fee_paid,
            status: _,
            created_at: _,
        } = request;

        object::delete(request_id);

        // Transfer fee to treasury
        let fee_coin = coin::from_balance(fee_paid, ctx);
        transfer::public_transfer(fee_coin, @credit_os);

        // Create fractional asset token
        let asset_value = requested_supply * requested_price;
        let token = FractionalAssetToken {
            id: object::new(ctx),
            original_asset_id: asset_id,
            asset_type: string::utf8(asset_type),
            asset_name: string::utf8(asset_name),
            asset_description: string::utf8(asset_description),
            total_supply: requested_supply,
            token_price: requested_price,
            tokens_issued: 0,
            tokens_available: requested_supply,
            creator: requester,
            created_at: tx_context::epoch(ctx),
            is_active: true,
            is_tradeable: true,
            asset_value,
            last_valuation_update: tx_context::epoch(ctx),
            dividend_pool_id,
            total_dividends_distributed: 0,
            metadata_uri: string::utf8(metadata_uri),
            verification_hash,
        };

        let token_id = object::id(&token);

        // Update registry
        registry.total_assets_fractionalized = registry.total_assets_fractionalized + 1;
        registry.total_token_supply = registry.total_token_supply + requested_supply;
        registry.total_value_locked = registry.total_value_locked + asset_value;
        vector::push_back(&mut registry.assets, token_id);

        // Emit event
        event::emit(AssetFractionalized {
            token_id,
            asset_id,
            creator: requester,
            total_supply: requested_supply,
            token_price: requested_price,
            asset_value,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::share_object(token);
    }

    /// Issue tokens to a buyer
    public entry fun issue_tokens(
        token: &mut FractionalAssetToken,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(token.is_active, E_NOT_AUTHORIZED);
        assert!(amount <= token.tokens_available, E_INSUFFICIENT_BALANCE);

        // Update token state
        token.tokens_issued = token.tokens_issued + amount;
        token.tokens_available = token.tokens_available - amount;

        // Create token balance for recipient
        let balance = TokenBalance {
            id: object::new(ctx),
            token_id: object::id(token),
            owner: recipient,
            balance: amount,
            acquired_at: tx_context::epoch(ctx),
            total_dividends_received: 0,
        };

        // Emit event
        event::emit(TokensIssued {
            token_id: object::id(token),
            recipient,
            amount,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(balance, recipient);
    }

    /// Transfer tokens between holders
    public entry fun transfer_tokens(
        balance: &mut TokenBalance,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(balance.owner == sender, E_NOT_AUTHORIZED);
        assert!(balance.balance >= amount, E_INSUFFICIENT_BALANCE);

        // Update sender balance
        balance.balance = balance.balance - amount;

        // Create new balance for recipient
        let new_balance = TokenBalance {
            id: object::new(ctx),
            token_id: balance.token_id,
            owner: recipient,
            balance: amount,
            acquired_at: tx_context::epoch(ctx),
            total_dividends_received: 0,
        };

        // Emit event
        event::emit(TokensTransferred {
            token_id: balance.token_id,
            from: sender,
            to: recipient,
            amount,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(new_balance, recipient);
    }

    /// Update asset valuation (oracle or admin)
    public entry fun update_valuation(
        token: &mut FractionalAssetToken,
        new_asset_value: u64,
        ctx: &mut TxContext
    ) {
        let old_value = token.asset_value;
        token.asset_value = new_asset_value;
        token.token_price = new_asset_value / token.total_supply;
        token.last_valuation_update = tx_context::epoch(ctx);

        event::emit(ValuationUpdated {
            token_id: object::id(token),
            old_value,
            new_value: new_asset_value,
            new_token_price: token.token_price,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================== View Functions ====================

    public fun get_token_supply(token: &FractionalAssetToken): u64 {
        token.total_supply
    }

    public fun get_token_price(token: &FractionalAssetToken): u64 {
        token.token_price
    }

    public fun get_tokens_available(token: &FractionalAssetToken): u64 {
        token.tokens_available
    }

    public fun get_asset_value(token: &FractionalAssetToken): u64 {
        token.asset_value
    }

    public fun is_tradeable(token: &FractionalAssetToken): bool {
        token.is_tradeable
    }

    public fun get_balance(balance: &TokenBalance): u64 {
        balance.balance
    }
}
