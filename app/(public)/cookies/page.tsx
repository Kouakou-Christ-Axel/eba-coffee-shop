import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';
import ConsentResetButton from '@/components/analytics/consent-reset-button';

export const metadata: Metadata = {
  title: 'Politique cookies',
  description:
    'Quels cookies EBA Coffee Shop dépose, pourquoi, combien de temps, et comment revenir sur votre choix à tout moment.',
  alternates: {
    canonical: '/cookies',
  },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/75">
        {children}
      </div>
    </section>
  );
}

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
      {/* « Accueil » est déjà ajouté par buildBreadcrumbJsonLd. */}
      <BreadcrumbJsonLd
        items={[{ name: 'Politique cookies', path: '/cookies' }]}
      />

      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Politique cookies
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-foreground/75">
        Cette page explique ce que nous mesurons sur ce site, avec quels outils,
        et comment reprendre la main sur votre choix.
      </p>

      <Section title="Ce que nous déposons, et quand">
        <p>
          <strong className="text-foreground">
            Rien n&apos;est déposé tant que vous n&apos;avez pas accepté.
          </strong>{' '}
          À votre arrivée, la mesure d&apos;audience est bloquée par défaut
          (mécanisme « Consent Mode » de Google) : aucun cookie de mesure
          n&apos;est écrit et aucune donnée n&apos;est transmise. Le bandeau
          vous laisse choisir ; tant que vous n&apos;avez pas répondu, le
          blocage reste actif.
        </p>
        <p>
          Certaines fonctions du site utilisent le stockage local de votre
          navigateur pour fonctionner, indépendamment de la mesure
          d&apos;audience : votre panier, vos commandes récentes et vos
          coordonnées de retrait. Ces informations restent sur votre appareil et
          ne sont jamais transmises à un tiers.
        </p>
      </Section>

      <Section title="Si vous acceptez">
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
        <p>
          Nous ne vendons aucune donnée, ne diffusons pas de publicité ciblée
          sur ce site, et ne recoupons pas ces statistiques avec votre identité.
          Les commandes que vous passez sont, elles, traitées séparément pour
          les besoins du service (préparation, retrait, fidélité).
        </p>
      </Section>

      <Section title="Si vous refusez">
        <p>
          Le site fonctionne exactement de la même manière — commande, panier,
          fidélité, suivi. Aucun cookie de mesure n&apos;est déposé et aucune
          statistique de navigation n&apos;est transmise à Google.
        </p>
      </Section>

      <Section title="Revenir sur votre choix">
        <p>
          Votre décision est enregistrée dans le stockage local de votre
          navigateur, sous la clé{' '}
          <code className="rounded bg-default-100 px-1 py-0.5 text-xs">
            eba-cookie-consent
          </code>
          . Vous pouvez la reprendre à tout moment ci-dessous — le bandeau
          réapparaîtra aussitôt. Vider les données du site depuis votre
          navigateur produit le même effet.
        </p>
        <ConsentResetButton />
      </Section>

      <Section title="Une question ?">
        <p>
          Écrivez-nous depuis la{' '}
          <a
            href="/contact"
            className="underline underline-offset-2 transition-colors hover:text-primary"
          >
            page contact
          </a>{' '}
          : nous répondons.
        </p>
      </Section>
    </div>
  );
}
