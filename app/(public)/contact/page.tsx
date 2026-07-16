import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';
import { getContactSettings } from '@/lib/contact-settings-db';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { summarizeWeeklyHours } from '@/lib/pickup-settings';

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

export default async function ContactPage() {
  const [contact, pickup] = await Promise.all([
    getContactSettings(),
    getPickupSettings(),
  ]);
  const hoursLabel = summarizeWeeklyHours(pickup.weeklyHours);
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Contact', path: '/contact' }]} />
      <ContactHeroSection contact={contact} />
      <ContactFormSection contact={contact} hoursLabel={hoursLabel} />
      <ContactMapSection contact={contact} hoursLabel={hoursLabel} />
    </>
  );
}
