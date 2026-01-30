import { getDatabase } from './mongodb';
import { User, Asset, StakingPosition, Loan, Transaction, LendingPool, LendingPosition } from './models';
import { ObjectId } from 'mongodb';

export class DatabaseService {
  private async getDb() {
    return await getDatabase();
  }

  // User services
  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const db = await this.getDb();
    const user: User = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<User>('users').insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  async getUserByWallet(walletAddress: string): Promise<User | null> {
    const db = await this.getDb();
    return await db.collection<User>('users').findOne({ walletAddress });
  }

  async updateUser(walletAddress: string, updates: Partial<User>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<User>('users').updateOne(
      { walletAddress },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Asset services
  async createAsset(assetData: Omit<Asset, '_id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const db = await this.getDb();
    const asset: Asset = {
      ...assetData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<Asset>('assets').insertOne(asset);
    return { ...asset, _id: result.insertedId };
  }

  async getAssetsByOwner(owner: string): Promise<Asset[]> {
    const db = await this.getDb();
    return await db.collection<Asset>('assets').find({ owner }).toArray();
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const db = await this.getDb();
    return await db.collection<Asset>('assets').findOne({ _id: new ObjectId(id) });
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<Asset>('assets').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Staking services
  async createStakingPosition(positionData: Omit<StakingPosition, '_id' | 'createdAt' | 'updatedAt'>): Promise<StakingPosition> {
    const db = await this.getDb();
    const position: StakingPosition = {
      ...positionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<StakingPosition>('staking_positions').insertOne(position);
    return { ...position, _id: result.insertedId };
  }

  async getStakingPositionsByStaker(staker: string): Promise<StakingPosition[]> {
    const db = await this.getDb();
    return await db.collection<StakingPosition>('staking_positions').find({ staker }).toArray();
  }

  async updateStakingPosition(staker: string, updates: Partial<StakingPosition>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<StakingPosition>('staking_positions').updateOne(
      { staker },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Loan services
  async createLoan(loanData: Omit<Loan, '_id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    const db = await this.getDb();
    const loan: Loan = {
      ...loanData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<Loan>('loans').insertOne(loan);
    return { ...loan, _id: result.insertedId };
  }

  async getLoansByBorrower(borrower: string): Promise<Loan[]> {
    const db = await this.getDb();
    return await db.collection<Loan>('loans').find({ borrower }).toArray();
  }

  async getLoanById(loanId: string): Promise<Loan | null> {
    const db = await this.getDb();
    return await db.collection<Loan>('loans').findOne({ loanId });
  }

  async updateLoan(loanId: string, updates: Partial<Loan>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<Loan>('loans').updateOne(
      { loanId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Transaction services
  async createTransaction(transactionData: Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const db = await this.getDb();
    const transaction: Transaction = {
      ...transactionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<Transaction>('transactions').insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    const db = await this.getDb();
    return await db.collection<Transaction>('transactions')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async updateTransaction(hash: string, updates: Partial<Transaction>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<Transaction>('transactions').updateOne(
      { hash },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Lending pool services
  async getLendingPools(): Promise<LendingPool[]> {
    const db = await this.getDb();
    return await db.collection<LendingPool>('lending_pools').find({}).toArray();
  }

  async getLendingPool(poolId: string): Promise<LendingPool | null> {
    const db = await this.getDb();
    return await db.collection<LendingPool>('lending_pools').findOne({ poolId });
  }

  async updateLendingPool(poolId: string, updates: Partial<LendingPool>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<LendingPool>('lending_pools').updateOne(
      { poolId },
      { $set: { ...updates, lastUpdateTime: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Lending position services
  async createLendingPosition(positionData: Omit<LendingPosition, '_id' | 'createdAt' | 'updatedAt'>): Promise<LendingPosition> {
    const db = await this.getDb();
    const position: LendingPosition = {
      ...positionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await db.collection<LendingPosition>('lending_positions').insertOne(position);
    return { ...position, _id: result.insertedId };
  }

  async getLendingPositionsByUser(userId: string): Promise<LendingPosition[]> {
    const db = await this.getDb();
    return await db.collection<LendingPosition>('lending_positions').find({ userId }).toArray();
  }

  async updateLendingPosition(id: string, updates: Partial<LendingPosition>): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.collection<LendingPosition>('lending_positions').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }
}

export const dbService = new DatabaseService();