/**
 * Database Cache Service
 * 
 * Provides fast database lookups with intelligent caching:
 * - In-memory cache for frequently accessed data
 * - Cache invalidation strategies
 * - Performance monitoring and optimization
 */

import { connectToDatabase } from '../connection';
import { Asset, type IAsset } from '../models/Asset';
import { User, type IUser } from '../models/User';
import { Transaction, type ITransaction } from '../models/Transaction';

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: Date;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
}

export class DatabaseCacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private maxCacheSize: number = 1000,
    private defaultTTL: number = 300000, // 5 minutes
    private cleanupIntervalMs: number = 60000 // 1 minute
  ) {
    this.startCleanupProcess();
  }
  /**
   * Start the cache cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
      this.evictLeastRecentlyUsed();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop the cache cleanup process
   */
  public stopCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get asset with caching
   */
  async getAsset(tokenId: string): Promise<IAsset | null> {
    const startTime = Date.now();
    const cacheKey = `asset:${tokenId}`;
    
    // Try cache first
    const cached = this.getFromCache<IAsset>(cacheKey);
    if (cached) {
      this.recordHit(Date.now() - startTime);
      return cached;
    }

    // Cache miss - fetch from database
    await connectToDatabase();
    const asset = await Asset.findOne({ tokenId });
    
    if (asset) {
      this.setCache(cacheKey, asset, this.defaultTTL);
    }
    
    this.recordMiss(Date.now() - startTime);
    return asset;
  }

  /**
   * Get user with caching
   */
  async getUser(walletAddress: string): Promise<IUser | null> {
    const startTime = Date.now();
    const cacheKey = `user:${walletAddress}`;
    
    const cached = this.getFromCache<IUser>(cacheKey);
    if (cached) {
      this.recordHit(Date.now() - startTime);
      return cached;
    }

    await connectToDatabase();
    const user = await User.findOne({
      $or: [
        { walletAddress },
        { 'connectedWallets.address': walletAddress }
      ]
    });
    
    if (user) {
      this.setCache(cacheKey, user, this.defaultTTL);
      // Also cache by primary wallet address
      this.setCache(`user:${user.walletAddress}`, user, this.defaultTTL);
    }
    
    this.recordMiss(Date.now() - startTime);
    return user;
  }
  /**
   * Get transaction with caching
   */
  async getTransaction(transactionId: string): Promise<ITransaction | null> {
    const startTime = Date.now();
    const cacheKey = `transaction:${transactionId}`;
    
    const cached = this.getFromCache<ITransaction>(cacheKey);
    if (cached) {
      this.recordHit(Date.now() - startTime);
      return cached;
    }

    await connectToDatabase();
    const transaction = await Transaction.findOne({ transactionId });
    
    if (transaction) {
      // Cache with shorter TTL for active transactions
      const ttl = transaction.status === 'pending' || transaction.status === 'processing' 
        ? 30000 // 30 seconds for active transactions
        : this.defaultTTL; // 5 minutes for completed transactions
      
      this.setCache(cacheKey, transaction, ttl);
      
      // Also cache by deploy hash if available
      if (transaction.deployHash) {
        this.setCache(`transaction:deploy:${transaction.deployHash}`, transaction, ttl);
      }
    }
    
    this.recordMiss(Date.now() - startTime);
    return transaction;
  }

  /**
   * Get user assets with caching
   */
  async getUserAssets(walletAddress: string, limit: number = 50): Promise<IAsset[]> {
    const startTime = Date.now();
    const cacheKey = `user_assets:${walletAddress}:${limit}`;
    
    const cached = this.getFromCache<IAsset[]>(cacheKey);
    if (cached) {
      this.recordHit(Date.now() - startTime);
      return cached;
    }

    await connectToDatabase();
    const assets = await Asset.find({ owner: walletAddress })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // Cache with shorter TTL since this is a list that changes frequently
    this.setCache(cacheKey, assets, 60000); // 1 minute
    
    this.recordMiss(Date.now() - startTime);
    return assets;
  }
  /**
   * Cache management methods
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.memoryCache.delete(key);
      this.cacheStats.evictions++;
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    // Check cache size limit
    if (this.memoryCache.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      accessCount: 0,
      lastAccessed: new Date()
    };
    
    this.memoryCache.set(key, entry);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.memoryCache.delete(key);
        evicted++;
      }
    }
    
    this.cacheStats.evictions += evicted;
  }

  private evictLeastRecentlyUsed(): void {
    if (this.memoryCache.size < this.maxCacheSize) {
      return;
    }
    
    // Find least recently used entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }
  /**
   * Cache invalidation methods
   */
  public invalidateAsset(tokenId: string): void {
    this.memoryCache.delete(`asset:${tokenId}`);
    
    // Also invalidate related caches
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith('user_assets:')) {
        this.memoryCache.delete(key);
      }
    }
  }

  public invalidateUser(walletAddress: string): void {
    this.memoryCache.delete(`user:${walletAddress}`);
    
    // Invalidate related caches
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(`user_assets:${walletAddress}`) || 
          key.startsWith(`user_transactions:${walletAddress}`)) {
        this.memoryCache.delete(key);
      }
    }
  }

  public invalidateTransaction(transactionId: string): void {
    this.memoryCache.delete(`transaction:${transactionId}`);
    
    // Invalidate user transaction lists
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith('user_transactions:')) {
        this.memoryCache.delete(key);
      }
    }
  }

  public invalidateWallet(address: string): void {
    this.memoryCache.delete(`wallet:${address}`);
  }

  public invalidateAll(): void {
    this.memoryCache.clear();
    this.resetStats();
  }

  /**
   * Statistics and monitoring
   */
  private recordHit(responseTime: number): void {
    this.cacheStats.hits++;
    this.cacheStats.totalRequests++;
    this.recordResponseTime(responseTime);
    this.updateHitRate();
  }

  private recordMiss(responseTime: number): void {
    this.cacheStats.misses++;
    this.cacheStats.totalRequests++;
    this.recordResponseTime(responseTime);
    this.updateHitRate();
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    // Update average response time
    this.cacheStats.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  private updateHitRate(): void {
    this.cacheStats.hitRate = this.cacheStats.totalRequests > 0 
      ? this.cacheStats.hits / this.cacheStats.totalRequests 
      : 0;
  }

  private resetStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0
    };
    this.responseTimes = [];
  }

  /**
   * Public monitoring methods
   */
  public getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  public getCacheSize(): number {
    return this.memoryCache.size;
  }

  public getMemoryUsage(): { used: number; limit: number; utilization: number } {
    return {
      used: this.memoryCache.size,
      limit: this.maxCacheSize,
      utilization: this.memoryCache.size / this.maxCacheSize
    };
  }
}

// Export singleton instance
export const databaseCacheService = new DatabaseCacheService();