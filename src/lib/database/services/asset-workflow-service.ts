/**
 * Asset Workflow Tracking Service
 * 
 * Implements comprehensive asset tokenization workflow tracking:
 * - Multi-stage workflow management
 * - Document version control and history
 * - Approval and verification tracking
 * - Automated workflow progression
 */

import { connectToDatabase } from '../connection';
import { Asset, type IAsset } from '../models';

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  requiredDocuments: string[];
  requiredApprovals: string[];
  autoProgress: boolean;
  estimatedDuration: number; // in hours
}

export interface WorkflowProgress {
  assetId: string;
  currentStage: string;
  completedStages: string[];
  stageHistory: Array<{
    stage: string;
    enteredAt: Date;
    completedAt?: Date;
    duration?: number; // in milliseconds
    performedBy?: string;
    notes?: string;
    documents?: string[];
  }>;
  blockers: Array<{
    stage: string;
    reason: string;
    blockedAt: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
  }>;
  estimatedCompletion: Date;
  actualCompletion?: Date;
}

export interface DocumentVersion {
  documentId: string;
  version: number;
  ipfsHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  changes: string[];
  approvals: Array<{
    approvedBy: string;
    approvedAt: Date;
    notes?: string;
  }>;
  rejections: Array<{
    rejectedBy: string;
    rejectedAt: Date;
    reason: string;
  }>;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'superseded';
}
export class AssetWorkflowService {
  private readonly workflowStages: WorkflowStage[] = [
    {
      id: 'submission',
      name: 'Asset Submission',
      description: 'Initial asset information and documentation submission',
      requiredDocuments: ['asset_description', 'ownership_proof'],
      requiredApprovals: [],
      autoProgress: true,
      estimatedDuration: 1
    },
    {
      id: 'document_review',
      name: 'Document Review',
      description: 'Review and validation of submitted documents',
      requiredDocuments: ['asset_description', 'ownership_proof', 'valuation_report'],
      requiredApprovals: ['document_reviewer'],
      autoProgress: false,
      estimatedDuration: 24
    },
    {
      id: 'legal_verification',
      name: 'Legal Verification',
      description: 'Legal compliance and ownership verification',
      requiredDocuments: ['legal_opinion', 'title_search'],
      requiredApprovals: ['legal_team'],
      autoProgress: false,
      estimatedDuration: 72
    },
    {
      id: 'valuation_assessment',
      name: 'Valuation Assessment',
      description: 'Professional asset valuation and appraisal',
      requiredDocuments: ['appraisal_report', 'market_analysis'],
      requiredApprovals: ['valuation_expert'],
      autoProgress: false,
      estimatedDuration: 48
    },
    {
      id: 'risk_evaluation',
      name: 'Risk Evaluation',
      description: 'Risk assessment and rating assignment',
      requiredDocuments: ['risk_assessment'],
      requiredApprovals: ['risk_manager'],
      autoProgress: false,
      estimatedDuration: 24
    },
    {
      id: 'final_approval',
      name: 'Final Approval',
      description: 'Final approval for tokenization',
      requiredDocuments: [],
      requiredApprovals: ['senior_manager', 'compliance_officer'],
      autoProgress: false,
      estimatedDuration: 12
    },
    {
      id: 'tokenization',
      name: 'Token Minting',
      description: 'Smart contract deployment and token minting',
      requiredDocuments: [],
      requiredApprovals: [],
      autoProgress: true,
      estimatedDuration: 1
    },
    {
      id: 'completed',
      name: 'Completed',
      description: 'Asset successfully tokenized and available',
      requiredDocuments: [],
      requiredApprovals: [],
      autoProgress: false,
      estimatedDuration: 0
    }
  ];

  constructor() {}

