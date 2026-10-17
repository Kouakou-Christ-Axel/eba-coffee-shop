import type { Metadata } from 'next';
import {
  LegalLink,
  LegalPage,
  LegalSection,
  LegalValue,
} from '@/components/(public)/legal/legal-page';
import { getContactSettings } from '@/lib/contact-settings-db';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Éditeur, hébergeur et informations légales du site EBA Coffee Shop, Abidjan.',
  alternates: { canonical: '/mentions-legales' },
};

export default async function MentionsLegalesPage() {
  const c = await getContactSettings();
  const rows: Array<[string, React.ReactNode]> = [
    ['Exploitant', <LegalValue key="n" value={c.legalName} />],
    ['Forme juridique', <LegalValue key="f" value={c.legalForm} />],
    ['N° RCCM', <LegalValue key="r" value={c.rccm} />],
    ['N° de compte contribuable', <LegalValue key="c" value={c.ncc} />],
    [
      'Adresse',
      `${c.address}, ${c.district}`,
    ],
    ['Téléphone', c.phone],
    ['Email', c.email],
    [
      'Directeur de la publication',
      <LegalValue key="d" value={c.publicationDirector} />,
    ],
  ];

  return (
    <LegalPage
      title="Mentions légales"
      path="/mentions-legales"
      intro="Informations sur l’éditeur et l’hébergeur de ce site, conformément à la réglementation ivoirienne sur les échanges électroniques."
    >
      <LegalSection title="Éditeur du site">
        <dl className="space-y-1">
          {rows.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 text-foreground sm:w-56">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          <LegalValue value={c.hostName} />
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les textes, photographies, logos et éléments graphiques du site sont
          la propriété de l&apos;exploitant ou utilisés avec l&apos;accord de
          leurs auteurs. Toute reproduction sans autorisation écrite est
          interdite.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement de vos données est décrit dans la{' '}
          <LegalLink href="/confidentialite">
            politique de confidentialité
          </LegalLink>{' '}
          et la <LegalLink href="/cookies">politique cookies</LegalLink>. Les
          traitements sont déclarés à l&apos;ARTCI (n°&nbsp;
          <LegalValue value={c.artciReference} />
          ).
        </p>
      </LegalSection>

      <LegalSection title="Conditions de vente">
        <p>
          Voir les{' '}
          <LegalLink href="/cgv">conditions générales de vente</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
