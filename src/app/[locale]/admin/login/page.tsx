import { Metadata } from 'next';
import { AdminLogin } from '@/components/admin/admin-login';

// Force dynamic rendering for admin login
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Login - Astake',
  description: 'Administrative login for platform management',
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <AdminLogin />
      </div>
    </div>
  );
}