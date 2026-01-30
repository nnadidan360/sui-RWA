'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { X, HelpCircle, BookOpen, Play } from 'lucide-react';

export interface HelpContext {
  page: string;
  section?: string;
  action?: string;
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  hasCompletedAction?: boolean;
}

export interface ContextualHelpContent {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  triggers: {
    pages?: string[];
    sections?: string[];
    actions?: string[];
    conditions?: Array<{
      type: 'first-time' | 'error' | 'idle' | 'custom';
      value?: any;
      checker?: () => boolean;
    }>;
  };
  priority: number;
  dismissible: boolean;
  showOnce?: boolean;
  guideId?: string; // Link to interactive guide
}

export interface ContextualHelpProps {
  context: HelpContext;
  helpContent: ContextualHelpContent[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  maxWidth?: string;
  onHelpAction?: (action: string, contentId: string) => void;
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  context,
  helpContent,
  position = 'bottom-right',
  maxWidth = 'max-w-sm',
  onHelpAction
}) => {
  const { t } = useTranslation('documentation');
  const router = useRouter();
  const [activeHelp, setActiveHelp] = useState<ContextualHelpContent | null>(null);
  const [dismissedHelp, setDismissedHelp] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);

  // Load dismissed help from localStorage
  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem('dismissedHelp') || '[]');
    setDismissedHelp(new Set(dismissed));
  }, []);

  // Save dismissed help to localStorage
  const saveDismissedHelp = useCallback((helpIds: Set<string>) => {
    localStorage.setItem('dismissedHelp', JSON.stringify(Array.from(helpIds)));
  }, []);

  // Find relevant help content based on context
  const findRelevantHelp = useCallback(() => {
    const relevantHelp = helpContent
      .filter(help => {
        // Skip if already dismissed and should show only once
        if (help.showOnce && dismissedHelp.has(help.id)) {
          return false;
        }

        // Check page match
        if (help.triggers.pages && !help.triggers.pages.includes(context.page)) {
          return false;
        }

        // Check section match
        if (help.triggers.sections && context.section && !help.triggers.sections.includes(context.section)) {
          return false;
        }

        // Check action match
        if (help.triggers.actions && context.action && !help.triggers.actions.includes(context.action)) {
          return false;
        }

        // Check conditions
        if (help.triggers.conditions) {
          const conditionsMet = help.triggers.conditions.every(condition => {
            switch (condition.type) {
              case 'first-time':
                return !context.hasCompletedAction;
              case 'error':
                return context.action === 'error';
              case 'idle':
                // This would need to be implemented with a timer
                return false;
              case 'custom':
                return condition.checker ? condition.checker() : true;
              default:
                return true;
            }
          });
          if (!conditionsMet) return false;
        }

        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    return relevantHelp[0] || null;
  }, [context, helpContent, dismissedHelp]);

  // Update active help when context changes
  useEffect(() => {
    const relevantHelp = findRelevantHelp();
    if (relevantHelp && relevantHelp.id !== activeHelp?.id) {
      setActiveHelp(relevantHelp);
      setIsVisible(true);
    } else if (!relevantHelp && activeHelp) {
      setIsVisible(false);
      setTimeout(() => setActiveHelp(null), 300); // Delay to allow fade out
    }
  }, [context, findRelevantHelp, activeHelp]);

  const dismissHelp = (helpId: string, permanent: boolean = false) => {
    setIsVisible(false);
    
    if (permanent) {
      const newDismissed = new Set(dismissedHelp);
      newDismissed.add(helpId);
      setDismissedHelp(newDismissed);
      saveDismissedHelp(newDismissed);
    }

    setTimeout(() => setActiveHelp(null), 300);
    onHelpAction?.('dismiss', helpId);
  };

  const startGuide = (guideId: string) => {
    onHelpAction?.('start-guide', guideId);
    dismissHelp(activeHelp!.id);
  };

  const getPositionClasses = () => {
    const base = 'fixed z-50 transition-all duration-300 ease-in-out';
    switch (position) {
      case 'bottom-right':
        return `${base} bottom-4 right-4`;
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'center':
        return `${base} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
      default:
        return `${base} bottom-4 right-4`;
    }
  };

  if (!activeHelp) return null;

  return (
    <div
      className={`${getPositionClasses()} ${maxWidth} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              {activeHelp.title}
            </h3>
          </div>
          <button
            onClick={() => dismissHelp(activeHelp.id)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {activeHelp.description}
          </p>
          
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {activeHelp.content}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            {activeHelp.guideId && (
              <button
                onClick={() => startGuide(activeHelp.guideId!)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Play className="h-3 w-3 mr-1" />
                {t('contextualHelp.startGuide')}
              </button>
            )}
            
            <button
              onClick={() => router.push('/help')}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-500"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              {t('contextualHelp.learnMore')}
            </button>
          </div>

          <div className="flex space-x-2">
            {activeHelp.dismissible && (
              <>
                <button
                  onClick={() => dismissHelp(activeHelp.id, false)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {t('contextualHelp.dismiss')}
                </button>
                <button
                  onClick={() => dismissHelp(activeHelp.id, true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {t('contextualHelp.dontShowAgain')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for managing contextual help
export const useContextualHelp = () => {
  const [context, setContext] = useState<HelpContext>({
    page: '',
    userLevel: 'beginner'
  });

  const updateContext = useCallback((newContext: Partial<HelpContext>) => {
    setContext(prev => ({ ...prev, ...newContext }));
  }, []);

  const trackAction = useCallback((action: string) => {
    setContext(prev => ({ ...prev, action, hasCompletedAction: true }));
  }, []);

  const trackPageVisit = useCallback((page: string, section?: string) => {
    setContext(prev => ({ ...prev, page, section, action: undefined }));
  }, []);

  return {
    context,
    updateContext,
    trackAction,
    trackPageVisit
  };
};

export default ContextualHelp;