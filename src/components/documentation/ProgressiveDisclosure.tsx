'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Lightbulb, AlertTriangle } from 'lucide-react';

export interface DisclosureSection {
  id: string;
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  content: React.ReactNode;
  prerequisites?: string[];
  estimatedTime?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  tips?: string[];
  warnings?: string[];
}

export interface ProgressiveDisclosureProps {
  title: string;
  description?: string;
  sections: DisclosureSection[];
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  autoExpand?: boolean;
  showLevelIndicators?: boolean;
  showProgress?: boolean;
  onSectionComplete?: (sectionId: string) => void;
}

export const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  title,
  description,
  sections,
  userLevel = 'beginner',
  autoExpand = false,
  showLevelIndicators = true,
  showProgress = true,
  onSectionComplete
}) => {
  const { t } = useTranslation('documentation');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [currentUserLevel, setCurrentUserLevel] = useState(userLevel);

  // Load completed sections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`progressive-disclosure-${title}`);
    if (saved) {
      const data = JSON.parse(saved);
      setCompletedSections(new Set(data.completed || []));
      setCurrentUserLevel(data.userLevel || userLevel);
    }
  }, [title, userLevel]);

  // Save progress to localStorage
  useEffect(() => {
    const data = {
      completed: Array.from(completedSections),
      userLevel: currentUserLevel
    };
    localStorage.setItem(`progressive-disclosure-${title}`, JSON.stringify(data));
  }, [completedSections, currentUserLevel, title]);

  // Auto-expand sections based on user level
  useEffect(() => {
    if (autoExpand) {
      const levelsToExpand = {
        beginner: ['beginner'],
        intermediate: ['beginner', 'intermediate'],
        advanced: ['beginner', 'intermediate', 'advanced']
      };

      const sectionsToExpand = sections
        .filter(section => levelsToExpand[currentUserLevel].includes(section.level))
        .map(section => section.id);

      setExpandedSections(new Set(sectionsToExpand));
    }
  }, [autoExpand, currentUserLevel, sections]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const markSectionComplete = (sectionId: string) => {
    const newCompleted = new Set(completedSections);
    newCompleted.add(sectionId);
    setCompletedSections(newCompleted);
    onSectionComplete?.(sectionId);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getDifficultyStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-xs ${i < difficulty ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
      >
        ★
      </span>
    ));
  };

  const getRelevantSections = () => {
    const levelOrder = { beginner: 1, intermediate: 2, advanced: 3 };
    const userLevelOrder = levelOrder[currentUserLevel];

    return sections.filter(section => {
      const sectionLevelOrder = levelOrder[section.level];
      return sectionLevelOrder <= userLevelOrder;
    });
  };

  const calculateProgress = () => {
    const relevantSections = getRelevantSections();
    if (relevantSections.length === 0) return 0;
    
    const completed = relevantSections.filter(section => 
      completedSections.has(section.id)
    ).length;
    
    return (completed / relevantSections.length) * 100;
  };

  const relevantSections = getRelevantSections();
  const progress = calculateProgress();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          
          {/* User Level Selector */}
          <div className="ml-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('disclosure.yourLevel')}
            </label>
            <select
              value={currentUserLevel}
              onChange={(e) => setCurrentUserLevel(e.target.value as any)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="beginner">{t('disclosure.beginner')}</option>
              <option value="intermediate">{t('disclosure.intermediate')}</option>
              <option value="advanced">{t('disclosure.advanced')}</option>
            </select>
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{t('disclosure.progress')}</span>
              <span>{Math.round(progress)}% {t('disclosure.complete')}</span>
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

      {/* Sections */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {relevantSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const isCompleted = completedSections.has(section.id);

          return (
            <div key={section.id} className="p-4">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className={`font-medium ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {section.title}
                      </h4>
                      {isCompleted && (
                        <span className="text-green-500">✓</span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 mt-1">
                      {showLevelIndicators && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(section.level)}`}>
                          {t(`disclosure.${section.level}`)}
                        </span>
                      )}
                      
                      {section.difficulty && (
                        <div className="flex items-center space-x-1">
                          {getDifficultyStars(section.difficulty)}
                        </div>
                      )}
                      
                      {section.estimatedTime && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {section.estimatedTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="mt-4 ml-8">
                  {/* Prerequisites */}
                  {section.prerequisites && section.prerequisites.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                        {t('disclosure.prerequisites')}
                      </h5>
                      <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                        {section.prerequisites.map((prereq, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{prereq}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Main Content */}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {section.content}
                  </div>

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                        <h5 className="text-sm font-medium text-green-900 dark:text-green-300">
                          {t('disclosure.tips')}
                        </h5>
                      </div>
                      <ul className="text-sm text-green-800 dark:text-green-400 space-y-1">
                        {section.tips.map((tip, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">💡</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {section.warnings && section.warnings.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-center mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
                        <h5 className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                          {t('disclosure.warnings')}
                        </h5>
                      </div>
                      <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
                        {section.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">⚠️</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mark Complete Button */}
                  {!isCompleted && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => markSectionComplete(section.id)}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        {t('disclosure.markComplete')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressiveDisclosure;