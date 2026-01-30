'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Info, AlertTriangle } from 'lucide-react';

export interface TooltipContent {
  title?: string;
  description: string;
  links?: Array<{
    text: string;
    url: string;
    external?: boolean;
  }>;
  type?: 'info' | 'warning' | 'help';
}

export interface HelpTooltipProps {
  content: TooltipContent | string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  trigger?: 'hover' | 'click';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  position = 'auto',
  trigger = 'hover',
  size = 'md',
  className = '',
  iconClassName = '',
  disabled = false
}) => {
  const { t } = useTranslation('documentation');
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const tooltipContent = typeof content === 'string' 
    ? { description: content, type: 'info' as const }
    : content;

  // Calculate optimal position
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current || position !== 'auto') return;

    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let optimalPosition = 'top';

    // Check if tooltip fits above
    if (triggerRect.top - tooltipRect.height - 8 >= 0) {
      optimalPosition = 'top';
    }
    // Check if tooltip fits below
    else if (triggerRect.bottom + tooltipRect.height + 8 <= viewport.height) {
      optimalPosition = 'bottom';
    }
    // Check if tooltip fits to the right
    else if (triggerRect.right + tooltipRect.width + 8 <= viewport.width) {
      optimalPosition = 'right';
    }
    // Check if tooltip fits to the left
    else if (triggerRect.left - tooltipRect.width - 8 >= 0) {
      optimalPosition = 'left';
    }
    // Default to bottom if nothing else fits
    else {
      optimalPosition = 'bottom';
    }

    setActualPosition(optimalPosition as any);
  }, [isVisible, position]);

  const handleMouseEnter = () => {
    if (trigger === 'hover' && !disabled) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsVisible(false);
    }
  };

  const handleClick = () => {
    if (trigger === 'click' && !disabled) {
      setIsVisible(!isVisible);
    }
  };

  // Close on outside click for click trigger
  useEffect(() => {
    if (trigger !== 'click' || !isVisible) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [trigger, isVisible]);

  const getIcon = () => {
    switch (tooltipContent.type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      case 'help':
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getIconColor = () => {
    switch (tooltipContent.type) {
      case 'warning':
        return 'text-yellow-500 hover:text-yellow-600';
      case 'info':
        return 'text-blue-500 hover:text-blue-600';
      case 'help':
      default:
        return 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-xs text-xs';
      case 'lg':
        return 'max-w-md text-sm';
      case 'md':
      default:
        return 'max-w-sm text-sm';
    }
  };

  const getPositionClasses = () => {
    const base = 'absolute z-50';
    switch (actualPosition) {
      case 'top':
        return `${base} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${base} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${base} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${base} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${base} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const base = 'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45';
    switch (actualPosition) {
      case 'top':
        return `${base} top-full left-1/2 -translate-x-1/2 -mt-1`;
      case 'bottom':
        return `${base} bottom-full left-1/2 -translate-x-1/2 -mb-1`;
      case 'left':
        return `${base} left-full top-1/2 -translate-y-1/2 -ml-1`;
      case 'right':
        return `${base} right-full top-1/2 -translate-y-1/2 -mr-1`;
      default:
        return `${base} top-full left-1/2 -translate-x-1/2 -mt-1`;
    }
  };

  if (disabled) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex items-center ${getIconColor()} transition-colors ${iconClassName}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={t('tooltip.help')}
      >
        {getIcon()}
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`${getPositionClasses()} ${getSizeClasses()}`}
          role="tooltip"
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-lg p-3">
            {tooltipContent.title && (
              <div className="font-semibold mb-1">
                {tooltipContent.title}
              </div>
            )}
            <div className="text-gray-200 dark:text-gray-300">
              {tooltipContent.description}
            </div>
            {tooltipContent.links && tooltipContent.links.length > 0 && (
              <div className="mt-2 space-y-1">
                {tooltipContent.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="block text-blue-300 hover:text-blue-200 underline text-xs"
                  >
                    {link.text}
                    {link.external && ' ↗'}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className={getArrowClasses()} />
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;