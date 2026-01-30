'use client';

import { LandingHeader } from './landing-header';
import { HeroSection } from './hero-section';
import { FeaturesSection } from './features-section';
import { AssetsSection } from './assets-section';
import { CTASection } from './cta-section';
import { LandingFooter } from './landing-footer';

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <AssetsSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}