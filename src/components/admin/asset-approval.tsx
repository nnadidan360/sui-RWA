'use client';

import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  FileText, 
  DollarSign,
  Calendar,
  User,
  AlertTriangle,
  Download,
  ExternalLink
} from 'lucide-react';

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

// Mock asset submissions
const mockSubmissions: AssetSubmission[] = [
  {
    id: 'asset_001',
    title: 'Manhattan Commercial Property',
    type: 'real_estate',
    submittedBy: 'john.doe@realestate.com',
    submittedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: 'pending_review',
    value: 2500000,
    description: 'Prime commercial real estate in Manhattan, fully leased with stable tenants.',
    documents: ['property_deed.pdf', 'appraisal_report.pdf', 'lease_agreements.pdf', 'insurance_policy.pdf'],
  },
  {
    id: 'asset_002',
    title: 'Contemporary Art Collection',
    type: 'art',
    submittedBy: 'curator@modernart.gallery',
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'pending_verification',
    value: 850000,
    description: 'Collection of 15 contemporary artworks by established artists.',
    documents: ['authenticity_certificates.pdf', 'appraisal_report.pdf', 'provenance_documentation.pdf'],
    verificationNotes: 'Authenticity certificates verified. Awaiting final appraisal confirmation.',
  },
  {
    id: 'asset_003',
    title: 'Gold Bullion Reserve',
    type: 'commodity',
    submittedBy: 'trader@goldvault.com',
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: 'approved',
    value: 1200000,
    description: '100 oz of certified gold bullion stored in secure vault facility.',
    documents: ['vault_certificate.pdf', 'purity_assay.pdf', 'insurance_coverage.pdf'],
    reviewedBy: 'admin@platform.com',
    reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'asset_004',
    title: 'Vintage Wine Collection',
    type: 'other',
    submittedBy: 'collector@winehouse.com',
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: 'rejected',
    value: 450000,
    description: 'Rare vintage wine collection from Bordeaux region.',
    documents: ['collection_inventory.pdf', 'storage_conditions.pdf'],
    verificationNotes: 'Insufficient documentation for provenance verification.',
    reviewedBy: 'admin@platform.com',
    reviewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
];

export function AssetApproval() {
  const [submissions, setSubmissions] = useState<AssetSubmission[]>(mockSubmissions);
  const [selectedSubmission, setSelectedSubmission] = useState<AssetSubmission | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [verificationNotes, setVerificationNotes] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'pending_verification':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Clock className="w-4 h-4" />;
      case 'pending_verification':
        return <Eye className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'real_estate':
        return '🏢';
      case 'art':
        return '🎨';
      case 'commodity':
        return '🥇';
      case 'security':
        return '📈';
      default:
        return '📦';
    }
  };

  const handleApproval = (submissionId: string, approved: boolean) => {
    setSubmissions(prev => 
      prev.map(submission => 
        submission.id === submissionId 
          ? { 
              ...submission, 
              status: approved ? 'approved' : 'rejected',
              verificationNotes,
              reviewedBy: 'admin@platform.com',
              reviewedAt: new Date(),
            }
          : submission
      )
    );
    setSelectedSubmission(null);
    setVerificationNotes('');
  };

  const filteredSubmissions = submissions.filter(submission => 
    filterStatus === 'all' || submission.status === filterStatus
  );

  const pendingCount = submissions.filter(s => s.status === 'pending_review' || s.status === 'pending_verification').length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
            <span className="text-yellow-400 text-sm font-medium">Pending</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{pendingCount}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Awaiting Review</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <span className="text-green-400 text-sm font-medium">Approved</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {submissions.filter(s => s.status === 'approved').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">This Month</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-blue-400 text-sm font-medium">Value</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(submissions.reduce((sum, s) => sum + s.value, 0))}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Submitted</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <span className="text-purple-400 text-sm font-medium">Average</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">2.3</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Days to Review</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { value: 'all', label: 'All Submissions' },
            { value: 'pending_review', label: 'Pending Review' },
            { value: 'pending_verification', label: 'Pending Verification' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                filterStatus === filter.value
                  ? 'bg-blue-500 text-gray-900 dark:text-white'
                  : 'bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Asset Submissions</h3>

        <div className="space-y-4">
          {filteredSubmissions.map((submission) => (
            <div key={submission.id} className="p-4 bg-gray-100 dark:bg-gray-800/30 rounded-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <div className="text-3xl">{getTypeIcon(submission.type)}</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-medium">{submission.title}</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{submission.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{submission.submittedBy}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(submission.submittedAt)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-4 h-4" />
                        <span>{formatCurrency(submission.value)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-lg border ${getStatusColor(submission.status)}`}>
                    {getStatusIcon(submission.status)}
                    {submission.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => setSelectedSubmission(submission)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white text-sm rounded-lg transition-colors"
                  >
                    Review
                  </button>
                </div>
              </div>

              {/* Documents */}
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400 text-sm">Documents:</span>
                <div className="flex space-x-2">
                  {submission.documents.map((doc, index) => (
                    <button
                      key={index}
                      className="flex items-center space-x-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>{doc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Verification Notes */}
              {submission.verificationNotes && (
                <div className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 text-sm font-medium">Verification Notes</p>
                      <p className="text-gray-300 text-sm mt-1">{submission.verificationNotes}</p>
                      {submission.reviewedBy && submission.reviewedAt && (
                        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                          Reviewed by {submission.reviewedBy} on {formatDate(submission.reviewedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80" onClick={() => setSelectedSubmission(null)} />
            
            <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Asset Submission</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{selectedSubmission.title}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Asset Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Asset Type</p>
                    <p className="text-gray-900 dark:text-white font-medium">{selectedSubmission.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Estimated Value</p>
                    <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(selectedSubmission.value)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Submitted By</p>
                    <p className="text-gray-900 dark:text-white font-medium">{selectedSubmission.submittedBy}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Submitted On</p>
                    <p className="text-gray-900 dark:text-white font-medium">{formatDate(selectedSubmission.submittedAt)}</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Description</p>
                  <p className="text-gray-900 dark:text-white">{selectedSubmission.description}</p>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Supporting Documents</p>
                  <div className="space-y-2">
                    {selectedSubmission.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <span className="text-gray-900 dark:text-white">{doc}</span>
                        </div>
                        <div className="flex space-x-2">
                          <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification Notes */}
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 text-sm mb-2">
                    Verification Notes (Optional)
                  </label>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Add any notes about the verification process..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 border-t border-gray-800">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleApproval(selectedSubmission.id, false)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproval(selectedSubmission.id, true)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}