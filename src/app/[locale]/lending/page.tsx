import { Metadata } from 'next';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LendingOverview } from '@/components/lending/lending-overview';

export const metadata: Metadata = {
  title: 'Lending - Astake',
  description: 'Borrow against your tokenized assets and provide liquidity to earn interest',
};

export default function LendingPage() {
  return (
    <DashboardLayout>
      <LendingOverview />
    </DashboardLayout>
  );
}