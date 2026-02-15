'use client';

import { TrendingUp, Shield, FileCheck, Database, AlertCircle, CheckCircle } from 'lucide-react';

export interface ConfidenceFactors {
  documentVerification: number; // 0-100
  registryCheck: number; // 0-100
  duplicateCheck: number; // 0-100
  jurisdictionCompliance: number; // 0-100
  metadataQuality: number; // 0-100
}

export interface AssetConfidenceScoreProps {
  overallScore: number; // 0-100
  factors: ConfidenceFactors;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations?: string[];
}

export function AssetConfidenceScore({
  overallScore,
  factors,
  riskLevel,
  recommendations
}: AssetConfidenceScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRiskConfig = () => {
    switch (riskLevel) {
      case 'low':
        return {
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          label: 'Low Risk',
          icon: CheckCircle
        };
      case 'medium':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          label: 'Medium Risk',
          icon: AlertCircle
        };
      case 'high':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          label: 'High Risk',
          icon: AlertCircle
        };
    }
  };

  const riskConfig = getRiskConfig();
  const RiskIcon = riskConfig.icon;

  const factorDetails = [
    {
      name: 'Document Verification',
      score: factors.documentVerification,
      icon: FileCheck,
      description: 'Quality and authenticity of submitted documents'
    },
    {
      name: 'Registry Check',
      score: factors.registryCheck,
      icon: Database,
      description: 'Verification against public registries where available'
    },
    {
      name: 'Duplicate Check',
      score: factors.duplicateCheck,
      icon: Shield,
      description: 'No duplicate submissions detected via document hashing'
    },
    {
      name: 'Jurisdiction Compliance',
      score: factors.jurisdictionCompliance,
      icon: CheckCircle,
      description: 'Compliance with local regulations and requirements'
    },
    {
      name: 'Metadata Quality',
      score: factors.metadataQuality,
      icon: FileCheck,
      description: 'Completeness and accuracy of asset information'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Asset Confidence Score
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Probabilistic assessment based on verification factors
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Score Display */}
        <div className="flex items-end space-x-6">
          <div>
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              out of 100
            </div>
          </div>

          {/* Score Bar */}
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreBg(overallScore)} transition-all duration-500`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Risk Level */}
        <div className={`mt-4 ${riskConfig.bg} ${riskConfig.border} border rounded-lg p-3 flex items-center`}>
          <RiskIcon className={`w-5 h-5 ${riskConfig.color} mr-2`} />
          <span className={`font-medium ${riskConfig.color}`}>
            {riskConfig.label}
          </span>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Confidence Factors
        </h4>

        <div className="space-y-4">
          {factorDetails.map((factor) => {
            const FactorIcon = factor.icon;
            return (
              <div key={factor.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FactorIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {factor.name}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${getScoreColor(factor.score)}`}>
                    {factor.score}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getScoreBg(factor.score)} transition-all duration-500`}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {factor.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Recommendations
          </h4>
          <ul className="space-y-2">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start text-sm text-blue-800 dark:text-blue-200">
                <span className="text-blue-600 dark:text-blue-400 mr-2 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">About Confidence Scores:</span> This probabilistic score is calculated 
          based on document verification, registry checks, duplicate detection, and jurisdiction-specific validation. 
          Higher scores indicate greater confidence in asset authenticity and eligibility for collateralization.
        </p>
      </div>
    </div>
  );
}
