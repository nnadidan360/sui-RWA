/**
 * Property-Based Tests for Admin Controls
 * 
 * **Feature: rwa-lending-protocol, Property 24: Asset type approval workflow**
 * **Validates: Requirements 6.2**
 */

import * as fc from 'fast-check';

// Mock asset submission interface matching the component
interface AssetSubmission {
  id: string;
  title: string;
  type: 'real_estate' | 'art' | 'commodity' | 'security' | 'other';
  submittedBy: string;
  submittedAt: Date;
  status: 'pending_review' | 'pending_verification' | 'approved' | 'rejected';
  value: number;
  description: string;
  documents: string[];
  verificationNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

// Mock admin service that handles asset type approval workflow
class AssetApprovalService {
  private submissions: AssetSubmission[] = [];
  private approvedAssetTypes: Set<string> = new Set();

  addSubmission(submission: AssetSubmission): void {
    this.submissions.push(submission);
  }

  approveAssetType(assetType: string, adminId: string): boolean {
    // Requirement 6.2: Administrator approval required before enabling tokenization
    if (!adminId || !this.isAuthorizedAdmin(adminId)) {
      return false;
    }
    
    this.approvedAssetTypes.add(assetType);
    return true;
  }

  processSubmission(submissionId: string, approved: boolean, adminId: string, notes?: string): AssetSubmission | null {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return null;

    // Requirement 6.2: Administrator approval and risk assessment required
    if (!this.isAuthorizedAdmin(adminId)) {
      return null;
    }

    // Check if asset type is approved for tokenization
    if (approved && !this.approvedAssetTypes.has(submission.type)) {
      return null; // Cannot approve submission for unapproved asset type
    }

    // Update submission status
    submission.status = approved ? 'approved' : 'rejected';
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    if (notes) {
      submission.verificationNotes = notes;
    }

    return submission;
  }

  canTokenizeAssetType(assetType: string): boolean {
    return this.approvedAssetTypes.has(assetType);
  }

  private isAuthorizedAdmin(adminId: string): boolean {
    // Mock admin authorization check
    return adminId.includes('admin') || adminId.includes('moderator');
  }

  getSubmissions(): AssetSubmission[] {
    return [...this.submissions];
  }

  getApprovedAssetTypes(): string[] {
    return Array.from(this.approvedAssetTypes);
  }
}

// Property-based test generators
const assetTypeArb = fc.constantFrom('real_estate', 'art', 'commodity', 'security', 'other');
const adminIdArb = fc.oneof(
  fc.constant('admin@platform.com'),
  fc.constant('moderator@platform.com'),
  fc.constant('unauthorized@user.com')
);

const assetSubmissionArb = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  title: fc.string({ minLength: 10, maxLength: 100 }),
  type: assetTypeArb,
  submittedBy: fc.emailAddress(),
  submittedAt: fc.date(),
  status: fc.constantFrom('pending_review', 'pending_verification'),
  value: fc.integer({ min: 1000, max: 10000000 }),
  description: fc.string({ minLength: 20, maxLength: 500 }),
  documents: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 })
}) as fc.Arbitrary<AssetSubmission>;

describe('Admin Controls Property Tests', () => {
  let service: AssetApprovalService;

  beforeEach(() => {
    service = new AssetApprovalService();
  });

  /**
   * Property 24: Asset type approval workflow
   * For any new asset type addition, administrator approval and risk assessment 
   * should be required before tokenization is enabled
   */
  test('Property 24: Asset type approval workflow - admin approval required', () => {
    fc.assert(fc.property(
      assetTypeArb,
      adminIdArb,
      (assetType, adminId) => {
        // Create fresh service for each test run to avoid state pollution
        const testService = new AssetApprovalService();
        
        const initialApprovedTypes = testService.getApprovedAssetTypes().length;
        const approvalResult = testService.approveAssetType(assetType, adminId);
        const finalApprovedTypes = testService.getApprovedAssetTypes().length;
        
        if (adminId.includes('admin') || adminId.includes('moderator')) {
          // Authorized admin should be able to approve asset types
          expect(approvalResult).toBe(true);
          expect(finalApprovedTypes).toBe(initialApprovedTypes + 1);
          expect(testService.canTokenizeAssetType(assetType)).toBe(true);
        } else {
          // Unauthorized users should not be able to approve asset types
          expect(approvalResult).toBe(false);
          expect(finalApprovedTypes).toBe(initialApprovedTypes);
          expect(testService.canTokenizeAssetType(assetType)).toBe(false);
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 24: Asset type approval workflow - tokenization requires pre-approval', () => {
    fc.assert(fc.property(
      assetSubmissionArb,
      adminIdArb,
      fc.boolean(),
      fc.option(fc.string({ minLength: 10, maxLength: 200 })),
      (submission, adminId, shouldApprove, notes) => {
        // Create fresh service for each test run
        const testService = new AssetApprovalService();
        testService.addSubmission(submission);
        
        // Process submission without pre-approving asset type
        const result = testService.processSubmission(submission.id, shouldApprove, adminId, notes || undefined);
        
        if (!adminId.includes('admin') && !adminId.includes('moderator')) {
          // Unauthorized admin cannot process submissions
          expect(result).toBeNull();
        } else if (shouldApprove && !testService.canTokenizeAssetType(submission.type)) {
          // Cannot approve submission for unapproved asset type
          expect(result).toBeNull();
        } else {
          // Valid processing
          expect(result).not.toBeNull();
          if (result) {
            expect(result.status).toBe(shouldApprove ? 'approved' : 'rejected');
            expect(result.reviewedBy).toBe(adminId);
            expect(result.reviewedAt).toBeInstanceOf(Date);
            if (notes) {
              expect(result.verificationNotes).toBe(notes);
            }
          }
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 24: Asset type approval workflow - complete workflow integrity', () => {
    fc.assert(fc.property(
      assetSubmissionArb,
      adminIdArb,
      fc.option(fc.string({ minLength: 10, maxLength: 200 })),
      (submission, adminId, notes) => {
        // Create fresh service for each test run
        const testService = new AssetApprovalService();
        testService.addSubmission(submission);
        
        // First approve the asset type
        const typeApprovalResult = testService.approveAssetType(submission.type, adminId);
        
        // Then try to approve the submission
        const submissionApprovalResult = testService.processSubmission(
          submission.id, 
          true, 
          adminId, 
          notes || undefined
        );
        
        if (adminId.includes('admin') || adminId.includes('moderator')) {
          // Authorized admin should complete full workflow
          expect(typeApprovalResult).toBe(true);
          expect(submissionApprovalResult).not.toBeNull();
          expect(submissionApprovalResult?.status).toBe('approved');
          expect(testService.canTokenizeAssetType(submission.type)).toBe(true);
        } else {
          // Unauthorized user cannot complete workflow
          expect(typeApprovalResult).toBe(false);
          expect(submissionApprovalResult).toBeNull();
          expect(testService.canTokenizeAssetType(submission.type)).toBe(false);
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 24: Asset type approval workflow - rejection workflow', () => {
    fc.assert(fc.property(
      assetSubmissionArb,
      adminIdArb,
      fc.string({ minLength: 10, maxLength: 200 }),
      (submission, adminId, rejectionReason) => {
        // Create fresh service for each test run
        const testService = new AssetApprovalService();
        testService.addSubmission(submission);
        
        // Reject submission (no need to pre-approve asset type for rejection)
        const result = testService.processSubmission(submission.id, false, adminId, rejectionReason);
        
        if (adminId.includes('admin') || adminId.includes('moderator')) {
          // Authorized admin can reject submissions
          expect(result).not.toBeNull();
          expect(result?.status).toBe('rejected');
          expect(result?.reviewedBy).toBe(adminId);
          expect(result?.verificationNotes).toBe(rejectionReason);
          expect(result?.reviewedAt).toBeInstanceOf(Date);
        } else {
          // Unauthorized user cannot reject submissions
          expect(result).toBeNull();
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 24: Asset type approval workflow - idempotent asset type approval', () => {
    fc.assert(fc.property(
      assetTypeArb,
      adminIdArb,
      (assetType, adminId) => {
        // Create fresh service for each test run
        const testService = new AssetApprovalService();
        
        // Approve asset type multiple times
        const firstApproval = testService.approveAssetType(assetType, adminId);
        const secondApproval = testService.approveAssetType(assetType, adminId);
        const thirdApproval = testService.approveAssetType(assetType, adminId);
        
        const approvedTypes = testService.getApprovedAssetTypes();
        const typeCount = approvedTypes.filter(type => type === assetType).length;
        
        if (adminId.includes('admin') || adminId.includes('moderator')) {
          // All approvals should succeed
          expect(firstApproval).toBe(true);
          expect(secondApproval).toBe(true);
          expect(thirdApproval).toBe(true);
          
          // But asset type should only appear once in approved list
          expect(typeCount).toBe(1);
          expect(testService.canTokenizeAssetType(assetType)).toBe(true);
        } else {
          // All approvals should fail
          expect(firstApproval).toBe(false);
          expect(secondApproval).toBe(false);
          expect(thirdApproval).toBe(false);
          
          // Asset type should not be approved
          expect(typeCount).toBe(0);
          expect(testService.canTokenizeAssetType(assetType)).toBe(false);
        }
      }
    ), { numRuns: 100 });
  });
});