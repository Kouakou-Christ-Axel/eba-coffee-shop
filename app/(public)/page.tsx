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
import { summarizeOpenDays, summarizeWeeklyHours } from '@/lib/pickup-settings';
import { listPublicTiktokVideos } from '@/lib/tiktok';
import { OG_IMAGE } from '@/config/constants';

// ISR: regenerate the homepage at most once per hour.
// Featured products change rarely, and the dashboard menu actions already
// call `revalidatePath('/')` on edits — so this is a freshness safety net.
export const revalidate = 3600;

const TITLE =
  'EBA Coffee Shop à Abidjan | Café, pâtisseries et brunch à Cocody';

// La mention d'ouverture est DÉRIVÉE des horaires en base, jamais écrite en
// dur : c'est un « Ouvert 7j/7 » figé qui avait fini par contredire les
// horaires réels (lundi fermé) — dans l'extrait Google comme face au
// `openingHoursSpecification` du JSON-LD. `getPickupSettings` est déjà mis en
// cache par React et appelé par la page elle-même : aucune requête de plus.
//
// Budget de longueur : la phrase d'ouverture est en FIN de description, donc
// c'est elle que Google tronquerait en premier. Garder le total sous ~155
// caractères — d'où une base volontairement courte. `summarizeOpenDays` reste
// borné sous 40 caractères (cf. `lib/pickup-settings.test.ts`).
export async function generateMetadata(): Promise<Metadata> {
  const pickup = await getPickupSettings();
  const openDays = summarizeOpenDays(pickup.weeklyHours);
  const description = [
    'EBA Coffee Shop, à Cocody, Abidjan : cafés de spécialité, pâtisseries artisanales, brunch et ambiance chaleureuse.',
    openDays && `${openDays}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...baseMetadata,
    description,
    openGraph: { ...baseMetadata.openGraph, description },
  };
}

const baseMetadata: Metadata = {
  title: TITLE,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: TITLE,
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
