import type { Metadata } from 'next';
import {
  LegalLink,
  LegalPage,
  LegalSection,
} from '@/components/(public)/legal/legal-page';
import ConsentResetButton from '@/components/analytics/consent-reset-button';

export const metadata: Metadata = {
  title: 'Politique cookies',
  description:
    'Quels cookies EBA Coffee Shop dépose, pourquoi, combien de temps, et comment revenir sur votre choix à tout moment.',
  alternates: {
    canonical: '/cookies',
  },
};

export default function CookiesPage() {
  // Le pixel Meta est optionnel (NEXT_PUBLIC_META_PIXEL_ID). Cette page doit
  // décrire ce qui tourne RÉELLEMENT sur l'installation : promettre « aucune
  // publicité ciblée » alors qu'un pixel de reciblage est actif serait faux.
  const hasMetaPixel = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);

  return (
    <LegalPage
      title="Politique cookies"
      path="/cookies"
      intro="Cette page explique ce que nous mesurons sur ce site, avec quels outils, et comment reprendre la main sur votre choix. Pour le détail de vos données personnelles, voyez la politique de confidentialité."
    >
      <LegalSection title="Ce que nous déposons, et quand">
        <p>
          <strong className="text-foreground">
            Rien n&apos;est déposé tant que vous n&apos;avez pas accepté.
          </strong>{' '}
          À votre arrivée, la mesure d&apos;audience est bloquée par défaut
          (mécanisme « Consent Mode » de Google) : aucun cookie de mesure
          n&apos;est écrit. Le conteneur Google Tag Manager est toutefois
          chargé pour pouvoir attendre votre choix : Google peut recevoir, sans
          cookie, des signaux techniques de connexion (adresse IP, navigateur,
          page visitée). Tant que vous n&apos;avez pas répondu, le blocage des
          cookies reste actif.
        </p>
        <p>
          Certaines fonctions du site utilisent le stockage local de votre
          navigateur pour fonctionner, indépendamment de la mesure
          d&apos;audience : votre panier, vos commandes récentes et vos
          coordonnées de retrait (nom et téléphone, préremplis pour vos prochaines
          commandes) et, si vous votez à un sondage, un identifiant anonyme de
          votant. Ces informations restent sur votre appareil ; vous pouvez les
          effacer en vidant les données du site dans votre navigateur.
        </p>
      </LegalSection>

      <LegalSection title="Si vous acceptez">
        <p>
          Nous utilisons{' '}
          <strong className="text-foreground">Google Tag Manager</strong> et{' '}
          <strong className="text-foreground">Google Analytics 4</strong> pour
          comprendre comment le site est utilisé : pages consultées, produits
          regardés, paniers créés et commandes abouties. L&apos;objectif est
          concret — savoir ce qui plaît, repérer les étapes où l&apos;on vous
          perd, et améliorer la carte comme le site.
        </p>
        <p>Cookies concernés :</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <code className="rounded bg-default-100 px-1 py-0.5 text-xs">
              _ga
            </code>{' '}
            — distingue les visiteurs entre eux. Durée&nbsp;: 2&nbsp;ans.
          </li>
          <li>
            <code className="rounded bg-default-100 px-1 py-0.5 text-xs">
              _ga_&lt;identifiant&gt;
            </code>{' '}
            — conserve l&apos;état de la session de mesure. Durée&nbsp;:
            2&nbsp;ans.
          </li>
        </ul>
        {hasMetaPixel ? (
          <>
            <p>
              Nous utilisons également le{' '}
              <strong className="text-foreground">pixel Meta</strong> (Facebook,
              Instagram) : il mesure les visites et les commandes issues de nos
              publicités, et permet de vous proposer nos annonces sur ces
              réseaux. Il n&apos;est chargé qu&apos;après votre acceptation —
              aucun octet n&apos;est téléchargé auprès de Meta avant.
            </p>
            <p>
              Cookies concernés&nbsp;:{' '}
              <code className="rounded bg-default-100 px-1 py-0.5 text-xs">
                _fbp
              </code>{' '}
              — identifie votre navigateur pour Meta. Durée&nbsp;: 3&nbsp;mois.
            </p>
            <p>
              Nous ne vendons aucune donnée et ne recoupons pas ces statistiques
              avec votre identité. Les commandes que vous passez sont, elles,
              traitées séparément pour les besoins du service (préparation,
              retrait, fidélité).
            </p>
          </>
        ) : (
          <p>
            Nous ne vendons aucune donnée, ne diffusons pas de publicité ciblée
            sur ce site, et ne recoupons pas ces statistiques avec votre
            identité. Les commandes que vous passez sont, elles, traitées
            séparément pour les besoins du service (préparation, retrait,
            fidélité).
          </p>
        )}
      </LegalSection>

      <LegalSection title="Si vous refusez">
        <p>
          Le site fonctionne exactement de la même manière — commande, panier,
          fidélité, suivi. Aucun cookie de mesure n&apos;est déposé et aucune
          statistique de navigation n&apos;est transmise à Google
          {hasMetaPixel ? ' ni à Meta' : ''}.
        </p>
      </LegalSection>

      <LegalSection title="Contenus tiers chargés au clic">
        <p>
          La carte Google Maps et les vidéos TikTok ne se chargent
          qu&apos;après un clic de votre part : tant que vous ne cliquez pas,
          aucune donnée n&apos;est envoyée à ces services. Les photos du site
          sont servies par Cloudinary, ce qui lui transmet votre adresse IP
          comme pour tout contenu d&apos;un site web.
        </p>
      </LegalSection>

      <LegalSection title="Revenir sur votre choix">
        <p>
          Votre décision est enregistrée dans le stockage local de votre
          navigateur, sous la clé{' '}
          <code className="rounded bg-default-100 px-1 py-0.5 text-xs">
            eba-cookie-consent
          </code>
          . Vous pouvez la reprendre à tout moment ci-dessous — le bandeau
          réapparaîtra aussitôt. Vider les données du site depuis votre
          navigateur produit le même effet. Un choix est valable 13&nbsp;mois,
          puis nous vous le redemandons. Retirer votre accord efface aussi les
          cookies de mesure déjà déposés.
        </p>
        <ConsentResetButton />
      </LegalSection>

      <LegalSection title="Une question ?">
        <p>
          Écrivez-nous depuis la{' '}
          <LegalLink href="/contact">page contact</LegalLink> ou consultez notre{' '}
          <LegalLink href="/confidentialite">
            politique de confidentialité
          </LegalLink>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
