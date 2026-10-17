// components/(public)/legal/privacy-content.tsx
//
// Corps de la politique de confidentialité. Les durées, traitements et
// destinataires viennent de config/data-protection.ts (source unique, partagée
// avec la purge et le dossier ARTCI).

import {
  LegalLink,
  LegalSection,
  LegalValue,
} from '@/components/(public)/legal/legal-page';
import {
  PROCESSING_ACTIVITIES,
  PROCESSORS,
} from '@/config/data-protection';
import type { ContactSettings } from '@/lib/contact-settings';

const TRIGGER_LABEL = {
  toujours: 'Au chargement du site',
  consentement: 'Après votre accord',
  'au clic': 'Après un clic de votre part',
  personnel: 'Outil interne (personnel)',
} as const;

export function PrivacyContent({ contact }: { contact: ContactSettings }) {
  const rightsEmail = contact.privacyEmail || contact.email;

  return (
    <>
      <LegalSection title="Qui est responsable de vos données ?">
        <p>
          <strong className="text-foreground">
            <LegalValue value={contact.legalName} />
          </strong>{' '}
          (EBA Coffee Shop), {contact.address}, {contact.district}. Contact
          pour toute question sur vos données&nbsp;:{' '}
          <a
            href={`mailto:${rightsEmail}`}
            className="underline underline-offset-2 hover:text-primary"
          >
            {rightsEmail}
          </a>
          .
        </p>
        <p>
          Nous traitons vos données conformément à la loi ivoirienne
          n°2013-450 du 19&nbsp;juin 2013 relative à la protection des données
          à caractère personnel, sous le contrôle de l&apos;ARTCI (Autorité de
          régulation des télécommunications/TIC de Côte d&apos;Ivoire).
          N° de déclaration ou d&apos;autorisation&nbsp;:{' '}
          <LegalValue value={contact.artciReference} />.
        </p>
      </LegalSection>

      <LegalSection title="Ce que nous collectons, pourquoi, combien de temps">
        <ul className="space-y-4">
          {PROCESSING_ACTIVITIES.map((a) => (
            <li key={a.id} className="rounded-large border border-default-200 p-4">
              <p className="font-medium text-foreground">{a.label}</p>
              <dl className="mt-2 space-y-1">
                <Row term="Finalité" value={a.purpose} />
                <Row term="Base" value={a.basis} />
                <Row term="Données" value={a.data} />
                <Row term="Destinataires" value={a.recipients} />
                <Row term="Durée" value={a.duration} />
              </dl>
            </li>
          ))}
        </ul>
        <p>
          Nous ne vendons aucune donnée. Les champs libres (note de commande,
          message) ne doivent pas contenir d&apos;information de santé ou
          d&apos;autre donnée sensible.
        </p>
      </LegalSection>

      <LegalSection title="Transferts hors de Côte d’Ivoire">
        <p>
          Certains prestataires sont établis à l&apos;étranger. Vos données ne
          leur parviennent que dans les conditions ci-dessous, et nous
          demandons à l&apos;ARTCI l&apos;autorisation de ces transferts lorsque
          la loi l&apos;exige.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <thead className="text-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Prestataire</th>
                <th className="py-2 pr-3 font-medium">Rôle</th>
                <th className="py-2 pr-3 font-medium">Pays</th>
                <th className="py-2 font-medium">Quand ?</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-t border-default-200">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3">{p.role}</td>
                  <td className="py-2 pr-3">{p.country}</td>
                  <td className="py-2">{TRIGGER_LABEL[p.trigger]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Hébergeur du site&nbsp;: <LegalValue value={contact.hostName} />.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez à tout moment demander l&apos;accès à vos données, leur
          rectification, leur suppression ou vous opposer à leur traitement, et
          retirer un consentement donné. Pour supprimer votre fiche client
          (nom, téléphone, fidélité), écrivez-nous&nbsp;: elle est anonymisée,
          seules les écritures comptables des commandes (montant, date)
          subsistent, sans nom ni téléphone.
        </p>
        <p>
          Écrivez à{' '}
          <a
            href={`mailto:${rightsEmail}`}
            className="underline underline-offset-2 hover:text-primary"
          >
            {rightsEmail}
          </a>{' '}
          ou via la <LegalLink href="/contact">page contact</LegalLink> en
          indiquant le téléphone utilisé pour commander. Nous pouvons vous
          demander de prouver votre identité avant de répondre, sous un mois.
        </p>
        <p>
          Si votre demande ne reçoit pas de réponse satisfaisante, vous pouvez
          saisir l&apos;ARTCI. Les visiteurs de l&apos;Union européenne
          conservent en outre les droits que leur donne le RGPD, dont celui de
          saisir leur autorité de contrôle.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          L&apos;accès aux données est réservé au personnel selon son rôle, les
          échanges sont chiffrés (HTTPS) et les données sont purgées ou
          anonymisées aux échéances ci-dessus. En cas de violation de données
          susceptible de vous porter préjudice, nous vous en informons et
          prévenons l&apos;ARTCI.
        </p>
        <p>
          Voir aussi notre{' '}
          <LegalLink href="/cookies">politique cookies</LegalLink> et nos{' '}
          <LegalLink href="/mentions-legales">mentions légales</LegalLink>.
        </p>
      </LegalSection>
    </>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 text-foreground sm:w-28">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
