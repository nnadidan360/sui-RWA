/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Xylor Finance inspired color palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          purple: {
            500: '#8b5cf6',
            600: '#7c3aed',
            700: '#6d28d9',
          },
          pink: {
            500: '#ec4899',
            600: '#db2777',
            700: '#be185d',
          },
          cyan: {
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
          }
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Dark theme specific colors
        gray: {
          850: '#1a202c',
          950: '#0d1117',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-x': 'gradient-x 15s ease infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            'box-shadow': '0 0 5px currentColor'
          },
          '50%': {
            opacity: '0.5',
            'box-shadow': '0 0 20px currentColor'
          },
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.3)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.4)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.5)',
        'purple-glow': '0 0 20px rgba(147, 51, 234, 0.4)',
        'green-glow': '0 0 20px rgba(34, 197, 94, 0.4)',
      },
      // RTL support utilities
      spacing: {
        'rtl-0': 'var(--spacing-rtl-0, 0)',
        'rtl-1': 'var(--spacing-rtl-1, 0.25rem)',
        'rtl-2': 'var(--spacing-rtl-2, 0.5rem)',
        'rtl-3': 'var(--spacing-rtl-3, 0.75rem)',
        'rtl-4': 'var(--spacing-rtl-4, 1rem)',
      }
    },
  },
  plugins: [
    // RTL support plugin
    function({ addUtilities, addBase }) {
      addBase({
        '[dir="rtl"]': {
          '--spacing-rtl-0': '0',
          '--spacing-rtl-1': '0.25rem',
          '--spacing-rtl-2': '0.5rem',
          '--spacing-rtl-3': '0.75rem',
          '--spacing-rtl-4': '1rem',
        },
        '[dir="ltr"]': {
          '--spacing-rtl-0': '0',
          '--spacing-rtl-1': '0.25rem',
          '--spacing-rtl-2': '0.5rem',
          '--spacing-rtl-3': '0.75rem',
          '--spacing-rtl-4': '1rem',
        }
      });
      
      addUtilities({
        '.rtl\\:text-right': {
          '[dir="rtl"] &': {
            'text-align': 'right'
          }
        },
        '.rtl\\:text-left': {
          '[dir="rtl"] &': {
            'text-align': 'left'
          }
        },
        '.rtl\\:ml-auto': {
          '[dir="rtl"] &': {
            'margin-left': 'auto'
          }
        },
        '.rtl\\:mr-auto': {
          '[dir="rtl"] &': {
            'margin-right': 'auto'
          }
        },
        '.rtl\\:flex-row-reverse': {
          '[dir="rtl"] &': {
            'flex-direction': 'row-reverse'
          }
        }
      });
    }
  ],
};