  /**
   * Initialize workflow for a new asset
   */
  async initializeWorkflow(assetId: string, initiatedBy: string): Promise<WorkflowProgress> {
    await connectToDatabase();

    const workflow: WorkflowProgress = {
      assetId,
      currentStage: 'submission',
      completedStages: [],
      stageHistory: [{
        stage: 'submission',
        enteredAt: new Date(),
        performedBy: initiatedBy,
        notes: 'Workflow initialized'
      }],
      blockers: [],
      estimatedCompletion: this.calculateEstimatedCompletion(),
      actualCompletion: undefined
    };

    // Store workflow progress in asset document
    await Asset.updateOne(
      { tokenId: assetId },
      {
        $set: {
          'workflow': workflow,
          updatedAt: new Date()
        },
        $push: {
          auditTrail: {
            action: 'workflow_initialized',
            performedBy: initiatedBy,
            timestamp: new Date(),
            details: { initialStage: 'submission' }
          }
        }
      }
    );

    return workflow;
  }
  /**
   * Progress workflow to next stage
   */
  async progressWorkflow(
    assetId: string, 
    performedBy: string, 
    notes?: string,
    documents?: string[]
  ): Promise<WorkflowProgress | null> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset || !asset.workflow) {
      throw new Error('Asset workflow not found');
    }

    const workflow = asset.workflow as WorkflowProgress;
    const currentStage = this.workflowStages.find(s => s.id === workflow.currentStage);
    
    if (!currentStage) {
      throw new Error('Invalid current stage');
    }

    // Check if current stage requirements are met
    const canProgress = await this.canProgressStage(assetId, workflow.currentStage);
    if (!canProgress.allowed) {
      throw new Error(`Cannot progress: ${canProgress.reason}`);
    }

    // Complete current stage
    const stageEntry = workflow.stageHistory.find(h => h.stage === workflow.currentStage && !h.completedAt);
    if (stageEntry) {
      stageEntry.completedAt = new Date();
      stageEntry.duration = stageEntry.completedAt.getTime() - stageEntry.enteredAt.getTime();
      if (notes) stageEntry.notes = notes;
      if (documents) stageEntry.documents = documents;
    }

    workflow.completedStages.push(workflow.currentStage);

    // Move to next stage
    const nextStage = this.getNextStage(workflow.currentStage);
    if (nextStage) {
      workflow.currentStage = nextStage.id;
      workflow.stageHistory.push({
        stage: nextStage.id,
        enteredAt: new Date(),
        performedBy,
        notes: `Progressed from ${currentStage.name}`
      });

      // Update estimated completion
      workflow.estimatedCompletion = this.calculateEstimatedCompletion(workflow);
    } else {
      // Workflow completed
      workflow.currentStage = 'completed';
      workflow.actualCompletion = new Date();
    }

    // Update asset
    await Asset.updateOne(
      { tokenId: assetId },
      {
        $set: {
          'workflow': workflow,
          updatedAt: new Date()
        },
        $push: {
          auditTrail: {
            action: 'workflow_progressed',
            performedBy,
            timestamp: new Date(),
            details: { 
              fromStage: currentStage.id,
              toStage: workflow.currentStage,
              notes,
              documents
            }
          }
        }
      }
    );

    return workflow;
  }

  /**
   * Get workflow progress
   */
  async getWorkflowProgress(assetId: string): Promise<WorkflowProgress | null> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    return asset?.workflow || null;
  }

  /**
   * Add workflow blocker
   */
  async addWorkflowBlocker(
    assetId: string,
    stage: string,
    reason: string,
    blockedBy: string
  ): Promise<void> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset || !asset.workflow) {
      throw new Error('Asset workflow not found');
    }

    const workflow = asset.workflow as WorkflowProgress;
    workflow.blockers.push({
      stage,
      reason,
      blockedAt: new Date(),
      resolvedAt: undefined,
      resolvedBy: undefined
    });

    await Asset.updateOne(
      { tokenId: assetId },
      {
        $set: {
          'workflow': workflow,
          updatedAt: new Date()
        },
        $push: {
          auditTrail: {
            action: 'workflow_blocked',
            performedBy: blockedBy,
            timestamp: new Date(),
            details: { stage, reason }
          }
        }
      }
    );
  }

  /**
   * Resolve workflow blocker
   */
  async resolveWorkflowBlocker(
    assetId: string,
    stage: string,
    resolvedBy: string,
    resolution?: string
  ): Promise<void> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset || !asset.workflow) {
      throw new Error('Asset workflow not found');
    }

    const workflow = asset.workflow as WorkflowProgress;
    const blocker = workflow.blockers.find(b => b.stage === stage && !b.resolvedAt);
    
    if (blocker) {
      blocker.resolvedAt = new Date();
      blocker.resolvedBy = resolvedBy;
    }

    await Asset.updateOne(
      { tokenId: assetId },
      {
        $set: {
          'workflow': workflow,
          updatedAt: new Date()
        },
        $push: {
          auditTrail: {
            action: 'workflow_blocker_resolved',
            performedBy: resolvedBy,
            timestamp: new Date(),
            details: { stage, resolution }
          }
        }
      }
    );
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(dateRange?: { start: Date; end: Date }): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    averageCompletionTime: number;
    stageBottlenecks: Array<{
      stage: string;
      averageDuration: number;
      blockerCount: number;
    }>;
    completionRate: number;
  }> {
    await connectToDatabase();

    const query: any = {};
    if (dateRange) {
      query['workflow.stageHistory.enteredAt'] = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    const assets = await Asset.find({
      ...query,
      workflow: { $exists: true }
    });

    const totalWorkflows = assets.length;
    const completedWorkflows = assets.filter(a => a.workflow?.currentStage === 'completed').length;
    
    let totalCompletionTime = 0;
    let completedCount = 0;

    const stageStats = new Map<string, { durations: number[]; blockers: number }>();

    for (const asset of assets) {
      const workflow = asset.workflow as WorkflowProgress;
      
      if (workflow.actualCompletion) {
        const startTime = workflow.stageHistory[0]?.enteredAt;
        if (startTime) {
          totalCompletionTime += workflow.actualCompletion.getTime() - startTime.getTime();
          completedCount++;
        }
      }

      // Analyze stage durations
      for (const stageEntry of workflow.stageHistory) {
        if (stageEntry.completedAt && stageEntry.duration) {
          if (!stageStats.has(stageEntry.stage)) {
            stageStats.set(stageEntry.stage, { durations: [], blockers: 0 });
          }
          stageStats.get(stageEntry.stage)!.durations.push(stageEntry.duration);
        }
      }

      // Count blockers per stage
      for (const blocker of workflow.blockers) {
        if (!stageStats.has(blocker.stage)) {
          stageStats.set(blocker.stage, { durations: [], blockers: 0 });
        }
        stageStats.get(blocker.stage)!.blockers++;
      }
    }

    const averageCompletionTime = completedCount > 0 ? totalCompletionTime / completedCount : 0;
    const completionRate = totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 0;

    const stageBottlenecks = Array.from(stageStats.entries()).map(([stage, stats]) => ({
      stage,
      averageDuration: stats.durations.length > 0 
        ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length 
        : 0,
      blockerCount: stats.blockers
    })).sort((a, b) => b.averageDuration - a.averageDuration);

    return {
      totalWorkflows,
      completedWorkflows,
      averageCompletionTime,
      stageBottlenecks,
      completionRate
    };
  }

  /**
   * Private helper methods
   */
  private async canProgressStage(assetId: string, stageId: string): Promise<{ allowed: boolean; reason?: string }> {
    const stage = this.workflowStages.find(s => s.id === stageId);
    if (!stage) {
      return { allowed: false, reason: 'Invalid stage' };
    }

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset) {
      return { allowed: false, reason: 'Asset not found' };
    }

    // Check for active blockers
    const workflow = asset.workflow as WorkflowProgress;
    const activeBlockers = workflow.blockers.filter(b => !b.resolvedAt && b.stage === stageId);
    if (activeBlockers.length > 0) {
      return { allowed: false, reason: `Active blockers: ${activeBlockers.map(b => b.reason).join(', ')}` };
    }

    return { allowed: true };
  }

  private getNextStage(currentStageId: string): WorkflowStage | null {
    const currentIndex = this.workflowStages.findIndex(s => s.id === currentStageId);
    if (currentIndex === -1 || currentIndex === this.workflowStages.length - 1) {
      return null;
    }
    return this.workflowStages[currentIndex + 1];
  }

  private calculateEstimatedCompletion(workflow?: WorkflowProgress): Date {
    const now = new Date();
    let totalHours = 0;

    if (workflow) {
      // Calculate remaining time based on current stage
      const currentStageIndex = this.workflowStages.findIndex(s => s.id === workflow.currentStage);
      for (let i = currentStageIndex; i < this.workflowStages.length; i++) {
        totalHours += this.workflowStages[i].estimatedDuration;
      }
    } else {
      // Calculate total time for all stages
      totalHours = this.workflowStages.reduce((sum, stage) => sum + stage.estimatedDuration, 0);
    }

    return new Date(now.getTime() + totalHours * 60 * 60 * 1000);
  }
}

export const assetWorkflowService = new AssetWorkflowService();