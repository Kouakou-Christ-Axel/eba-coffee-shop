import type { Metadata } from 'next';
import HeroSection from '@/components/(public)/le-lieu/hero-section';
import AmbianceGallerySection from '@/components/(public)/le-lieu/ambiance-gallery-section';
import ExperienceSection from '@/components/(public)/le-lieu/experience-section';
import DetailsSection from '@/components/(public)/le-lieu/details-section';
import WhyComeSection from '@/components/(public)/le-lieu/why-come-section';
import PracticalLocationSection from '@/components/(public)/le-lieu/practical-location-section';
import FinalCtaSection from '@/components/(public)/le-lieu/final-cta-section';
import React from 'react';

export const metadata: Metadata = {
  title: 'Le lieu — Votre coffee shop à Cocody',
  description:
    'Visitez EBA Coffee Shop à Cocody, Abidjan : un espace chaleureux et soigné pour savourer café de spécialité, pâtisseries artisanales et brunch. Ouvert 7j/7.',
  alternates: {
    canonical: '/le-lieu',
  },
};

function LeLieuPage() {
  return (
    <>
      <HeroSection />
      <AmbianceGallerySection />
      <ExperienceSection />
      <DetailsSection />
      <WhyComeSection />
      <PracticalLocationSection />
      <FinalCtaSection />
    </>
  );
}

export default LeLieuPage;
