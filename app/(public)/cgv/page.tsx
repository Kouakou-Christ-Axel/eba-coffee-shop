import type { Metadata } from 'next';
import {
  LegalLink,
  LegalPage,
  LegalSection,
  LegalValue,
} from '@/components/(public)/legal/legal-page';
import { getContactSettings } from '@/lib/contact-settings-db';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description:
    'Conditions de commande, de paiement et de retrait chez EBA Coffee Shop, Abidjan.',
  alternates: { canonical: '/cgv' },
};

export default async function CgvPage() {
  const c = await getContactSettings();
  return (
    <LegalPage
      title="Conditions générales de vente"
      path="/cgv"
      intro="Ces conditions encadrent les commandes passées sur le site pour un retrait chez EBA Coffee Shop."
    >
      <LegalSection title="Vendeur">
        <p>
          <LegalValue value={c.legalName} />, {c.address}, {c.district}.
          Contact&nbsp;: {c.phone} · {c.email}. Voir aussi les{' '}
          <LegalLink href="/mentions-legales">mentions légales</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Produits et prix">
        <p>
          Les produits et leurs prix, en francs CFA (FCFA) toutes taxes
          comprises, sont ceux affichés sur la carte au moment de la commande.
          Certains produits ne se commandent que pour le jour même ; d&apos;autres
          peuvent être précommandés pour un autre jour. Un produit épuisé peut
          être indisponible ou proposé pour un retrait ultérieur.
        </p>
      </LegalSection>

      <LegalSection title="Commande et retrait">
        <p>
          La commande est validée lorsque vous recevez sa confirmation avec sa
          référence. Le retrait se fait sur place au créneau choisi, à
          l&apos;adresse ci-dessus. Merci de vous présenter avec votre
          référence ou le téléphone utilisé pour commander.
        </p>
      </LegalSection>

      <LegalSection title="Paiement">
        <p>
          Le paiement s&apos;effectue en ligne (Mobile Money via notre
          prestataire de paiement) ou sur place selon les modes proposés lors de
          la commande. Une commande à payer en ligne est réservée pendant un
          délai limité ; passé ce délai sans paiement, elle est annulée.
        </p>
      </LegalSection>

      <LegalSection title="Annulation, modification et réclamation">
        <p>
          Pour modifier ou annuler une commande, contactez-nous au plus tôt au{' '}
          {c.phone}. Les produits frais ou préparés à la demande ne peuvent pas
          être repris une fois prêts, sauf défaut de notre part, auquel cas
          nous remplaçons ou remboursons le produit. Les conditions précises de
          remboursement et la juridiction compétente sont à compléter par
          l&apos;exploitant.
        </p>
      </LegalSection>

      <LegalSection title="Carte de fidélité">
        <p>
          Des tampons sont crédités à chaque commande éligible et donnent droit
          à des récompenses selon les règles affichées sur le site. Ils n&apos;ont
          aucune valeur monétaire. Vos données de fidélité sont traitées comme
          décrit dans la{' '}
          <LegalLink href="/confidentialite">
            politique de confidentialité
          </LegalLink>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
