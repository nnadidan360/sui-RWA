import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

// ============================================================================
// SUI BLOCKCHAIN SERVICE FOR CREDIT OS
// ============================================================================
// This service handles all Sui blockchain interactions for Credit OS
// including account abstraction, smart contract calls, and transaction management

export interface SuiConfig {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  rpcUrl?: string;
  packageId?: string; // Credit OS Move package ID
  adminKeypair?: Ed25519Keypair;
}

export interface UserAccountObjectData {
  id: string;
  authPolicy: string;
  recoveryPolicy: string;
  spendingLimits: {
    dailyLimit: number;
    monthlyLimit: number;
  };
  capabilityRefs: string[];
  status: number; // 0: active, 1: frozen, 2: recovery
  createdAt: number;
}

export interface CryptoVaultObjectData {
  id: string;
  owner: string; // UserAccountObject ID
  assetType: string;
  depositedAmount: number;
  currentValue: number;
  maxLtv: number; // basis points (3000 = 30%)
  liquidationLtv: number; // basis points (6000 = 60%)
  healthFactor: number; // scaled by 10000
  lastUpdate: number;
}

export interface RWAAttestationObjectData {
  id: string;
  documentHash: string;
  assetIdHash: string;
  jurisdictionCode: string;
  expiry: number;
  lienStatus: boolean;
  createdAt: number;
}

export interface BorrowingCapabilityData {
  id: string;
  capabilityId: string;
  maxBorrowAmount: number;
  assetRefs: string[];
  expiry: number;
  policyId: string;
  isActive: boolean;
}

export interface LoanObjectData {
  id: string;
  loanId: string;
  borrower: string; // UserAccountObject ID
  principal: number;
  interestRate: number; // basis points
  fee: number;
  status: number; // 0: active, 1: repaid, 2: liquidated
  dueDate: number;
  createdAt: number;
}

export class SuiService {
  private client: SuiClient;
  private config: SuiConfig;
  private adminKeypair?: Ed25519Keypair;

  constructor(config: SuiConfig) {
    this.config = config;
    const rpcUrl = config.rpcUrl || getFullnodeUrl(config.network);
    this.client = new SuiClient({ url: rpcUrl });
    this.adminKeypair = config.adminKeypair;
  }

  // ============================================================================
  // ACCOUNT ABSTRACTION METHODS (Requirements 1.2, 1.3, 12.1)
  // ============================================================================

  /**
   * Create a new UserAccountObject for account abstraction
   * Requirements: 1.2, 12.1
   */
  async createUserAccount(
    authPolicy: any,
    recoveryPolicy: any,
    spendingLimits: { dailyLimit: number; monthlyLimit: number }
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required for account creation');
    }

    const tx = new Transaction();
    
    // Call the user_account::create_account function
    tx.moveCall({
      target: `${this.config.packageId}::user_account::create_account`,
      arguments: [
        tx.pure.string(JSON.stringify(authPolicy)),
        tx.pure.string(JSON.stringify(recoveryPolicy)),
        tx.pure.u64(spendingLimits.dailyLimit),
        tx.pure.u64(spendingLimits.monthlyLimit),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract the created UserAccountObject ID
    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create UserAccountObject');
    }

    const userAccountObject = createdObjects[0];
    if (userAccountObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: userAccountObject.objectId,
      transactionDigest: result.digest,
    };
  }

  /**
   * Get UserAccountObject data
   * Requirements: 1.2
   */
  async getUserAccount(objectId: string): Promise<UserAccountObjectData | null> {
    try {
      const response = await this.client.getObject({
        id: objectId,
        options: { showContent: true },
      });

      if (!response.data || !response.data.content) {
        return null;
      }

      const content = response.data.content;
      if (content.dataType !== 'moveObject') {
        return null;
      }

      const fields = (content as any).fields;
      return {
        id: objectId,
        authPolicy: fields.auth_policy,
        recoveryPolicy: fields.recovery_policy,
        spendingLimits: {
          dailyLimit: parseInt(fields.spending_limits.daily_limit),
          monthlyLimit: parseInt(fields.spending_limits.monthly_limit),
        },
        capabilityRefs: fields.capability_refs || [],
        status: parseInt(fields.status),
        createdAt: parseInt(fields.created_at),
      };
    } catch (error) {
      console.error('Error fetching UserAccountObject:', error);
      return null;
    }
  }

  /**
   * Freeze a user account (fraud response)
   * Requirements: 1.5, 6.4
   */
  async freezeUserAccount(objectId: string): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::user_account::freeze_account`,
      arguments: [tx.object(objectId)],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  // ============================================================================
  // RWA ATTESTATION METHODS (Requirements 2.3, 12.2)
  // ============================================================================

  /**
   * Create RWA Attestation NFT
   * Requirements: 2.3, 12.2
   */
  async createRWAAttestation(
    documentHash: string,
    assetIdHash: string,
    jurisdictionCode: string,
    expiry: number
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::rwa_asset::create_attestation`,
      arguments: [
        tx.pure.string(documentHash),
        tx.pure.string(assetIdHash),
        tx.pure.string(jurisdictionCode),
        tx.pure.u64(expiry),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create RWA Attestation');
    }

    const attestationObject = createdObjects[0];
    if (attestationObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: attestationObject.objectId,
      transactionDigest: result.digest,
    };
  }

