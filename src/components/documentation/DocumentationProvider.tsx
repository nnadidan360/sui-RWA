'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { InteractiveGuide, GuideStep } from './InteractiveGuide';
import { ContextualHelp, HelpContext, ContextualHelpContent, useContextualHelp } from './ContextualHelp';

export interface DocumentationConfig {
  guides: Record<string, {
    title: string;
    description: string;
    steps: GuideStep[];
    autoStart?: boolean;
  }>;
  contextualHelp: ContextualHelpContent[];
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  enableContextualHelp: boolean;
  enableInteractiveGuides: boolean;
}

interface DocumentationContextType {
  config: DocumentationConfig;
  updateConfig: (config: Partial<DocumentationConfig>) => void;
  startGuide: (guideId: string) => void;
  activeGuide: string | null;
  setActiveGuide: (guideId: string | null) => void;
  trackUserAction: (action: string, context?: any) => void;
  setUserLevel: (level: 'beginner' | 'intermediate' | 'advanced') => void;
}

const DocumentationContext = createContext<DocumentationContextType | null>(null);

export const useDocumentation = () => {
  const context = useContext(DocumentationContext);
  if (!context) {
    throw new Error('useDocumentation must be used within a DocumentationProvider');
  }
  return context;
};

interface DocumentationProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<DocumentationConfig>;
}

export const DocumentationProvider: React.FC<DocumentationProviderProps> = ({
  children,
  initialConfig = {}
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { context, updateContext, trackAction, trackPageVisit } = useContextualHelp();

  const [config, setConfig] = useState<DocumentationConfig>({
    guides: {},
    contextualHelp: [],
    userLevel: 'beginner',
    enableContextualHelp: true,
    enableInteractiveGuides: true,
    ...initialConfig
  });

  const [activeGuide, setActiveGuide] = useState<string | null>(null);

  // Track page visits for contextual help
  useEffect(() => {
    const page = pathname.split('/')[1] || 'dashboard';
    const section = pathname.split('/')[2];
    trackPageVisit(page, section);
  }, [pathname, trackPageVisit]);

  // Load user preferences
  useEffect(() => {
    const savedPrefs = localStorage.getItem('documentation-preferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      setConfig(prev => ({ ...prev, ...prefs }));
      updateContext({ userLevel: prefs.userLevel });
    }
  }, [updateContext]);

  const updateConfig = useCallback((newConfig: Partial<DocumentationConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      
      // Save user preferences
      const prefsToSave = {
        userLevel: updated.userLevel,
        enableContextualHelp: updated.enableContextualHelp,
        enableInteractiveGuides: updated.enableInteractiveGuides
      };
      localStorage.setItem('documentation-preferences', JSON.stringify(prefsToSave));
      
      return updated;
    });

    if (newConfig.userLevel) {
      updateContext({ userLevel: newConfig.userLevel });
    }
  }, [updateContext]);

  const startGuide = useCallback((guideId: string) => {
    if (config.guides[guideId]) {
      setActiveGuide(guideId);
    }
  }, [config.guides]);

  const trackUserAction = useCallback((action: string, actionContext?: any) => {
    trackAction(action);
    
    // Log user actions for analytics (if needed)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'documentation_action', {
        action_type: action,
        context: actionContext,
        user_level: config.userLevel
      });
    }
  }, [trackAction, config.userLevel]);

  const setUserLevel = useCallback((level: 'beginner' | 'intermediate' | 'advanced') => {
    updateConfig({ userLevel: level });
  }, [updateConfig]);

  const handleGuideComplete = useCallback((guideId: string) => {
    setActiveGuide(null);
    trackUserAction('guide_completed', { guideId });
  }, [trackUserAction]);

  const handleGuideSkip = useCallback((guideId: string) => {
    setActiveGuide(null);
    trackUserAction('guide_skipped', { guideId });
  }, [trackUserAction]);

  const handleHelpAction = useCallback((action: string, contentId: string) => {
    if (action === 'start-guide') {
      startGuide(contentId);
    }
    trackUserAction(`contextual_help_${action}`, { contentId });
  }, [startGuide, trackUserAction]);

  const contextValue: DocumentationContextType = {
    config,
    updateConfig,
    startGuide,
    activeGuide,
    setActiveGuide,
    trackUserAction,
    setUserLevel
  };

  return (
    <DocumentationContext.Provider value={contextValue}>
      {children}
      
      {/* Interactive Guide */}
      {config.enableInteractiveGuides && activeGuide && config.guides[activeGuide] && (
        <InteractiveGuide
          guideId={activeGuide}
          title={config.guides[activeGuide].title}
          description={config.guides[activeGuide].description}
          steps={config.guides[activeGuide].steps}
          onComplete={() => handleGuideComplete(activeGuide)}
          onSkip={() => handleGuideSkip(activeGuide)}
          autoStart={true}
          showProgress={true}
        />
      )}

      {/* Contextual Help */}
      {config.enableContextualHelp && (
        <ContextualHelp
          context={context}
          helpContent={config.contextualHelp}
          onHelpAction={handleHelpAction}
        />
      )}
    </DocumentationContext.Provider>
  );
};

