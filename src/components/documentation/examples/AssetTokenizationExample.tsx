'use client';

import React, { useState } from 'react';
import { useDocumentation } from '../DocumentationProvider';
import { HelpTooltip } from '../HelpTooltip';
import { ProgressiveDisclosure, DisclosureSection } from '../ProgressiveDisclosure';
import { StepWizard, WizardStep } from '../StepWizard';

// Example of how to integrate documentation components into a real page
export const AssetTokenizationExample: React.FC = () => {
  const { trackUserAction, startGuide } = useDocumentation();
  const [showWizard, setShowWizard] = useState(false);
  const [assetData, setAssetData] = useState({
    type: '',
    value: '',
    documents: []
  });

  // Progressive disclosure sections for asset tokenization
  const disclosureSections: DisclosureSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started with Asset Tokenization',
      level: 'beginner',
      estimatedTime: '5 minutes',
      difficulty: 1,
      content: (
        <div className="space-y-4">
          <p>Asset tokenization converts your real-world assets into digital tokens on the blockchain.</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">What you'll need:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Valid identification documents</li>
              <li>Asset ownership documentation</li>
              <li>Recent asset appraisal</li>
              <li>Connected Casper wallet</li>
            </ul>
          </div>
        </div>
      ),
      tips: [
        'Start with smaller, simpler assets to learn the process',
        'Ensure all documents are clear and up-to-date',
        'Keep digital copies of all paperwork'
      ]
    },
    {
      id: 'document-preparation',
      title: 'Preparing Your Documents',
      level: 'beginner',
      estimatedTime: '15 minutes',
      difficulty: 2,
      prerequisites: ['Valid ID', 'Asset ownership proof'],
      content: (
        <div className="space-y-4">
          <p>Proper documentation is crucial for successful asset tokenization.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Real Estate</h4>
              <ul className="text-sm space-y-1">
                <li>• Property deed or title</li>
                <li>• Recent appraisal (within 6 months)</li>
                <li>• Property tax records</li>
                <li>• Insurance documentation</li>
              </ul>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Vehicles</h4>
              <ul className="text-sm space-y-1">
                <li>• Vehicle title or registration</li>
                <li>• Recent valuation report</li>
                <li>• Insurance documentation</li>
                <li>• Maintenance records</li>
              </ul>
            </div>
          </div>
        </div>
      ),
      tips: [
        'Scan documents at high resolution (300 DPI minimum)',
        'Ensure all text is clearly readable',
        'Include certified translations for non-English documents'
      ],
      warnings: [
        'Documents must be original or certified copies',
        'Expired documents will be rejected',
        'All information must match exactly across documents'
      ]
    },
    {
      id: 'advanced-strategies',
      title: 'Advanced Tokenization Strategies',
      level: 'advanced',
      estimatedTime: '30 minutes',
      difficulty: 4,
      prerequisites: ['Completed at least one tokenization', 'Understanding of DeFi protocols'],
      content: (
        <div className="space-y-4">
          <p>Advanced users can leverage sophisticated strategies for asset tokenization.</p>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold">Fractional Ownership</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Split large assets into multiple tokens for easier trading and investment.
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold">Cross-Chain Bridging</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bridge your tokens to other blockchains for increased liquidity.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold">Yield Optimization</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use tokenized assets across multiple DeFi protocols simultaneously.
              </p>
            </div>
          </div>
        </div>
      ),
      warnings: [
        'Advanced strategies carry higher risks',
        'Ensure you understand all implications before proceeding',
        'Consider consulting with a financial advisor'
      ]
    }
  ];

  // Wizard steps for asset tokenization
  const wizardSteps: WizardStep[] = [
    {
      id: 'asset-type',
      title: 'Select Asset Type',
      description: 'Choose the type of asset you want to tokenize',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Real Estate', 'Vehicle', 'Equipment', 'Commodity', 'Other'].map((type) => (
              <button
                key={type}
                onClick={() => setAssetData(prev => ({ ...prev, type }))}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  assetData.type === type
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{type}</div>
              </button>
            ))}
          </div>
        </div>
      ),
      validation: {
        required: true,
        validator: () => !!assetData.type,
        errorMessage: 'Please select an asset type'
      }
    },
    {
      id: 'asset-details',
      title: 'Asset Details',
      description: 'Provide basic information about your asset',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estimated Value (USD)
            </label>
            <input
              type="number"
              value={assetData.value}
              onChange={(e) => setAssetData(prev => ({ ...prev, value: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter asset value"
            />
          </div>
        </div>
      ),
      validation: {
        required: true,
        validator: () => !!assetData.value && parseFloat(assetData.value) > 0,
        errorMessage: 'Please enter a valid asset value'
      }
    },
    {
      id: 'document-upload',
      title: 'Upload Documents',
      description: 'Upload the required documentation for your asset',
      content: (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              <p>Drag and drop your documents here, or click to browse</p>
              <p className="text-sm mt-2">Supported formats: PDF, JPG, PNG (max 10MB each)</p>
            </div>
          </div>
        </div>
      ),
      canSkip: true
    },
    {
      id: 'review-submit',
      title: 'Review and Submit',
      description: 'Review your information before submitting',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Asset Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Type:</span>
                <span>{assetData.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Value:</span>
                <span>${assetData.value}</span>
              </div>
              <div className="flex justify-between">
                <span>Documents:</span>
                <span>{assetData.documents.length} files</span>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>By submitting, you agree to our terms and conditions and confirm that all information provided is accurate.</p>
          </div>
        </div>
      )
    }
  ];

  const handleWizardComplete = (data: any) => {
    setShowWizard(false);
    trackUserAction('asset_tokenization_completed', data);
    // Handle the actual submission here
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    trackUserAction('asset_tokenization_cancelled');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Asset Tokenization
            <HelpTooltip
              content={{
                title: 'Asset Tokenization',
                description: 'Convert your real-world assets into digital tokens that can be traded, used as collateral, or held as investments.',
                links: [
                  { text: 'Read Full Guide', url: '/docs/asset-tokenization' },
                  { text: 'Watch Video Tutorial', url: '/tutorials/tokenization', external: true }
                ]
              }}
              className="ml-2"
            />
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Transform your real-world assets into tradeable digital tokens
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => startGuide('asset-tokenization')}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
          >
            Start Interactive Guide
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Tokenize Asset
          </button>
        </div>
      </div>

      {/* Progressive Disclosure Documentation */}
      <ProgressiveDisclosure
        title="Asset Tokenization Guide"
        description="Learn everything you need to know about tokenizing your assets"
        sections={disclosureSections}
        userLevel="beginner"
        autoExpand={false}
        showLevelIndicators={true}
        showProgress={true}
        onSectionComplete={(sectionId) => trackUserAction('guide_section_completed', { sectionId })}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            My Assets
            <HelpTooltip
              content="View and manage all your tokenized assets in one place"
              size="sm"
              className="ml-2"
            />
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            View your tokenized assets and their current values
          </p>
          <button className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
            View Assets
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Verification Status
            <HelpTooltip
              content={{
                title: 'Asset Verification',
                description: 'Track the progress of your asset verification process',
                type: 'info'
              }}
              size="sm"
              className="ml-2"
            />
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Check the status of pending verifications
          </p>
          <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
            Check Status
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Asset Performance
            <HelpTooltip
              content={{
                title: 'Performance Tracking',
                description: 'Monitor how your tokenized assets are performing over time',
                type: 'info',
                links: [
                  { text: 'Learn about asset valuation', url: '/docs/valuation' }
                ]
              }}
              size="sm"
              className="ml-2"
            />
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Track performance and value changes
          </p>
          <button className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
            View Analytics
          </button>
        </div>
      </div>

      {/* Step Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <StepWizard
              wizardId="asset-tokenization"
              title="Tokenize Your Asset"
              description="Follow these steps to tokenize your real-world asset"
              steps={wizardSteps}
              onComplete={handleWizardComplete}
              onCancel={handleWizardCancel}
              allowBackNavigation={true}
              showProgress={true}
              saveProgress={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetTokenizationExample;