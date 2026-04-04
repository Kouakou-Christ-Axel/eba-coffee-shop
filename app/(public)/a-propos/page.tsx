import type { Metadata } from 'next';
import AboutHeroSection from '@/components/(public)/a-propos/about-hero-section';
import AboutPatissiereStorySection from '@/components/(public)/a-propos/about-patissiere-story-section';
import AboutVisionSection from '@/components/(public)/a-propos/about-vision-section';
import AboutEngagementsSection from '@/components/(public)/a-propos/about-engagements-section';
import AboutAtelierSection from '@/components/(public)/a-propos/about-atelier-section';
import AboutCtaSection from '@/components/(public)/a-propos/about-cta-section';

export const metadata: Metadata = {
  title: 'À propos',
  description:
    'Découvrez l\'histoire d\'EBA Coffee Shop : le parcours de notre pâtissière formée en France, nos engagements qualité et notre vision à Abidjan.',
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
