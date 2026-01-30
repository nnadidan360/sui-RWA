import { Metadata } from 'next';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StakingOverview } from '@/components/staking/staking-overview';

export const metadata: Metadata = {
  title: 'Liquid Staking - Astake',
  description: 'Stake your CSPR tokens while maintaining liquidity through derivative tokens',
};

export default function StakingPage() {
  return (
    <DashboardLayout>
      <StakingOverview />
    </DashboardLayout>
  );
}