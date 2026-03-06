# Invoice Payment Collection and Distribution API

## Overview

This document describes the Invoice Payment Collection and Distribution system implemented for Phase 3 of Credit OS. The system handles automated invoice payment collection, distribution to token holders, and collection procedures for overdue invoices.

**Task**: 23.3 - Payment Collection and Distribution  
**Requirements**: 18.4, 18.5

## Features

### 1. Automated Payment Collection
- Collect invoice payments from debtors
- Validate payment amounts and status
- Update invoice payment status
- Track payments in escrow

### 2. Payment Distribution
- Distribute full invoice amount to token holders
- Calculate and deduct platform fees
- Return excess payments to original issuer
- Clear escrow balances after distribution

### 3. Overdue Invoice Handling
- Automatic detection of overdue invoices
- Progressive collection procedures:
  - 0-15 days: Payment reminders
  - 16-30 days: Escalated reminders with late fees
  - 31-60 days: Collection agency involvement
  - 60+ days: Legal action initiation

### 4. Debtor Credit Management
- Track debtor payment history
- Calculate on-time payment rates
- Adjust credit ratings based on behavior
- Provide debtor reliability metrics

## API Endpoints

### Collect Invoice Payment
```
POST /api/phase3/invoices/:invoiceId/collect
```

**Request Body:**
```json
{
  "transactionId": "TXN-12345",
  "amount": 10000,
  "date": "2026-03-06T00:00:00Z",
  "source": "Debtor Business Name",
  "paymentMethod": "bank_transfer",
  "status": "completed",
  "reference": "Optional reference"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "65f1234567890abcdef12345",
      "invoiceNumber": "INV-2026-001",
      "paymentStatus": "paid",
      "paidAmount": 10000,
      "paidDate": "2026-03-06T00:00:00Z"
    }
  }
}
```

### Distribute Payment to Token Holders
```
POST /api/phase3/invoices/:invoiceId/distribute
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAmount": 10000,
    "platformFee": 350,
    "excessAmount": 0,
    "distributionAmount": 10000,
    "tokenHolderPayment": 10000
  }
}
```

### Handle Overdue Invoice
```
POST /api/phase3/invoices/:invoiceId/overdue
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "65f1234567890abcdef12345",
      "invoiceNumber": "INV-2026-001",
      "paymentStatus": "late",
      "daysOverdue": 20,
      "debtor": "Debtor Business Name"
    }
  }
}
```

### Get Collection Status
```
GET /api/phase3/invoices/:invoiceId/collection-status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-2026-001",
    "debtor": "Debtor Business Name",
    "amount": 10000,
    "dueDate": "2026-02-15T00:00:00Z",
    "paymentStatus": "late",
    "daysOverdue": 20,
    "collectionStage": "escalated",
    "nextAction": "escalated_reminder",
    "nextActionDate": "2026-03-13T00:00:00Z"
  }
}
```

### Reconcile Payment
```
POST /api/phase3/invoices/:invoiceId/reconcile
```

**Request Body:**
```json
{
  "expectedAmount": 10000,
  "receivedAmount": 10000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isReconciled": true,
    "discrepancy": 0,
    "action": "payment_reconciled"
  }
}
```

### Adjust Debtor Credit Rating
```
POST /api/phase3/invoices/:invoiceId/adjust-rating
```

**Response:**
```json
{
  "success": true,
  "data": {
    "debtor": {
      "businessName": "Debtor Business Name",
      "creditRating": 85,
      "onTimePaymentRate": 95.5,
      "totalInvoices": 12
    }
  }
}
```

### Process Batch Overdue Invoices
```
POST /api/phase3/invoices/process-overdue
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 45,
    "reminders": 20,
    "escalated": 15,
    "collections": 8,
    "legal": 2
  }
}
```

### Get Debtor Payment History
```
GET /api/phase3/invoices/debtors/:debtorBusinessName/payment-history
```

