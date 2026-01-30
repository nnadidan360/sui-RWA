import { Metadata } from 'next';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Astake',
  description: 'Administrative dashboard for risk management and platform monitoring',
};

export default function AdminPage() {
  return (
    <DashboardLayout>
      <AdminDashboard />
    </DashboardLayout>
  );
}