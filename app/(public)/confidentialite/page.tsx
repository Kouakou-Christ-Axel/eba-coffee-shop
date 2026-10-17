import type { Metadata } from 'next';
import { LegalPage } from '@/components/(public)/legal/legal-page';
import { PrivacyContent } from '@/components/(public)/legal/privacy-content';
import { getContactSettings } from '@/lib/contact-settings-db';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Quelles données personnelles EBA Coffee Shop collecte, pourquoi, combien de temps, et comment exercer vos droits (loi ivoirienne 2013-450, ARTCI).',
  alternates: { canonical: '/confidentialite' },
};

export default async function ConfidentialitePage() {
  const contact = await getContactSettings();
  return (
    <LegalPage
      title="Politique de confidentialité"
      path="/confidentialite"
      intro="Cette page décrit les données personnelles que nous collectons quand vous commandez, participez à un sondage ou naviguez sur le site, ce que nous en faisons et comment faire valoir vos droits."
    >
      <PrivacyContent contact={contact} />
    </LegalPage>
  );
}
