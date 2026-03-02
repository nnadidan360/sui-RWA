// PHASE 2: Asset Tokenization and Fractionalization
// Task 17.1 - Trading Marketplace
// Order book system for fractional asset token trading

module credit_os::marketplace {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::table::{Self, Table};
    use std::vector;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_PRICE: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_ORDER_NOT_FOUND: u64 = 4;
    const E_INSUFFICIENT_BALANCE: u64 = 5;
    const E_TRADING_DISABLED: u64 = 6;
    const E_SELF_TRADE: u64 = 7;

    // ==================== Constants ====================
    const TRADING_FEE_BPS: u64 = 25; // 0.25% trading fee
    const MINIMUM_ORDER_SIZE: u64 = 1;
    const MAXIMUM_ORDERS_PER_USER: u64 = 100;

    // ==================== Structs ====================

    /// Order book for a fractional token
    struct OrderBook has key {
        id: UID,
        token_id: ID,
        
        // Order tracking
        buy_orders: Table<ID, Order>,
        sell_orders: Table<ID, Order>,
        buy_order_ids: vector<ID>,
        sell_order_ids: vector<ID>,
        
        // Market statistics
        last_trade_price: u64,
        volume_24h: u64,
        trades_24h: u64,
        
        // Fee collection
        accumulated_fees: Balance<SUI>,
        total_fees_collected: u64,
        
        // Status
        is_active: bool,
        created_at: u64,
    }

    /// Individual order
    struct Order has store {
        order_id: ID,
        trader: address,
        token_id: ID,
        order_type: u8, // 0=buy, 1=sell
        price: u64, // Price per token in MIST
        amount: u64, // Number of tokens
        filled: u64, // Amount filled
        status: u8, // 0=open, 1=partial, 2=filled, 3=cancelled
        created_at: u64,
        updated_at: u64,
    }

    /// Order placement receipt
    struct OrderReceipt has key, store {
        id: UID,
        order_id: ID,
        trader: address,
        token_id: ID,
        order_type: u8,
        price: u64,
        amount: u64,
        created_at: u64,
    }

    /// Trade execution record
    struct Trade has key, store {
        id: UID,
        token_id: ID,
        buy_order_id: ID,
        sell_order_id: ID,
        buyer: address,
        seller: address,
        price: u64,
        amount: u64,
        fee: u64,
        executed_at: u64,
    }

    // ==================== Events ====================

    struct OrderPlaced has copy, drop {
        order_id: ID,
        token_id: ID,
        trader: address,
        order_type: u8,
        price: u64,
        amount: u64,
        timestamp: u64,
    }

    struct OrderCancelled has copy, drop {
        order_id: ID,
        token_id: ID,
        trader: address,
        timestamp: u64,
    }

    struct TradeExecuted has copy, drop {
        trade_id: ID,
        token_id: ID,
        buyer: address,
        seller: address,
        price: u64,
        amount: u64,
        fee: u64,
        timestamp: u64,
    }

    struct OrderBookCreated has copy, drop {
        order_book_id: ID,
        token_id: ID,
        timestamp: u64,
    }

    // ==================== Core Functions ====================

