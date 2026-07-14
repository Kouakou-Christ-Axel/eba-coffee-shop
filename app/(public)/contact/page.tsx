import type { Metadata } from 'next';
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contactez EBA Coffee Shop à Abidjan. Réservation, question ou partenariat — écrivez-nous ou passez nous voir à Cocody.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact',
    description:
      'Contactez EBA Coffee Shop à Abidjan. Réservation, question ou partenariat — écrivez-nous ou passez nous voir à Cocody.',
    url: '/contact',
    images: [
      {
        url: '/assets/examples/accueil/eba-hero.webp',
        width: 800,
        height: 449,
        alt: 'Contact — EBA Coffee Shop',
      },
    ],
  },
};

export default function ContactPage() {
  return (
    <>
      <ContactHeroSection />
      <ContactFormSection />
      <ContactMapSection />
    </>
  );
}
