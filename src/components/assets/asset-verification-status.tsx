'use client';

import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Shield } from 'lucide-react';

export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'requires_update';

export interface VerificationStep {
  id: string;
  name: string;
  status: 'complete' | 'in_progress' | 'pending' | 'failed';
  timestamp?: Date;
  notes?: string;
}

export interface AssetVerificationStatusProps {
  status: VerificationStatus;
  steps: VerificationStep[];
  rejectionReason?: string;
  updateRequirements?: string[];
  onRequestUpdate?: () => void;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'Pending Review',
    description: 'Your asset is queued for verification'
  },
  under_review: {
    icon: RefreshCw,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Under Review',
    description: 'Our team is verifying your asset documents'
  },
  approved: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'Approved',
    description: 'Asset verified and ready for use as collateral'
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Rejected',
    description: 'Asset verification failed'
  },
  requires_update: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    label: 'Requires Update',
    description: 'Additional information needed'
  }
};

const STEP_ICON_CONFIG = {
  complete: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
  in_progress: { icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400' },
  pending: { icon: Clock, color: 'text-gray-400' },
  failed: { icon: XCircle, color: 'text-red-600 dark:text-red-400' }
};

export function AssetVerificationStatus({
  status,
  steps,
  rejectionReason,
  updateRequirements,
  onRequestUpdate
}: AssetVerificationStatusProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <div className={`${config.bg} ${config.border} border rounded-xl p-6`}>
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-lg bg-white dark:bg-gray-800 ${config.color}`}>
            <StatusIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${config.color} mb-1`}>
              {config.label}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {config.description}
            </p>
            
            {/* Rejection Reason */}
            {status === 'rejected' && rejectionReason && (
              <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Rejection Reason:
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {rejectionReason}
                </p>
              </div>
            )}

            {/* Update Requirements */}
            {status === 'requires_update' && updateRequirements && updateRequirements.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Required Updates:
                </p>
                <ul className="space-y-1">
                  {updateRequirements.map((req, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
                {onRequestUpdate && (
                  <button
                    onClick={onRequestUpdate}
                    className="mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Update Asset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verification Steps */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Verification Process
        </h4>
        
        <div className="space-y-4">
          {steps.map((step, index) => {
            const stepConfig = STEP_ICON_CONFIG[step.status];
            const StepIcon = stepConfig.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative">
                {/* Connector Line */}
                {!isLast && (
                  <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}

                <div className="flex items-start space-x-4">
                  {/* Step Icon */}
                  <div className={`relative z-10 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 ${stepConfig.color}`}>
                    <StepIcon className={`w-5 h-5 ${step.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {step.name}
                      </h5>
                      {step.timestamp && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(step.timestamp)}
                        </span>
                      )}
                    </div>
                    
                    {step.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {step.notes}
                      </p>
                    )}

                    {/* Status Badge */}
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        step.status === 'complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        step.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        step.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {step.status === 'complete' ? 'Completed' :
                         step.status === 'in_progress' ? 'In Progress' :
                         step.status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">Verification Timeline:</span> Asset verification typically takes 3-5 business days. 
          You'll receive notifications at each step of the process.
        </p>
      </div>
    </div>
  );
}