**Response:**
```json
{
  "success": true,
  "data": {
    "debtor": "Debtor Business Name",
    "history": [
      {
        "invoiceNumber": "INV-2026-001",
        "amount": 10000,
        "dueDate": "2026-02-15T00:00:00Z",
        "paidDate": "2026-02-14T00:00:00Z",
        "status": "paid",
        "daysLate": 0
      }
    ]
  }
}
```

### Get Debtor Metrics
```
GET /api/phase3/invoices/debtors/:debtorBusinessName/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "debtor": "Debtor Business Name",
    "metrics": {
      "totalInvoices": 12,
      "paidInvoices": 11,
      "overdueInvoices": 1,
      "defaultedInvoices": 0,
      "averageDaysLate": 2.5,
      "onTimePaymentRate": 91.7,
      "creditRating": 85
    }
  }
}
```

## Implementation Details

### Service Layer
**File**: `src/services/phase3/InvoiceCollectionService.ts`

Key methods:
- `collectInvoicePayment()` - Process payment collection
- `distributePayment()` - Distribute to token holders
- `handleOverdueInvoice()` - Manage overdue invoices
- `adjustDebtorCreditRating()` - Update debtor ratings
- `reconcilePayment()` - Validate payment amounts
- `processOverdueInvoices()` - Batch process overdue invoices
- `calculateDebtorMetrics()` - Calculate reliability metrics

### Controller Layer
**File**: `src/controllers/phase3/invoices.ts`

Handles HTTP requests and responses for all invoice collection endpoints.

### Routes
**File**: `src/routes/phase3/invoices.ts`

Defines API routes with authentication middleware.

### Data Model
**File**: `src/models/phase3/InvoiceAsset.ts`

MongoDB schema with methods for:
- Payment status updates
- Debtor metrics calculation
- Credit rating adjustments
- Payment recording

## Collection Procedures

### Payment Reminder (0-15 days overdue)
- Send automated email/SMS reminder
- Include payment details and due date
- No penalties applied

### Escalated Reminder (16-30 days overdue)
- Send escalated notice
- Apply 5% late fee
- Warn of collection agency involvement

### Collection Agency (31-60 days overdue)
- Hand off to collection agency
- Agency follows up with debtor
- Additional fees may apply

### Legal Action (60+ days overdue)
- Initiate formal legal proceedings
- Pursue debt recovery through courts
- Mark invoice as defaulted

## Requirements Validation

### Requirement 18.4
✅ **WHEN invoices are paid THEN the system SHALL distribute full payment amounts to token holders and return any excess to original invoice issuer**

Implemented in:
- `distributePayment()` method
- Calculates distribution amount (full invoice amount)
- Identifies excess payments
- Returns excess to issuer via `returnExcessToIssuer()`

### Requirement 18.5
✅ **WHEN payment delays occur THEN the system SHALL implement collection procedures and adjust credit ratings for future invoice factoring**

Implemented in:
- `handleOverdueInvoice()` method
- Progressive collection procedures based on days overdue
- `adjustDebtorCreditRating()` method
- Automatic credit rating adjustments based on payment behavior

## Testing

Test file: `tests/phase3/invoice-collection.test.ts`

Test coverage includes:
- Payment collection for factored invoices
- Payment distribution to token holders
- Overdue invoice handling
- Debtor metrics calculation
- Payment reconciliation
- Error handling for edge cases

## Integration

The invoice collection system integrates with:
- **InvoiceAsset Model**: Core data storage
- **Authentication Middleware**: Secure API access
- **Notification Service**: Payment reminders (future)
- **Blockchain Service**: Token holder distribution (future)
- **Banking Integration**: Payment collection (future)

## Future Enhancements

1. **Real-time Notifications**: Integrate with SendGrid/Twilio for automated reminders
2. **Collection Agency API**: Direct integration with collection services
3. **Legal Services Integration**: Automated legal proceeding initiation
4. **Smart Contract Distribution**: On-chain distribution to token holders
5. **Bank Account Integration**: Direct payment collection via Plaid/Stripe
6. **Predictive Analytics**: ML-based payment prediction and risk scoring
