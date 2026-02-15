'use client';

import { useState } from 'react';
import { Mail, Phone, Key, Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export type AuthMethod = 'email' | 'phone' | 'passkey';

export interface WalletlessAuthProps {
  onAuthSuccess?: (sessionToken: string) => void;
  onAuthError?: (error: string) => void;
  defaultMethod?: AuthMethod;
}

export function WalletlessAuth({ 
  onAuthSuccess, 
  onAuthError,
  defaultMethod = 'email' 
}: WalletlessAuthProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>(defaultMethod);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async () => {
    if (!identifier) {
      setError(`Please enter your ${authMethod === 'email' ? 'email address' : 'phone number'}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: authMethod,
          identifier,
          purpose: 'login'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setStep('verify');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to send verification code';
      setError(errorMsg);
      onAuthError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: authMethod,
          identifier,
          otp
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      onAuthSuccess?.(data.sessionToken);
    } catch (err: any) {
      const errorMsg = err.message || 'Verification failed';
      setError(errorMsg);
      onAuthError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request passkey challenge
      const challengeResponse = await fetch('/api/auth/passkey/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const challengeData = await challengeResponse.json();

      if (!challengeResponse.ok) {
        throw new Error(challengeData.error || 'Failed to get passkey challenge');
      }

      // Use WebAuthn API to authenticate
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0)),
          timeout: challengeData.timeout,
          userVerification: challengeData.userVerification,
          allowCredentials: challengeData.allowCredentials
        }
      });

      if (!credential) {
        throw new Error('Passkey authentication cancelled');
      }

      // Verify passkey response
      const verifyResponse = await fetch('/api/auth/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId))),
            response: {
              authenticatorData: btoa(String.fromCharCode(...new Uint8Array((credential as any).response.authenticatorData))),
              clientDataJSON: btoa(String.fromCharCode(...new Uint8Array((credential as any).response.clientDataJSON))),
              signature: btoa(String.fromCharCode(...new Uint8Array((credential as any).response.signature)))
            },
            type: 'public-key'
          }
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Passkey verification failed');
      }

      onAuthSuccess?.(verifyData.sessionToken);
    } catch (err: any) {
      const errorMsg = err.message || 'Passkey authentication failed';
      setError(errorMsg);
      onAuthError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('input');
    setOtp('');
    setError(null);
  };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-8 max-w-md w-full">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to Credit OS
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Sign in without a wallet
        </p>
      </div>

      {/* Auth Method Selection */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setAuthMethod('email')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
            authMethod === 'email'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          <Mail className="w-5 h-5 mx-auto mb-1" />
          <span className="text-sm font-medium">Email</span>
        </button>
        <button
          onClick={() => setAuthMethod('phone')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
            authMethod === 'phone'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          <Phone className="w-5 h-5 mx-auto mb-1" />
          <span className="text-sm font-medium">Phone</span>
        </button>
        <button
          onClick={() => setAuthMethod('passkey')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
            authMethod === 'passkey'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          <Key className="w-5 h-5 mx-auto mb-1" />
          <span className="text-sm font-medium">Passkey</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Email/Phone Auth */}
      {authMethod !== 'passkey' && (
        <>
          {step === 'input' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {authMethod === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <input
                  type={authMethod === 'email' ? 'email' : 'tel'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={authMethod === 'email' ? 'you@example.com' : '+1 (555) 000-0000'}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSendOTP}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Verification Code
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enter the 6-digit code sent to {identifier}
                </p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="000000"
                  maxLength={6}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </button>
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-2 transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </>
      )}

      {/* Passkey Auth */}
      {authMethod === 'passkey' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Use your device's biometric authentication or security key
          </p>
          <button
            onClick={handlePasskeyAuth}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Key className="w-5 h-5 mr-2" />
                Authenticate with Passkey
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No wallet required. Your account is secured by account abstraction.
        </p>
      </div>
    </div>
  );
}