// Predefined guides for common workflows
export const defaultGuides = {
  'asset-tokenization': {
    title: 'Asset Tokenization Guide',
    description: 'Learn how to tokenize your real-world assets step by step',
    steps: [
      {
        id: 'connect-wallet',
        title: 'Connect Your Wallet',
        content: 'First, you need to connect your Casper wallet to the platform. Click the "Connect Wallet" button in the top right corner.',
        target: '[data-testid="connect-wallet-button"]',
        validation: {
          type: 'element-exists',
          selector: '[data-testid="wallet-connected"]'
        }
      },
      {
        id: 'complete-kyc',
        title: 'Complete KYC Verification',
        content: 'Before tokenizing assets, you must complete KYC verification. Navigate to your profile and upload the required documents.',
        target: '[data-testid="kyc-section"]'
      },
      {
        id: 'prepare-documents',
        title: 'Prepare Asset Documents',
        content: 'Gather all necessary documents for your asset: property deed, appraisal, insurance, etc. Ensure all documents are clear and up-to-date.',
        target: '[data-testid="document-upload"]'
      },
      {
        id: 'submit-asset',
        title: 'Submit Asset for Tokenization',
        content: 'Fill out the asset information form and upload your documents. Our verification team will review your submission.',
        target: '[data-testid="asset-form"]'
      },
      {
        id: 'await-approval',
        title: 'Wait for Approval',
        content: 'Your asset is now under review. You\'ll receive notifications about the progress. This typically takes 3-5 business days.',
        target: '[data-testid="approval-status"]'
      }
    ]
  },
  'lending-basics': {
    title: 'Lending Basics',
    description: 'Learn how to lend and borrow on the platform',
    steps: [
      {
        id: 'understand-pools',
        title: 'Understand Lending Pools',
        content: 'Lending pools aggregate funds from multiple lenders. When you deposit, you receive pool tokens representing your share.',
        target: '[data-testid="lending-pools"]'
      },
      {
        id: 'choose-pool',
        title: 'Choose a Pool',
        content: 'Compare different pools by APY, utilization rate, and risk level. Start with stablecoin pools for lower risk.',
        target: '[data-testid="pool-selection"]'
      },
      {
        id: 'make-deposit',
        title: 'Make Your First Deposit',
        content: 'Enter the amount you want to lend and confirm the transaction. You\'ll receive pool tokens immediately.',
        target: '[data-testid="deposit-form"]'
      },
      {
        id: 'monitor-earnings',
        title: 'Monitor Your Earnings',
        content: 'Track your earnings in the dashboard. Interest compounds automatically and is reflected in your pool token value.',
        target: '[data-testid="earnings-display"]'
      }
    ]
  },
  'staking-guide': {
    title: 'Liquid Staking Guide',
    description: 'Learn how to stake CSPR tokens while maintaining liquidity',
    steps: [
      {
        id: 'understand-liquid-staking',
        title: 'Understand Liquid Staking',
        content: 'Liquid staking lets you earn staking rewards while receiving tradeable stCSPR tokens that represent your staked position.',
        target: '[data-testid="staking-explanation"]'
      },
      {
        id: 'check-requirements',
        title: 'Check Requirements',
        content: 'Ensure you have at least 100 CSPR tokens and some extra for transaction fees.',
        target: '[data-testid="staking-requirements"]'
      },
      {
        id: 'stake-tokens',
        title: 'Stake Your CSPR',
        content: 'Enter the amount to stake and confirm. You\'ll receive stCSPR tokens that increase in value as rewards accumulate.',
        target: '[data-testid="staking-form"]'
      },
      {
        id: 'use-staked-tokens',
        title: 'Use Your stCSPR',
        content: 'Your stCSPR tokens can be used as collateral for loans or traded while still earning staking rewards.',
        target: '[data-testid="stcspr-utilities"]'
      }
    ]
  }
};

