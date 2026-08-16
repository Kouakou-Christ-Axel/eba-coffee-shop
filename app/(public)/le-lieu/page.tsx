import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
import HeroSection from '@/components/(public)/le-lieu/hero-section';
import AmbianceGallerySection from '@/components/(public)/le-lieu/ambiance-gallery-section';
import ExperienceSection from '@/components/(public)/le-lieu/experience-section';
import DetailsSection from '@/components/(public)/le-lieu/details-section';
import WhyComeSection from '@/components/(public)/le-lieu/why-come-section';
import PracticalLocationSection from '@/components/(public)/le-lieu/practical-location-section';
import FinalCtaSection from '@/components/(public)/le-lieu/final-cta-section';
import React from 'react';
import { getContactSettings } from '@/lib/contact-settings-db';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { summarizeOpenDays, summarizeWeeklyHours } from '@/lib/pickup-settings';
import { OG_IMAGE } from '@/config/constants';

const TITLE = 'Le lieu — Votre coffee shop à Cocody';

// Mention d'ouverture dérivée des horaires en base — cf. le commentaire de
// `app/(public)/page.tsx`, même raison et même coût nul en requêtes.
export async function generateMetadata(): Promise<Metadata> {
  const pickup = await getPickupSettings();
  const openDays = summarizeOpenDays(pickup.weeklyHours);
  const description = [
    'Visitez EBA Coffee Shop à Cocody, Abidjan : un espace chaleureux pour savourer café de spécialité, pâtisseries et brunch.',
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
    canonical: '/le-lieu',
  },
  openGraph: {
    title: TITLE,
    url: '/le-lieu',
    images: [{ ...OG_IMAGE, alt: 'Le lieu — EBA Coffee Shop' }],
  },
};

async function LeLieuPage() {
  const [contact, pickup] = await Promise.all([
    getContactSettings(),
    getPickupSettings(),
  ]);
  const hoursLabel = summarizeWeeklyHours(pickup.weeklyHours);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Le lieu', path: '/le-lieu' }]} />
      <HeroSection />
      <AmbianceGallerySection />
      <ExperienceSection />
      <DetailsSection />
      <WhyComeSection />
      <PracticalLocationSection contact={contact} hoursLabel={hoursLabel} />
      <FinalCtaSection contact={contact} />
    </>
  );
}

export default LeLieuPage;
