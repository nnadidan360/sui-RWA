'use client';

import { useTranslations } from 'next-intl';

export function AdminDashboard() {
  const t = useTranslations('admin');

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Administrative dashboard for managing the RWA lending platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('users')}
          </h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('assets')}
          </h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">0</p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('loans')}
          </h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">0</p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Total Value
          </h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">$0</p>
        </div>
      </div>
    </div>
  );
}