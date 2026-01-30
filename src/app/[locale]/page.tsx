import { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'RWA Protocol - Unlock Your Assets Without Selling',
  description: 'Borrow against your crypto and real-world assets with lightning-fast transactions on Sui blockchain. No credit checks, no hidden fees, just instant liquidity.',
};

export default function HomePage() {
  return <LandingPage />;
}