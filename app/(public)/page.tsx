import type { Metadata } from 'next';

import HeroSection from '@/components/(public)/accueil/hero-section';
import QuickTrustSection from '@/components/(public)/accueil/quick-trust-section';
import IncontournablesSection from '@/components/(public)/accueil/incontournables-section';
import UniversEbaSection from '@/components/(public)/accueil/univers-eba-section';
import PlaceSection from '@/components/(public)/accueil/place-section';
import SocialSection from '@/components/(public)/accueil/social-section';
import FindUsSection from '@/components/(public)/accueil/find-us-section';

export const metadata: Metadata = {
  title: 'EBA Coffee Shop à Abidjan | Café, pâtisseries et brunch à Cocody',
  description:
    'EBA Coffee Shop : votre coffee shop à Cocody, Abidjan. Cafés de spécialité, pâtisseries artisanales, brunch et ambiance chaleureuse. Ouvert 7j/7.',
  keywords: [
    'coffee shop abidjan',
    'café abidjan',
    'pâtisserie abidjan',
    'brunch abidjan',
    'coffee shop cocody',
    'café cocody',
    'EBA coffee shop',
    'meilleur café abidjan',
  ],
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <QuickTrustSection />
      <IncontournablesSection />
      <UniversEbaSection />
      <PlaceSection />
      <FindUsSection />
      <SocialSection />
    </>
  );
}
