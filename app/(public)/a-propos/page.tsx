import type { Metadata } from 'next';
import AboutHeroSection from '@/components/(public)/a-propos/about-hero-section';
import AboutPatissiereStorySection from '@/components/(public)/a-propos/about-patissiere-story-section';
import AboutVisionSection from '@/components/(public)/a-propos/about-vision-section';
import AboutEngagementsSection from '@/components/(public)/a-propos/about-engagements-section';
import AboutAtelierSection from '@/components/(public)/a-propos/about-atelier-section';
import AboutCtaSection from '@/components/(public)/a-propos/about-cta-section';

export const metadata: Metadata = {
  title: 'À propos — Notre histoire',
  description:
    "Découvrez l'histoire d'EBA Coffee Shop à Abidjan : une pâtissière formée en France, des engagements qualité et une vision artisanale à Cocody.",
  alternates: {
    canonical: '/a-propos',
  },
};

function AProposPage() {
  return (
    <>
      <AboutHeroSection />
      <AboutPatissiereStorySection />
      <AboutVisionSection />
      <AboutEngagementsSection />
      <AboutAtelierSection />
      <AboutCtaSection />
    </>
  );
}

export default AProposPage;
