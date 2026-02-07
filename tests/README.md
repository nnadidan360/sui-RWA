# Backend Test Suite

This directory contains all backend-related tests for the RWA Lending Protocol backend service.

## Test Organization

### `/auth`
Authentication and authorization tests including:
- Access control tests
- Admin authentication tests
- Session management tests
- Rate limiting tests
- Audit logging tests

### `/contracts`
Blockchain smart contract tests including:
- Asset tokenization tests
- Lending pool tests
- Loan manager tests
- Liquidation manager tests
- Property-based tests for contract logic

### `/database`
Database service tests including:
- Enhanced database service tests
- Off-chain data management tests
- Secondary lookup system tests
- Blockchain sync service tests

### `/services`
Backend service tests including:
- Validator management tests
- Asset valuation tests
- IPFS service tests

### `/monitoring`
Monitoring and analytics tests

## Running Tests

```bash
# Run all backend tests
npm test

# Run specific test suite
npm test -- auth
npm test -- contracts
npm test -- database

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Configuration

Tests are configured in `jest.config.js` at the backend root directory.

## Property-Based Tests

Property-based tests use the `fast-check` library and are marked with `.property.test.ts` suffix. These tests validate universal properties that should hold across all inputs.

## Integration Tests

Integration tests verify the interaction between different backend components and external services.
