'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletlessAuth, OnboardingFlow } from '@/components/auth';

export default function LoginPage() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleAuthSuccess = (sessionToken: string) => {
    // Store session token
    if (typeof window !== 'undefined') {
      localStorage.setItem('session_token', sessionToken);
    }

    // Check if this is a new user
    // In production, this would be determined by the auth response
    if (isNewUser) {
      setShowOnboarding(true);
    } else {
      // Redirect to dashboard
      router.push('/dashboard');
    }
  };

  const handleAuthError = (error: string) => {
    console.error('Authentication error:', error);
  };

  const handleOnboardingComplete = () => {
    // Redirect to dashboard after onboarding
    router.push('/dashboard');
  };

  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center py-12 px-4">
      <WalletlessAuth
        onAuthSuccess={handleAuthSuccess}
        onAuthError={handleAuthError}
        defaultMethod="email"
      />
    </div>
  );
}