// Predefined contextual help content
export const defaultContextualHelp: ContextualHelpContent[] = [
  {
    id: 'first-time-dashboard',
    title: 'Welcome to RWA Lending!',
    description: 'This is your dashboard where you can manage all your DeFi activities.',
    content: (
      <div>
        <p>Here you can:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>View your portfolio summary</li>
          <li>Access tokenization, lending, and staking features</li>
          <li>Monitor your positions and earnings</li>
          <li>Track transaction history</li>
        </ul>
      </div>
    ),
    triggers: {
      pages: ['dashboard'],
      conditions: [{ type: 'first-time' }]
    },
    priority: 10,
    dismissible: true,
    showOnce: true,
    guideId: 'platform-overview'
  },
  {
    id: 'wallet-not-connected',
    title: 'Connect Your Wallet',
    description: 'You need to connect a wallet to use the platform features.',
    content: (
      <div>
        <p>Click the "Connect Wallet" button to get started. We support:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Casper Wallet (browser extension)</li>
          <li>Casper Signer (desktop app)</li>
          <li>Ledger hardware wallets</li>
        </ul>
      </div>
    ),
    triggers: {
      conditions: [{ 
        type: 'custom',
        checker: () => typeof window !== 'undefined' && !localStorage.getItem('wallet-connected')
      }]
    },
    priority: 9,
    dismissible: true
  },
  {
    id: 'first-asset-tokenization',
    title: 'Ready to Tokenize Your First Asset?',
    description: 'Let us guide you through the asset tokenization process.',
    content: (
      <div>
        <p>Tokenizing assets involves several steps:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Document preparation</li>
          <li>Asset verification</li>
          <li>Professional appraisal</li>
          <li>Token minting</li>
        </ul>
      </div>
    ),
    triggers: {
      pages: ['assets'],
      sections: ['tokenize'],
      conditions: [{ type: 'first-time' }]
    },
    priority: 8,
    dismissible: true,
    guideId: 'asset-tokenization'
  },
  {
    id: 'lending-pool-explanation',
    title: 'Understanding Lending Pools',
    description: 'New to DeFi lending? Let us explain how it works.',
    content: (
      <div>
        <p>Lending pools are smart contracts that:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Aggregate funds from multiple lenders</li>
          <li>Provide liquidity to borrowers</li>
          <li>Distribute interest proportionally</li>
          <li>Adjust rates based on supply and demand</li>
        </ul>
      </div>
    ),
    triggers: {
      pages: ['lending'],
      conditions: [{ type: 'first-time' }]
    },
    priority: 7,
    dismissible: true,
    guideId: 'lending-basics'
  },
  {
    id: 'staking-benefits',
    title: 'Why Choose Liquid Staking?',
    description: 'Liquid staking offers the best of both worlds.',
    content: (
      <div>
        <p>Benefits of liquid staking:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Earn staking rewards (typically 8-12% APY)</li>
          <li>Maintain liquidity with stCSPR tokens</li>
          <li>Use staked tokens as collateral</li>
          <li>No minimum unbonding period</li>
        </ul>
      </div>
    ),
    triggers: {
      pages: ['staking'],
      conditions: [{ type: 'first-time' }]
    },
    priority: 6,
    dismissible: true,
    guideId: 'staking-guide'
  }
];

export default DocumentationProvider;