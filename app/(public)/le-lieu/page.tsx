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
import { summarizeWeeklyHours } from '@/lib/pickup-settings';

export const metadata: Metadata = {
  title: 'Le lieu — Votre coffee shop à Cocody',
  description:
    'Visitez EBA Coffee Shop à Cocody, Abidjan : un espace chaleureux et soigné pour savourer café de spécialité, pâtisseries artisanales et brunch. Ouvert 7j/7.',
  alternates: {
    canonical: '/le-lieu',
  },
  openGraph: {
    title: 'Le lieu — Votre coffee shop à Cocody',
    description:
      'Visitez EBA Coffee Shop à Cocody, Abidjan : un espace chaleureux et soigné pour savourer café de spécialité, pâtisseries artisanales et brunch. Ouvert 7j/7.',
    url: '/le-lieu',
    images: [
      {
        url: '/assets/examples/accueil/eba-hero.webp',
        width: 800,
        height: 449,
        alt: 'Le lieu — EBA Coffee Shop',
      },
    ],
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
