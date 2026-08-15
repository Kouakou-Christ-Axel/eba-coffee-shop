import React from 'react';
import { GoogleTagManager } from '@next/third-parties/google';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';
import InstallPwa from '@/components/pwa/install-pwa';
import DashboardFabMount from '@/components/layouts/dashboard-fab-mount';
import ConsentBoot from '@/components/analytics/consent-boot';
import CookieConsent from '@/components/analytics/cookie-consent';
import MetaPixel from '@/components/analytics/meta-pixel';
import { getContactSettings } from '@/lib/contact-settings-db';

// La mesure d'audience est montée ICI et non dans app/layout.tsx : le
// back-office (route group `(dashboard)`) génère un trafic staff intense —
// caisse, cuisine, statistiques — qui écraserait les chiffres du site vitrine.
// Sans NEXT_PUBLIC_GTM_ID ni NEXT_PUBLIC_META_PIXEL_ID, aucun script n'est
// chargé et la bannière de consentement ne s'affiche pas.

async function PublicLayout({ children }: { children: React.ReactNode }) {
  const contact = await getContactSettings();
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // La bannière conditionne les DEUX traceurs : le pixel Meta ne se charge
  // qu'après acceptation, il lui faut donc un moyen d'être accepté même si GTM
  // n'est pas configuré.
  const needsConsent = Boolean(gtmId || metaPixelId);

  return (
    <>
      {/* Les photos produits sont servies par Cloudinary (cf.
          components/ui/media-image.tsx) et découvertes tard, une fois le HTML
          parsé. Ouvrir la connexion dès le `<head>` (React 19 hisse ce `link`)
          économise DNS + TCP + TLS sur le chemin de l'image — soit un aller-
          retour complet, ce qui pèse plus que les octets sur le mobile
          ivoirien. */}
      <link rel="preconnect" href="https://res.cloudinary.com" />
      <link rel="dns-prefetch" href="https://res.cloudinary.com" />

      {/* Ordre significatif : l'amorçage Consent Mode doit précéder GTM. */}
      {gtmId ? <ConsentBoot /> : null}
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      {metaPixelId ? <MetaPixel pixelId={metaPixelId} /> : null}
      <Navbar />
      <main>{children}</main>
      <SiteFooter contact={contact} />
      <InstallPwa />
      <DashboardFabMount />
      {needsConsent ? (
        <CookieConsent hasAdvertising={Boolean(metaPixelId)} />
      ) : null}
    </>
  );
}

export default PublicLayout;
