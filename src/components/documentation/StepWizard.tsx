'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle,
  Info,
  X
} from 'lucide-react';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  validation?: {
    required: boolean;
    validator?: () => Promise<boolean> | boolean;
    errorMessage?: string;
  };
  canSkip?: boolean;
  estimatedTime?: string;
  tips?: string[];
  warnings?: string[];
}

export interface StepWizardProps {
  wizardId: string;
  title: string;
  description?: string;
  steps: WizardStep[];
  onComplete?: (data: any) => void;
  onCancel?: () => void;
  onStepChange?: (stepIndex: number, stepId: string) => void;
  allowBackNavigation?: boolean;
  showProgress?: boolean;
  saveProgress?: boolean;
  className?: string;
}

export const StepWizard: React.FC<StepWizardProps> = ({
  wizardId,
  title,
  description,
  steps,
  onComplete,
  onCancel,
  onStepChange,
  allowBackNavigation = true,
  showProgress = true,
  saveProgress = true,
  className = ''
}) => {
  const { t } = useTranslation('documentation');
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load saved progress
  useEffect(() => {
    if (saveProgress) {
      const saved = localStorage.getItem(`wizard-${wizardId}`);
      if (saved) {
        const data = JSON.parse(saved);
        setCurrentStep(data.currentStep || 0);
        setCompletedSteps(new Set(data.completedSteps || []));
        setStepData(data.stepData || {});
      }
    }
  }, [wizardId, saveProgress]);

  // Save progress
  useEffect(() => {
    if (saveProgress) {
      const data = {
        currentStep,
        completedSteps: Array.from(completedSteps),
        stepData
      };
      localStorage.setItem(`wizard-${wizardId}`, JSON.stringify(data));
    }
  }, [wizardId, currentStep, completedSteps, stepData, saveProgress]);

  // Notify parent of step changes
  useEffect(() => {
    if (onStepChange && steps[currentStep]) {
      onStepChange(currentStep, steps[currentStep].id);
    }
  }, [currentStep, onStepChange, steps]);

  const validateCurrentStep = async (): Promise<boolean> => {
    const step = steps[currentStep];
    if (!step.validation?.required) return true;

    setIsValidating(true);
    setValidationError(null);

    try {
      const isValid = step.validation.validator 
        ? await step.validation.validator()
        : true;

      if (!isValid) {
        setValidationError(step.validation.errorMessage || t('wizard.validationError'));
      }

      return isValid;
    } catch (error) {
      setValidationError(t('wizard.validationError'));
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const goToNextStep = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    // Mark current step as completed
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStep);
    setCompletedSteps(newCompleted);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setValidationError(null);
    } else {
      // Wizard completed
      handleComplete();
    }
  };

  const goToPreviousStep = () => {
    if (allowBackNavigation && currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setValidationError(null);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      // Can only go to completed steps or the next step
      if (completedSteps.has(stepIndex) || stepIndex === currentStep + 1 || stepIndex < currentStep) {
        setCurrentStep(stepIndex);
        setValidationError(null);
      }
    }
  };

  const skipCurrentStep = () => {
    const step = steps[currentStep];
    if (step.canSkip) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
        setValidationError(null);
      } else {
        handleComplete();
      }
    }
  };

  const handleComplete = () => {
    if (saveProgress) {
      localStorage.removeItem(`wizard-${wizardId}`);
    }
    onComplete?.(stepData);
  };

  const handleCancel = () => {
    if (saveProgress) {
      localStorage.removeItem(`wizard-${wizardId}`);
    }
    onCancel?.();
  };

  const updateStepData = (stepId: string, data: any) => {
    setStepData(prev => ({
      ...prev,
      [stepId]: data
    }));
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                {t('wizard.step')} {currentStep + 1} {t('wizard.of')} {steps.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Step Navigation */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 overflow-x-auto">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            const isAccessible = isCompleted || index <= currentStep;

            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                disabled={!isAccessible}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : isAccessible
                    ? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    : 'text-gray-400 cursor-not-allowed dark:text-gray-600'
                }`}
              >
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400'
                }`}>
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span>{step.title}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Step Content */}
      <div className="px-6 py-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {currentStepData.title}
          </h3>
          {currentStepData.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {currentStepData.description}
            </p>
          )}
          {currentStepData.estimatedTime && (
            <div className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              <Info className="h-3 w-3 mr-1" />
              {t('wizard.estimatedTime')}: {currentStepData.estimatedTime}
            </div>
          )}
        </div>

        {/* Tips */}
        {currentStepData.tips && currentStepData.tips.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              💡 {t('wizard.tips')}
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              {currentStepData.tips.map((tip, index) => (
                <li key={index}>• {tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {currentStepData.warnings && currentStepData.warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
              <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                {t('wizard.warnings')}
              </h4>
            </div>
            <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
              {currentStepData.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-sm text-red-800 dark:text-red-400">
                {validationError}
              </p>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="mb-6">
          {React.cloneElement(currentStepData.content as React.ReactElement, {
            stepData: stepData[currentStepData.id],
            updateStepData: (data: any) => updateStepData(currentStepData.id, data)
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex space-x-2">
          {allowBackNavigation && currentStep > 0 && (
            <button
              onClick={goToPreviousStep}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-500"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('wizard.previous')}
            </button>
          )}
          
          {currentStepData.canSkip && (
            <button
              onClick={skipCurrentStep}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {t('wizard.skip')}
            </button>
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {t('wizard.cancel')}
          </button>
          
          <button
            onClick={goToNextStep}
            disabled={isValidating}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('wizard.validating')}
              </>
            ) : isLastStep ? (
              t('wizard.complete')
            ) : (
              <>
                {t('wizard.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepWizard;