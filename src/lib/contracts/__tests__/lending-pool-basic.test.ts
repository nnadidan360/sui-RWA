import { LendingPool } from '../lending-pool';
import { AssetTokenFactory } from '../asset-token';
import { UserRole } from '../../../types/auth';

describe('Lending Pool - Basic Tests', () => {
  let lendingPool: LendingPool;
  let assetTokenFactory: AssetTokenFactory;

  beforeEach(() => {
    assetTokenFactory = new AssetTokenFactory();
    lendingPool = new LendingPool(assetTokenFactory);
    
    // Register test users
    lendingPool.registerUser('lender_address', UserRole.USER);
    lendingPool.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
  });

  test('should handle single deposit correctly', async () => {
    const depositAmount = BigInt(1000);
    
    // Make deposit
    const poolTokenId = await lendingPool.deposit(depositAmount, 'lender_address');
    
    // Verify pool token was created
    const poolToken = lendingPool.getPoolToken(poolTokenId);
    expect(poolToken).toBeDefined();
    expect(poolToken!.holder).toBe('lender_address');
    expect(poolToken!.amount).toBe(depositAmount); // First deposit should be 1:1
    
    // Verify pool state
    const poolState = lendingPool.getPoolState();
    expect(poolState.totalDeposits).toBe(depositAmount);
    expect(poolState.totalPoolTokens).toBe(depositAmount);
  });

  test('should handle deposit and withdrawal correctly', async () => {
    const depositAmount = BigInt(1000);
    
    // Make deposit
    const poolTokenId = await lendingPool.deposit(depositAmount, 'lender_address');
    
    // Immediate withdrawal
    const withdrawalAmount = await lendingPool.withdraw(poolTokenId, 'lender_address');
    
    // Should get back the same amount (no interest accrued)
    expect(withdrawalAmount).toBe(depositAmount);
    
    // Pool should be empty
    const poolState = lendingPool.getPoolState();
    expect(poolState.totalDeposits).toBe(BigInt(0));
    expect(poolState.totalPoolTokens).toBe(BigInt(0));
  });

  test('should handle multiple deposits correctly', async () => {
    const deposit1 = BigInt(1000);
    const deposit2 = BigInt(2000);
    
    // First deposit
    const poolToken1Id = await lendingPool.deposit(deposit1, 'lender_address');
    const poolToken1 = lendingPool.getPoolToken(poolToken1Id);
    expect(poolToken1!.amount).toBe(deposit1);
    
    // Second deposit
    const poolToken2Id = await lendingPool.deposit(deposit2, 'lender_address');
    const poolToken2 = lendingPool.getPoolToken(poolToken2Id);
    expect(poolToken2!.amount).toBe(deposit2);
    
    // Verify total pool state
    const poolState = lendingPool.getPoolState();
    expect(poolState.totalDeposits).toBe(deposit1 + deposit2);
    expect(poolState.totalPoolTokens).toBe(deposit1 + deposit2);
  });
});