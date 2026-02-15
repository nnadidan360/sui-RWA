'use client';

import { useState } from 'react';
import { Check, ChevronRight, Shield, User, Smartphone, CheckCircle } from 'lucide-react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface OnboardingFlowProps {
  onComplete?: () => void;
  initialStep?: number;
}

export function OnboardingFlow({ onComplete, initialStep = 0 }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to Credit OS',
      description: 'Get started with walletless credit access',
      completed: false
    },
    {
      id: 'account',
      title: 'Create Your Account',
      description: 'Set up your account abstraction profile',
      completed: false
    },
    {
      id: 'device',
      title: 'Register Your Device',
      description: 'Secure your account with device binding',
      completed: false
    },
    {
      id: 'recovery',
      title: 'Set Up Recovery',
      description: 'Configure account recovery options',
      completed: false
    },
    {
      id: 'complete',
      title: 'All Set!',
      description: 'Your account is ready to use',
      completed: false
    }
  ]);

  const handleNext = () => {
    const updatedSteps = [...steps];
    updatedSteps[currentStep].completed = true;
    setSteps(updatedSteps);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                Welcome to Credit OS
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Access credit without traditional wallets or private keys
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                What you'll get:
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Walletless authentication with email, phone, or passkey
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Gas-free transactions with sponsored fees
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Secure account recovery without private keys
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Access to RWA and crypto credit lines
                  </span>
                </li>
              </ul>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Create Your Account
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your account is secured by Sui blockchain
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Account Abstraction</span>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Policy-Based Controls</span>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Session Authorization</span>
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Your UserAccountObject is being created on Sui blockchain
            </p>
          </div>
        );

      case 'device':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Register Your Device
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Secure your account with device fingerprinting
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Device Security Features:
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-3 mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Device Binding</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your device is cryptographically linked to your account
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-3 mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Fraud Prevention</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Multi-layered fraud detection protects your account
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mr-3 mt-2"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Geo Validation</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Location consistency checks for added security
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        );

      case 'recovery':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Set Up Recovery
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Configure how you'll recover your account if needed
              </p>
            </div>
            <div className="space-y-3">
              <div className="p-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">Email Recovery</span>
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Recover your account using your verified email address
                </p>
              </div>
              <div className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">Device Recovery</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Optional</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use another registered device to recover access
                </p>
              </div>
              <div className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">Guardian Recovery</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Optional</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Designate trusted contacts to help recover your account
                </p>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                You're All Set!
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Your Credit OS account is ready to use
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                What's next?
              </h3>
              <ul className="space-y-2 text-left">
                <li className="flex items-start">
                  <ChevronRight className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Upload RWA documents to qualify for credit
                  </span>
                </li>
                <li className="flex items-start">
                  <ChevronRight className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Deposit crypto for instant credit lines
                  </span>
                </li>
                <li className="flex items-start">
                  <ChevronRight className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    Explore withdrawal options and incentives
                  </span>
                </li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : index === currentStep
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}
                >
                  {step.completed ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center hidden sm:block">
                  {step.title.split(' ')[0]}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-all ${
                    step.completed
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <button
            onClick={handleSkip}
            className="flex-1 py-3 px-6 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Skip
          </button>
        )}
        <button
          onClick={handleNext}
          className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center"
        >
          {currentStep === steps.length - 1 ? (
            'Get Started'
          ) : (
            <>
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
