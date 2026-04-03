import type { Metadata } from 'next';
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactQuickAccessSection from '@/components/(public)/contact/contact-quick-access-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';
import ContactCtaSection from '@/components/(public)/contact/contact-cta-section';

export const metadata: Metadata = {
  title: 'Contact | EBA Coffee Shop',
  description:
    'Contactez EBA Coffee Shop a Abidjan. Reservation, question ou partenariat — ecrivez-nous ou passez nous voir a Cocody.',
};

export default function ContactPage() {
  return (
    <>
      <ContactHeroSection />
      <ContactQuickAccessSection />
      <ContactFormSection />
      <ContactMapSection />
      <ContactCtaSection />
    </>
  );
}
