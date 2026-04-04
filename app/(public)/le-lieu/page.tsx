import HeroSection from '@/components/(public)/le-lieu/hero-section';
import AmbianceGallerySection from '@/components/(public)/le-lieu/ambiance-gallery-section';
import ExperienceSection from '@/components/(public)/le-lieu/experience-section';
import DetailsSection from '@/components/(public)/le-lieu/details-section';
import WhyComeSection from '@/components/(public)/le-lieu/why-come-section';
import PracticalLocationSection from '@/components/(public)/le-lieu/practical-location-section';
import FinalCtaSection from '@/components/(public)/le-lieu/final-cta-section';
import React from 'react';

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
