/**
 * Privacy Architecture Tests
 * 
 * Tests for data classification, pseudonymous IDs, audit trails, and identity isolation
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

import {
  DataClassificationService,
  DataSensitivity,
  PseudonymousIdService,
  AuditTrailService,
  AuditEventType,
  IdentityIsolationService
} from '../../src/services/privacy';

describe('Privacy Architecture', () => {
  describe('DataClassificationService', () => {
    it('should classify PII as off-chain', () => {
      const data = {
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        firstName: 'John',
        lastName: 'Doe'
      };
      
      const classified = DataClassificationService.classifyData(data);
      
      expect(classified.offChainData).toHaveProperty('email');
      expect(classified.offChainData).toHaveProperty('phoneNumber');
      expect(classified.offChainData).toHaveProperty('firstName');
      expect(classified.offChainData).toHaveProperty('lastName');
      expect(Object.keys(classified.onChainData)).toHaveLength(0);
    });
    
    it('should classify pseudonymous IDs as on-chain', () => {
      const data = {
        internalUserId: 'usr_123',
        userAccountObjectId: '0x123...'
      };
      
      const classified = DataClassificationService.classifyData(data);
      
      expect(classified.onChainData).toHaveProperty('internalUserId');
      expect(classified.onChainData).toHaveProperty('userAccountObjectId');
      expect(Object.keys(classified.offChainData)).toHaveLength(0);
    });
    
    it('should validate on-chain data and detect PII violations', () => {
      const invalidData = {
        email: 'user@example.com',
        loanAmount: 10000
      };
      
      const validation = DataClassificationService.validateOnChainData(invalidData);
      
      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain("Field 'email' cannot be stored on-chain");
    });
  });
  
  describe('PseudonymousIdService', () => {
    it('should generate valid pseudonymous ID', () => {
      const id = PseudonymousIdService.generatePseudonymousId('user');
      
      expect(id).toMatch(/^usr_[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
      
      const validation = PseudonymousIdService.validatePseudonymousId(id);
      expect(validation.valid).toBe(true);
      expect(validation.type).toBe('user');
    });
    
    it('should generate deterministic ID consistently', () => {
      const secretKey = 'test-secret-key';
      const realId = 'real-user-123';
      
      const id1 = PseudonymousIdService.generateDeterministicId(realId, 'user', secretKey);
      const id2 = PseudonymousIdService.generateDeterministicId(realId, 'user', secretKey);
      
      expect(id1).toBe(id2);
    });
  });
  
  describe('AuditTrailService', () => {
    it('should create audit event with proper data separation', () => {
      const event = AuditTrailService.createAuditEvent(
        AuditEventType.LOAN_APPROVED,
        'real-user-123',
        {
          targetRealId: 'loan-456',
          onChainData: {
            transactionHash: '0xabc...',
            blockNumber: 12345
          },
          offChainData: {
            ipAddress: '192.168.1.1',
            details: { amount: 10000 }
          }
        }
      );
      
      expect(event.eventType).toBe(AuditEventType.LOAN_APPROVED);
      expect(event.actorPseudonymousId).toMatch(/^usr_/);
      expect(event.onChainData.eventHash).toBeDefined();
      expect(event.offChainData.actorRealId).toBe('real-user-123');
    });
    
    it('should verify event hash integrity', () => {
      const event = AuditTrailService.createAuditEvent(
        AuditEventType.ASSET_UPLOADED,
        'real-user-123',
        {}
      );
      
      expect(AuditTrailService.verifyEventHash(event)).toBe(true);
    });
  });
  
  describe('IdentityIsolationService', () => {
    it('should create isolated identity', () => {
      const isolated = IdentityIsolationService.createIsolatedIdentity(
        'real-user-123',
        {
          email: 'user@example.com',
          phoneNumber: '+1234567890',
          name: 'John Doe'
        }
      );
      
      expect(isolated.realIdentity.userId).toBe('real-user-123');
      expect(isolated.realIdentity.email).toBe('user@example.com');
      expect(isolated.pseudonymousIdentity.userAccountObjectId).toMatch(/^usr_/);
      expect(isolated.mapping.mappingId).toBeDefined();
    });
    
    it('should sanitize data for on-chain storage', () => {
      const data = {
        email: 'user@example.com',
        userAccountObjectId: '0x123...',
        loanAmount: 10000,
        creditScore: 750
      };
      
      const sanitized = IdentityIsolationService.sanitizeForOnChain(data);
      
      expect(sanitized.sanitized).toHaveProperty('userAccountObjectId');
      expect(sanitized.sanitized).toHaveProperty('loanAmount');
      expect(sanitized.sanitized).not.toHaveProperty('email');
      expect(sanitized.sanitized).not.toHaveProperty('creditScore');
    });
    
    it('should encrypt and decrypt identity data', () => {
      const originalData = 'sensitive-user-data';
      
      const encrypted = IdentityIsolationService.encryptIdentityData(originalData);
      expect(encrypted).not.toBe(originalData);
      
      const decrypted = IdentityIsolationService.decryptIdentityData(encrypted);
      expect(decrypted).toBe(originalData);
    });
  });
});
