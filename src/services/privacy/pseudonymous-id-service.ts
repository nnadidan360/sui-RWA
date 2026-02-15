/**
 * Pseudonymous Identifier Service
 * 
 * Generates and manages pseudonymous identifiers that cannot be linked
 * to real-world identities without access to off-chain mapping.
 * 
 * Requirements: 9.2, 9.4
 */

import * as crypto from 'crypto';

export interface PseudonymousIdentifier {
  id: string;
  type: 'user' | 'asset' | 'loan' | 'capability' | 'session' | 'vault' | 'attestation';
  createdAt: Date;
  expiresAt?: Date;
}

export interface IdentifierMapping {
  pseudonymousId: string;
  realId: string;
  type: string;
  createdAt: Date;
  accessLog: Array<{
    accessedBy: string;
    accessedAt: Date;
    purpose: string;
  }>;
}

/**
 * Pseudonymous Identifier Service
 * Creates cryptographically secure pseudonymous identifiers
 */
export class PseudonymousIdService {
  private static readonly ID_PREFIX_MAP = {
    user: 'usr',
    asset: 'ast',
    loan: 'lon',
    capability: 'cap',
    session: 'ses',
    vault: 'vlt',
    attestation: 'att'
  };

  /**
   * Generate a pseudonymous identifier
   * Uses cryptographically secure random bytes to ensure unlinkability
   */
  static generatePseudonymousId(
    type: keyof typeof PseudonymousIdService.ID_PREFIX_MAP,
    entropy?: string
  ): string {
    const prefix = this.ID_PREFIX_MAP[type];
    
    // Generate 32 bytes of cryptographically secure random data
    const randomBytes = crypto.randomBytes(32);
    
    // If entropy is provided, mix it in using HMAC
    let idBytes: Buffer;
    if (entropy) {
      const hmac = crypto.createHmac('sha256', entropy);
      hmac.update(randomBytes);
      idBytes = hmac.digest();
    } else {
      idBytes = randomBytes;
    }
    
    // Convert to base58 for readability (no ambiguous characters)
    const base58Id = this.toBase58(idBytes);
    
    return `${prefix}_${base58Id}`;
  }

  /**
   * Generate a deterministic pseudonymous ID from a real ID
   * Uses HMAC with a secret key to ensure one-way mapping
   */
  static generateDeterministicId(
    realId: string,
    type: keyof typeof PseudonymousIdService.ID_PREFIX_MAP,
    secretKey: string
  ): string {
    const prefix = this.ID_PREFIX_MAP[type];
    
    // Create HMAC-SHA256 hash
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(realId);
    hmac.update(type); // Include type to prevent collisions
    const hash = hmac.digest();
    
    // Convert to base58
    const base58Id = this.toBase58(hash);
    
    return `${prefix}_${base58Id}`;
  }

  /**
   * Generate a session-specific pseudonymous ID
   * Changes with each session to prevent tracking
   */
  static generateSessionPseudonymousId(
    realId: string,
    sessionId: string,
    secretKey: string
  ): string {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(realId);
    hmac.update(sessionId);
    hmac.update(Date.now().toString());
    const hash = hmac.digest();
    
    const base58Id = this.toBase58(hash);
    return `ses_${base58Id}`;
  }

  /**
   * Generate a capability-scoped pseudonymous ID
   * Different for each capability to prevent correlation
   */
  static generateCapabilityScopedId(
    realId: string,
    capabilityType: string,
    secretKey: string
  ): string {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(realId);
    hmac.update(capabilityType);
    hmac.update(crypto.randomBytes(16)); // Add randomness
    const hash = hmac.digest();
    
    const base58Id = this.toBase58(hash);
    return `cap_${base58Id}`;
  }

  /**
   * Generate an asset attestation ID
   * Links to document hash without revealing asset details
   */
  static generateAttestationId(
    documentHash: string,
    jurisdictionCode: string
  ): string {
    const hmac = crypto.createHmac('sha256', documentHash);
    hmac.update(jurisdictionCode);
    const hash = hmac.digest();
    
    const base58Id = this.toBase58(hash);
    return `att_${base58Id}`;
  }

  /**
   * Validate pseudonymous ID format
   */
  static validatePseudonymousId(id: string): {
    valid: boolean;
    type?: string;
    error?: string;
  } {
    const parts = id.split('_');
    
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Invalid format: expected prefix_id'
      };
    }
    
    const [prefix, idPart] = parts;
    
    // Check if prefix is valid
    const validPrefixes = Object.values(this.ID_PREFIX_MAP);
    if (!validPrefixes.includes(prefix)) {
      return {
        valid: false,
        error: `Invalid prefix: ${prefix}`
      };
    }
    
    // Check if ID part is valid base58
    if (!this.isValidBase58(idPart)) {
      return {
        valid: false,
        error: 'Invalid base58 encoding'
      };
    }
    
    // Find type from prefix
    const type = Object.entries(this.ID_PREFIX_MAP)
      .find(([_, p]) => p === prefix)?.[0];
    
    return {
      valid: true,
      type
    };
  }

  /**
   * Extract type from pseudonymous ID
   */
  static extractType(id: string): string | null {
    const validation = this.validatePseudonymousId(id);
    return validation.valid ? validation.type || null : null;
  }

  /**
   * Check if two pseudonymous IDs are of the same type
   */
  static isSameType(id1: string, id2: string): boolean {
    const type1 = this.extractType(id1);
    const type2 = this.extractType(id2);
    return type1 !== null && type1 === type2;
  }

  /**
   * Convert buffer to base58 string
   * Base58 alphabet (Bitcoin-style, no 0OIl to avoid confusion)
   */
  private static toBase58(buffer: Buffer): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const BASE = BigInt(58);
    
    let num = BigInt('0x' + buffer.toString('hex'));
    let encoded = '';
    
    while (num > 0) {
      const remainder = Number(num % BASE);
      encoded = ALPHABET[remainder] + encoded;
      num = num / BASE;
    }
    
    // Add leading '1's for leading zero bytes
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      encoded = '1' + encoded;
    }
    
    return encoded;
  }

  /**
   * Check if string is valid base58
   */
  private static isValidBase58(str: string): boolean {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    return str.split('').every(char => ALPHABET.includes(char));
  }

  /**
   * Generate a time-limited pseudonymous ID
   * Useful for temporary access tokens
   */
  static generateTimeLimitedId(
    realId: string,
    expirationMinutes: number,
    secretKey: string
  ): {
    id: string;
    expiresAt: Date;
  } {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);
    
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(realId);
    hmac.update(expiresAt.toISOString());
    const hash = hmac.digest();
    
    const base58Id = this.toBase58(hash);
    
    return {
      id: `tmp_${base58Id}`,
      expiresAt
    };
  }

  /**
   * Create a pseudonymous identifier with metadata
   */
  static createPseudonymousIdentifier(
    type: keyof typeof PseudonymousIdService.ID_PREFIX_MAP,
    expirationMinutes?: number
  ): PseudonymousIdentifier {
    const id = this.generatePseudonymousId(type);
    const createdAt = new Date();
    
    let expiresAt: Date | undefined;
    if (expirationMinutes) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);
    }
    
    return {
      id,
      type,
      createdAt,
      expiresAt
    };
  }

  /**
   * Check if a pseudonymous identifier has expired
   */
  static isExpired(identifier: PseudonymousIdentifier): boolean {
    if (!identifier.expiresAt) {
      return false;
    }
    return new Date() > identifier.expiresAt;
  }
}
