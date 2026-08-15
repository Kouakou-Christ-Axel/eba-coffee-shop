import { Suspense } from 'react';
import type { Metadata } from 'next';

import HeroSection from '@/components/(public)/accueil/hero-section';
import QuickTrustSection from '@/components/(public)/accueil/quick-trust-section';
import IncontournablesSection from '@/components/(public)/accueil/incontournables-section';
import IncontournablesSkeleton from '@/components/(public)/accueil/incontournables-skeleton';
import UniversEbaSection from '@/components/(public)/accueil/univers-eba-section';
import PlaceSection from '@/components/(public)/accueil/place-section';
import SocialSection from '@/components/(public)/accueil/social-section';
import FindUsSection from '@/components/(public)/accueil/find-us-section';
import { getContactSettings } from '@/lib/contact-settings-db';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { summarizeWeeklyHours } from '@/lib/pickup-settings';
import { listPublicTiktokVideos } from '@/lib/tiktok';
import { OG_IMAGE } from '@/config/constants';

// ISR: regenerate the homepage at most once per hour.
// Featured products change rarely, and the dashboard menu actions already
// call `revalidatePath('/')` on edits — so this is a freshness safety net.
export const revalidate = 3600;

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
  openGraph: {
    title: 'EBA Coffee Shop à Abidjan | Café, pâtisseries et brunch à Cocody',
    description:
      'EBA Coffee Shop : votre coffee shop à Cocody, Abidjan. Cafés de spécialité, pâtisseries artisanales, brunch et ambiance chaleureuse. Ouvert 7j/7.',
    url: '/',
    images: [OG_IMAGE],
  },
};

export default async function HomePage() {
  const [contact, pickup, tiktokVideos] = await Promise.all([
    getContactSettings(),
    getPickupSettings(),
    listPublicTiktokVideos(),
  ]);
  const hoursLabel = summarizeWeeklyHours(pickup.weeklyHours);
  return (
    <>
      <HeroSection />
      <QuickTrustSection />
      <Suspense fallback={<IncontournablesSkeleton />}>
        <IncontournablesSection />
      </Suspense>
      <UniversEbaSection />
      <PlaceSection />
      <FindUsSection contact={contact} hoursLabel={hoursLabel} />
      <SocialSection contact={contact} tiktokVideos={tiktokVideos} />
    </>
  );
}
