import { Metadata } from 'next';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AssetsOverview } from '@/components/assets/assets-overview';

export const metadata: Metadata = {
  title: 'Assets - Astake',
  description: 'Tokenize and manage your real-world assets',
};

export default function AssetsPage() {
  return (
    <DashboardLayout>
      <AssetsOverview />
    </DashboardLayout>
  );
}