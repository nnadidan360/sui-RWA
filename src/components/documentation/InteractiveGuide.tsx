'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft, X, HelpCircle } from 'lucide-react';

export interface GuideStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    type: 'click' | 'input' | 'wait';
    element?: string;
    value?: string;
    duration?: number;
  };
  validation?: {
    type: 'element-exists' | 'value-equals' | 'custom';
    selector?: string;
    value?: string;
    validator?: () => boolean;
  };
}

export interface InteractiveGuideProps {
  guideId: string;
  title: string;
  description: string;
  steps: GuideStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  showProgress?: boolean;
}

export const InteractiveGuide: React.FC<InteractiveGuideProps> = ({
  guideId,
  title,
  description,
  steps,
  onComplete,
  onSkip,
  autoStart = false,
  showProgress = true
}) => {
  const { t } = useTranslation('documentation');
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  // Check if user has completed this guide before
  useEffect(() => {
    const completedGuides = JSON.parse(localStorage.getItem('completedGuides') || '[]');
    if (completedGuides.includes(guideId)) {
      setIsCompleted(true);
    }
  }, [guideId]);

  // Highlight target element
  useEffect(() => {
    if (!isActive || currentStep >= steps.length) return;

    const step = steps[currentStep];
    if (step.target) {
      const element = document.querySelector(step.target) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.classList.add('guide-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('guide-highlight');
      }
    };
  }, [isActive, currentStep, steps, highlightedElement]);

  const startGuide = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeGuide();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeGuide = () => {
    setIsActive(false);
    setIsCompleted(true);
    
    // Save completion status
    const completedGuides = JSON.parse(localStorage.getItem('completedGuides') || '[]');
    if (!completedGuides.includes(guideId)) {
      completedGuides.push(guideId);
      localStorage.setItem('completedGuides', JSON.stringify(completedGuides));
    }

    if (highlightedElement) {
      highlightedElement.classList.remove('guide-highlight');
    }

    onComplete?.();
  };

  const skipGuide = () => {
    setIsActive(false);
    if (highlightedElement) {
      highlightedElement.classList.remove('guide-highlight');
    }
    onSkip?.();
  };

  const validateStep = (step: GuideStep): boolean => {
    if (!step.validation) return true;

    switch (step.validation.type) {
      case 'element-exists':
        return !!document.querySelector(step.validation.selector || '');
      case 'value-equals':
        const element = document.querySelector(step.validation.selector || '') as HTMLInputElement;
        return element?.value === step.validation.value;
      case 'custom':
        return step.validation.validator?.() || false;
      default:
        return true;
    }
  };

  if (isCompleted && !isActive) {
    return (
      <div className="inline-flex items-center text-sm text-green-600 dark:text-green-400">
        <HelpCircle className="h-4 w-4 mr-1" />
        <button
          onClick={startGuide}
          className="hover:underline"
        >
          {t('guide.restart')}
        </button>
      </div>
    );
  }

  if (!isActive) {
    return (
      <button
        onClick={startGuide}
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        {t('guide.start')}
      </button>
    );
  }

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Guide Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {showProgress && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{t('guide.step', { current: currentStep + 1, total: steps.length })}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={skipGuide}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
              {currentStepData.title}
            </h4>
            <div
              className="text-sm text-gray-600 dark:text-gray-300 mb-4"
              dangerouslySetInnerHTML={{ __html: currentStepData.content }}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('guide.previous')}
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={skipGuide}
                  className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {t('guide.skip')}
                </button>
                <button
                  onClick={nextStep}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {currentStep === steps.length - 1 ? t('guide.finish') : t('guide.next')}
                  {currentStep < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for highlighting */}
      <style jsx global>{`
        .guide-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }
      `}</style>
    </>
  );
};

export default InteractiveGuide;