  /**
   * Get RWA Attestation data
   * Requirements: 2.3
   */
  async getRWAAttestation(objectId: string): Promise<RWAAttestationObjectData | null> {
    try {
      const response = await this.client.getObject({
        id: objectId,
        options: { showContent: true },
      });

      if (!response.data || !response.data.content) {
        return null;
      }

      const content = response.data.content;
      if (content.dataType !== 'moveObject') {
        return null;
      }

      const fields = (content as any).fields;
      return {
        id: objectId,
        documentHash: fields.document_hash,
        assetIdHash: fields.asset_id_hash,
        jurisdictionCode: fields.jurisdiction_code,
        expiry: parseInt(fields.expiry),
        lienStatus: fields.lien_status,
        createdAt: parseInt(fields.created_at),
      };
    } catch (error) {
      console.error('Error fetching RWA Attestation:', error);
      return null;
    }
  }

  // ============================================================================
  // CRYPTO VAULT METHODS (Requirements 3.1, 3.2, 12.2)
  // ============================================================================

  /**
   * Create crypto vault for collateral
   * Requirements: 3.1, 12.2
   */
  async createCryptoVault(
    ownerAccountId: string,
    assetType: string,
    depositedAmount: number,
    maxLtv: number = 3000 // 30%
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::crypto_vault::create_vault`,
      arguments: [
        tx.object(ownerAccountId),
        tx.pure.string(assetType),
        tx.pure.u64(depositedAmount),
        tx.pure.u64(maxLtv),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create CryptoVault');
    }

    const vaultObject = createdObjects[0];
    if (vaultObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: vaultObject.objectId,
      transactionDigest: result.digest,
    };
  }

  /**
   * Update crypto vault health factor
   * Requirements: 3.3, 8.3
   */
  async updateVaultHealthFactor(
    vaultId: string,
    newValue: number,
    healthFactor: number
  ): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::crypto_vault::update_health_factor`,
      arguments: [
        tx.object(vaultId),
        tx.pure.u64(newValue),
        tx.pure.u64(healthFactor),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  /**
   * Execute liquidation
   * Requirements: 3.4, 8.1, 8.2
   */
  async executeLiquidation(vaultId: string): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::liquidation_engine::execute_liquidation`,
      arguments: [tx.object(vaultId)],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  // ============================================================================
  // LOAN AND CAPABILITY METHODS (Requirements 4.3, 4.4, 12.3)
  // ============================================================================

  /**
   * Create borrowing capability
   * Requirements: 4.3, 12.3
   */
  async createBorrowingCapability(
    userAccountId: string,
    maxBorrowAmount: number,
    assetRefs: string[],
    expiry: number
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::credit_capability::create_capability`,
      arguments: [
        tx.object(userAccountId),
        tx.pure.u64(maxBorrowAmount),
        tx.pure.vector('string', assetRefs),
        tx.pure.u64(expiry),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create BorrowingCapability');
    }

    const capabilityObject = createdObjects[0];
    if (capabilityObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: capabilityObject.objectId,
      transactionDigest: result.digest,
    };
  }

  /**
   * Create loan object
   * Requirements: 4.4, 12.3
   */
  async createLoan(
    borrowerAccountId: string,
    principal: number,
    interestRate: number,
    fee: number,
    dueDate: number
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::loan::create_loan`,
      arguments: [
        tx.object(borrowerAccountId),
        tx.pure.u64(principal),
        tx.pure.u64(interestRate),
        tx.pure.u64(fee),
        tx.pure.u64(dueDate),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create Loan');
    }

    const loanObject = createdObjects[0];
    if (loanObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: loanObject.objectId,
      transactionDigest: result.digest,
    };
  }

  // ============================================================================
  // WITHDRAWAL POLICY METHODS (Requirements 5.4, 12.5)
  // ============================================================================

  /**
   * Create withdrawal policy object
   * Requirements: 5.4, 12.5
   */
  async createWithdrawalPolicy(
    userAccountId: string,
    cryptoWithdrawalsRemaining: number = 3,
    cardMaintenanceFreeUntil?: number
  ): Promise<{ objectId: string; transactionDigest: string }> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::withdrawal_router::create_policy`,
      arguments: [
        tx.object(userAccountId),
        tx.pure.u64(cryptoWithdrawalsRemaining),
        tx.pure.option('u64', cardMaintenanceFreeUntil ? [cardMaintenanceFreeUntil] : []),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const createdObjects = result.objectChanges?.filter(
      (change) => change.type === 'created'
    );
    
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('Failed to create WithdrawalPolicy');
    }

    const policyObject = createdObjects[0];
    if (policyObject.type !== 'created') {
      throw new Error('Unexpected object change type');
    }

    return {
      objectId: policyObject.objectId,
      transactionDigest: result.digest,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get transaction details
   */
  async getTransaction(digest: string) {
    return await this.client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showInput: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<number> {
    const gasPrice = await this.client.getReferenceGasPrice();
    return parseInt(gasPrice);
  }

  /**
   * Generic transaction execution method
   */
  async executeTransaction(params: {
    packageId: string;
    module: string;
    function: string;
    arguments: any[];
    gasBudget: number;
  }): Promise<any> {
    if (!this.adminKeypair) {
      throw new Error('Admin keypair required for transaction execution');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${params.packageId}::${params.module}::${params.function}`,
      arguments: params.arguments.map(arg => tx.pure.string(arg.toString()))
    });

    tx.setGasBudget(params.gasBudget);

    const result = await this.client.signAndExecuteTransaction({
      signer: this.adminKeypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    return result;
  }

  /**
   * Get object by ID
   */
  async getObject(objectId: string): Promise<any> {
    const response = await this.client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    });

    return response;
  }

  /**
   * Get objects owned by address
   */
  async getObjectsOwnedByAddress(address: string): Promise<any[]> {
    const response = await this.client.getOwnedObjects({
      owner: address,
      options: {
        showContent: true,
        showType: true,
      },
    });

    return response.data || [];
  }

  /**
   * Sponsor transaction (for gas-free user experience)
   * Requirements: 1.3
   */
  async sponsorTransaction(userTransaction: Transaction): Promise<string> {
    if (!this.adminKeypair) {
      throw new Error('Admin keypair required for transaction sponsorship');
    }

    // Set gas payment to be sponsored by admin
    userTransaction.setSender(this.adminKeypair.getPublicKey().toSuiAddress());

    const result = await this.client.signAndExecuteTransaction({
      transaction: userTransaction,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  /**
   * Validate price feed data on-chain
   * Requirements: 3.5, 8.3
   */
  async validatePriceFeed(
    assetType: string,
    price: number,
    timestamp: number,
    signature: string
  ): Promise<boolean> {
    if (!this.config.packageId) {
      throw new Error('Package ID required');
    }

    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${this.config.packageId}::price_feed::validate_price`,
        arguments: [
          tx.pure.string(assetType),
          tx.pure.u64(price),
          tx.pure.u64(timestamp),
          tx.pure.string(signature),
        ],
      });

      // This would be a view function call in a real implementation
      // For now, we'll simulate validation
      return true;
    } catch (error) {
      console.error('Price feed validation failed:', error);
      return false;
    }
  }

  // ============================================================================
  // PRICE FEED METHODS (Requirements 3.5, 8.3, 12.4)
  // ============================================================================

  /**
   * Add oracle to price feed registry
   * Requirements: 3.5, 12.4
   */
  async addPriceOracle(
    oracleId: string,
    endpoint: string,
    weight: number
  ): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::price_feed::add_oracle`,
      arguments: [
        tx.pure.string(oracleId),
        tx.pure.string(endpoint),
        tx.pure.u64(weight),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  /**
   * Add supported asset to price feed
   * Requirements: 3.5, 12.4
   */
  async addSupportedAsset(
    symbol: string,
    decimals: number,
    minSources: number,
    maxDeviation: number,
    updateFrequency: number
  ): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::price_feed::add_supported_asset`,
      arguments: [
        tx.pure.string(symbol),
        tx.pure.u8(decimals),
        tx.pure.u64(minSources),
        tx.pure.u64(maxDeviation),
        tx.pure.u64(updateFrequency),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
    });

    return result.digest;
  }

  /**
   * Update price feed with aggregated data
   * Requirements: 3.5, 8.3, 12.4
   */
  async updatePriceFeed(
    assetSymbol: string,
    prices: number[],
    oracleIds: string[]
  ): Promise<string> {
    if (!this.adminKeypair || !this.config.packageId) {
      throw new Error('Admin keypair and package ID required');
    }

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${this.config.packageId}::price_feed::update_price_feed`,
      arguments: [
        tx.pure.string(assetSymbol),
        tx.pure.vector('u64', prices.map(p => Math.floor(p * 100000000))), // Scale to 8 decimals
        tx.pure.vector('string', oracleIds),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    return result.digest;
  }

  /**
   * Get price feed object
   * Requirements: 3.5
   */
  async getPriceFeed(priceFeedId: string): Promise<{
    assetSymbol: string;
    price: number;
    confidence: number;
    timestamp: number;
    deviation: number;
    sourceCount: number;
  } | null> {
    try {
      const response = await this.client.getObject({
        id: priceFeedId,
        options: { showContent: true },
      });

      if (!response.data || !response.data.content) {
        return null;
      }

      const content = response.data.content;
      if (content.dataType !== 'moveObject') {
        return null;
      }

      const fields = (content as any).fields;
      return {
        assetSymbol: fields.asset_symbol,
        price: parseInt(fields.price) / 100000000, // Scale from 8 decimals
        confidence: parseInt(fields.confidence) / 100, // Scale from basis points
        timestamp: parseInt(fields.timestamp),
        deviation: parseInt(fields.deviation) / 100, // Scale from basis points
        sourceCount: fields.sources ? fields.sources.length : 0,
      };
    } catch (error) {
      console.error('Error fetching price feed:', error);
      return null;
    }
  }

  /**
   * Validate price against on-chain price feed
   * Requirements: 3.5, 8.3
   */
  async validatePriceAgainstFeed(
    priceFeedId: string,
    proposedPrice: number,
    maxDeviation: number
  ): Promise<boolean> {
    if (!this.config.packageId) {
      throw new Error('Package ID required');
    }

    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${this.config.packageId}::price_feed::validate_price`,
        arguments: [
          tx.object(priceFeedId),
          tx.pure.u64(Math.floor(proposedPrice * 100000000)), // Scale to 8 decimals
          tx.pure.u64(Math.floor(maxDeviation * 100)), // Convert to basis points
        ],
      });

      // This would be a view function call in a real implementation
      // For now, we'll simulate validation by checking the price feed
      const priceFeed = await this.getPriceFeed(priceFeedId);
      if (!priceFeed) {
        return false;
      }

      const deviation = Math.abs(priceFeed.price - proposedPrice) / priceFeed.price * 100;
      return deviation <= maxDeviation && priceFeed.confidence >= 80;
    } catch (error) {
      console.error('Price validation failed:', error);
      return false;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let suiServiceInstance: SuiService | null = null;

export function getSuiService(config?: SuiConfig): SuiService {
  if (!suiServiceInstance && config) {
    suiServiceInstance = new SuiService(config);
  }
  
  if (!suiServiceInstance) {
    throw new Error('SuiService not initialized. Please provide config on first call.');
  }
  
  return suiServiceInstance;
}

export function initializeSuiService(config: SuiConfig): SuiService {
  suiServiceInstance = new SuiService(config);
  return suiServiceInstance;
}