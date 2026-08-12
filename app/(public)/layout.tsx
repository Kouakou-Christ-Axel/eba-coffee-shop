import React from 'react';
import { GoogleTagManager } from '@next/third-parties/google';
import Navbar from '@/components/layouts/navbar';
import SiteFooter from '@/components/layouts/site-footer';
import InstallPwa from '@/components/pwa/install-pwa';
import DashboardFab from '@/components/layouts/dashboard-fab';
import ConsentBoot from '@/components/analytics/consent-boot';
import CookieConsent from '@/components/analytics/cookie-consent';
import { getContactSettings } from '@/lib/contact-settings-db';

// La mesure d'audience est montée ICI et non dans app/layout.tsx : le
// back-office (route group `(dashboard)`) génère un trafic staff intense —
// caisse, cuisine, statistiques — qui écraserait les chiffres du site vitrine.
// Sans NEXT_PUBLIC_GTM_ID, aucun script n'est chargé et la bannière de
// consentement ne s'affiche pas.

async function PublicLayout({ children }: { children: React.ReactNode }) {
  const contact = await getContactSettings();
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <>
      {/* Ordre significatif : l'amorçage Consent Mode doit précéder GTM. */}
      {gtmId ? <ConsentBoot /> : null}
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      <Navbar />
      <main>{children}</main>
      <SiteFooter contact={contact} />
      <InstallPwa />
      <DashboardFab />
      {gtmId ? <CookieConsent /> : null}
    </>
  );
}

export default PublicLayout;