    /// Create order book for a token
    public fun create_order_book(
        token_id: ID,
        ctx: &mut TxContext
    ): OrderBook {
        let order_book = OrderBook {
            id: object::new(ctx),
            token_id,
            buy_orders: table::new(ctx),
            sell_orders: table::new(ctx),
            buy_order_ids: vector::empty(),
            sell_order_ids: vector::empty(),
            last_trade_price: 0,
            volume_24h: 0,
            trades_24h: 0,
            accumulated_fees: balance::zero(),
            total_fees_collected: 0,
            is_active: true,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(OrderBookCreated {
            order_book_id: object::id(&order_book),
            token_id,
            timestamp: tx_context::epoch(ctx),
        });

        order_book
    }

    /// Place buy order
    public entry fun place_buy_order(
        order_book: &mut OrderBook,
        price: u64,
        amount: u64,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(order_book.is_active, E_TRADING_DISABLED);
        assert!(price > 0, E_INVALID_PRICE);
        assert!(amount >= MINIMUM_ORDER_SIZE, E_INVALID_AMOUNT);

        let trader = tx_context::sender(ctx);
        let total_cost = price * amount;
        
        // Verify payment covers order
        assert!(coin::value(&payment) >= total_cost, E_INSUFFICIENT_BALANCE);

        // Create order
        let order_id = object::new(ctx);
        let order_id_copy = object::uid_to_inner(&order_id);
        
        let order = Order {
            order_id: order_id_copy,
            trader,
            token_id: order_book.token_id,
            order_type: 0, // buy
            price,
            amount,
            filled: 0,
            status: 0, // open
            created_at: tx_context::epoch(ctx),
            updated_at: tx_context::epoch(ctx),
        };

        // Store order
        table::add(&mut order_book.buy_orders, order_id_copy, order);
        vector::push_back(&mut order_book.buy_order_ids, order_id_copy);

        // Create receipt
        let receipt = OrderReceipt {
            id: order_id,
            order_id: order_id_copy,
            trader,
            token_id: order_book.token_id,
            order_type: 0,
            price,
            amount,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(OrderPlaced {
            order_id: order_id_copy,
            token_id: order_book.token_id,
            trader,
            order_type: 0,
            price,
            amount,
            timestamp: tx_context::epoch(ctx),
        });

        // Lock payment (in production, would escrow this)
        transfer::public_transfer(payment, @credit_os);
        transfer::transfer(receipt, trader);
    }

    /// Place sell order
    public entry fun place_sell_order(
        order_book: &mut OrderBook,
        price: u64,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(order_book.is_active, E_TRADING_DISABLED);
        assert!(price > 0, E_INVALID_PRICE);
        assert!(amount >= MINIMUM_ORDER_SIZE, E_INVALID_AMOUNT);

        let trader = tx_context::sender(ctx);

        // Create order
        let order_id = object::new(ctx);
        let order_id_copy = object::uid_to_inner(&order_id);
        
        let order = Order {
            order_id: order_id_copy,
            trader,
            token_id: order_book.token_id,
            order_type: 1, // sell
            price,
            amount,
            filled: 0,
            status: 0, // open
            created_at: tx_context::epoch(ctx),
            updated_at: tx_context::epoch(ctx),
        };

        // Store order
        table::add(&mut order_book.sell_orders, order_id_copy, order);
        vector::push_back(&mut order_book.sell_order_ids, order_id_copy);

        // Create receipt
        let receipt = OrderReceipt {
            id: order_id,
            order_id: order_id_copy,
            trader,
            token_id: order_book.token_id,
            order_type: 1,
            price,
            amount,
            created_at: tx_context::epoch(ctx),
        };

        event::emit(OrderPlaced {
            order_id: order_id_copy,
            token_id: order_book.token_id,
            trader,
            order_type: 1,
            price,
            amount,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(receipt, trader);
    }

    /// Cancel order
    public entry fun cancel_order(
        order_book: &mut OrderBook,
        order_id: ID,
        is_buy_order: bool,
        ctx: &mut TxContext
    ) {
        let trader = tx_context::sender(ctx);

        if (is_buy_order) {
            assert!(table::contains(&order_book.buy_orders, order_id), E_ORDER_NOT_FOUND);
            let order = table::borrow_mut(&mut order_book.buy_orders, order_id);
            assert!(order.trader == trader, E_NOT_AUTHORIZED);
            order.status = 3; // cancelled
            order.updated_at = tx_context::epoch(ctx);
        } else {
            assert!(table::contains(&order_book.sell_orders, order_id), E_ORDER_NOT_FOUND);
            let order = table::borrow_mut(&mut order_book.sell_orders, order_id);
            assert!(order.trader == trader, E_NOT_AUTHORIZED);
            order.status = 3; // cancelled
            order.updated_at = tx_context::epoch(ctx);
        };

        event::emit(OrderCancelled {
            order_id,
            token_id: order_book.token_id,
            trader,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// Execute trade (matching engine)
    public fun execute_trade(
        order_book: &mut OrderBook,
        buy_order_id: ID,
        sell_order_id: ID,
        trade_amount: u64,
        ctx: &mut TxContext
    ): Trade {
        assert!(table::contains(&order_book.buy_orders, buy_order_id), E_ORDER_NOT_FOUND);
        assert!(table::contains(&order_book.sell_orders, sell_order_id), E_ORDER_NOT_FOUND);

        let buy_order = table::borrow_mut(&mut order_book.buy_orders, buy_order_id);
        let sell_order = table::borrow_mut(&mut order_book.sell_orders, sell_order_id);

        // Prevent self-trading
        assert!(buy_order.trader != sell_order.trader, E_SELF_TRADE);

        // Verify amounts
        assert!(trade_amount <= (buy_order.amount - buy_order.filled), E_INVALID_AMOUNT);
        assert!(trade_amount <= (sell_order.amount - sell_order.filled), E_INVALID_AMOUNT);

        // Use sell order price (price improvement for buyer if buy price is higher)
        let trade_price = sell_order.price;
        let trade_value = trade_price * trade_amount;

        // Calculate fee (0.25%)
        let fee = (trade_value * TRADING_FEE_BPS) / 10000;

        // Update orders
        buy_order.filled = buy_order.filled + trade_amount;
        sell_order.filled = sell_order.filled + trade_amount;
        buy_order.updated_at = tx_context::epoch(ctx);
        sell_order.updated_at = tx_context::epoch(ctx);

        // Update order status
        if (buy_order.filled == buy_order.amount) {
            buy_order.status = 2; // filled
        } else {
            buy_order.status = 1; // partial
        };

        if (sell_order.filled == sell_order.amount) {
            sell_order.status = 2; // filled
        } else {
            sell_order.status = 1; // partial
        };

        // Update market statistics
        order_book.last_trade_price = trade_price;
        order_book.volume_24h = order_book.volume_24h + trade_value;
        order_book.trades_24h = order_book.trades_24h + 1;
        order_book.total_fees_collected = order_book.total_fees_collected + fee;

        // Create trade record
        let trade = Trade {
            id: object::new(ctx),
            token_id: order_book.token_id,
            buy_order_id,
            sell_order_id,
            buyer: buy_order.trader,
            seller: sell_order.trader,
            price: trade_price,
            amount: trade_amount,
            fee,
            executed_at: tx_context::epoch(ctx),
        };

        let trade_id = object::id(&trade);

        event::emit(TradeExecuted {
            trade_id,
            token_id: order_book.token_id,
            buyer: buy_order.trader,
            seller: sell_order.trader,
            price: trade_price,
            amount: trade_amount,
            fee,
            timestamp: tx_context::epoch(ctx),
        });

        trade
    }

    /// Collect trading fees
    public fun collect_fees(
        order_book: &mut OrderBook,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<SUI> {
        assert!(amount <= balance::value(&order_book.accumulated_fees), E_INSUFFICIENT_BALANCE);
        coin::take(&mut order_book.accumulated_fees, amount, ctx)
    }

    // ==================== View Functions ====================

    public fun get_last_price(order_book: &OrderBook): u64 {
        order_book.last_trade_price
    }

    public fun get_volume_24h(order_book: &OrderBook): u64 {
        order_book.volume_24h
    }

    public fun get_trades_24h(order_book: &OrderBook): u64 {
        order_book.trades_24h
    }

    public fun get_order_count(order_book: &OrderBook): (u64, u64) {
        (vector::length(&order_book.buy_order_ids), vector::length(&order_book.sell_order_ids))
    }

    public fun is_active(order_book: &OrderBook): bool {
        order_book.is_active
    }
}
