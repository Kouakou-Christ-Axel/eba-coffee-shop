import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
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
  openGraph: {
    title: 'À propos — Notre histoire',
    description:
      "Découvrez l'histoire d'EBA Coffee Shop à Abidjan : une pâtissière formée en France, des engagements qualité et une vision artisanale à Cocody.",
    url: '/a-propos',
    images: [
      {
        url: '/assets/examples/accueil/eba-hero.webp',
        width: 800,
        height: 449,
        alt: 'À propos — EBA Coffee Shop',
      },
    ],
  },
};

function AProposPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'À propos', path: '/a-propos' }]} />
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
