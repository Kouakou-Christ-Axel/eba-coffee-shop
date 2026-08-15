'use client';

// components/analytics/meta-pixel.tsx
//
// Pixel Meta (Facebook/Instagram) — reciblage publicitaire.
//
// Deux garde-fous, dans cet ordre :
//  1. NEXT_PUBLIC_META_PIXEL_ID absent → le composant n'est même pas monté
//     (cf. app/(public)/layout.tsx), comme pour GTM.
//  2. Consentement non accordé → RIEN n'est chargé. Contrairement à GTM (qui
//     s'appuie sur Consent Mode : le script part, les balises attendent), Meta
//     n'a pas d'équivalent fiable côté conteneur. On ne charge donc `fbevents.js`
//     qu'APRÈS un « Tout accepter », ce qui vaut aussi pour la performance :
//     le visiteur qui refuse ne paie pas les ~70 Ko du pixel.
//
// Conséquence assumée : un retrait du consentement (page /cookies) démonte le
// `<Script>` mais ne « décharge » pas `fbq` déjà en mémoire — plus aucun
// événement n'est émis par nos soins, et le rechargement de page repart propre.

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import React from 'react';
import { useConsentStore } from '@/lib/consent-store';
import { readConsentStatus } from '@/lib/consent-storage';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown };
  }
}

/**
 * Code d'amorçage officiel de Meta, `init` et première page vue compris — un
 * SEUL `<Script>` inline, jamais deux : l'ordre d'exécution de deux balises
 * `afterInteractive` n'est pas garanti, et un `fbq('init')` qui passerait avant
 * l'amorçage planterait sur un `fbq` indéfini. Le stub pose une file d'attente,
 * donc `init`/`track` peuvent précéder le chargement de `fbevents.js`.
 */
function buildPixelScript(pixelId: string): string {
  return `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
`;
}

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const status = useConsentStore((s) => s.status);
  // Le choix vit dans localStorage, illisible au rendu serveur : on ne décide
  // qu'après le premier effet (même garde que cookie-consent.tsx). Le store est
  // aussi alimenté par la bannière — `setStatus` est idempotent.
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    useConsentStore.getState().setStatus(readConsentStatus());
    setMounted(true);
  }, []);

  const isEnabled = mounted && status === 'granted';

  // Navigation côté client : Meta ne détecte pas les changements d'URL d'une
  // SPA, chaque page vue doit être signalée explicitement. La toute première
  // est déjà émise par le script d'amorçage — d'où le saut du premier passage,
  // sinon la page d'entrée compterait double.
  const initialPageViewSkipped = React.useRef(false);
  React.useEffect(() => {
    if (!isEnabled) return;
    if (!initialPageViewSkipped.current) {
      initialPageViewSkipped.current = true;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [isEnabled, pathname]);

  if (!isEnabled) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {buildPixelScript(pixelId)}
    </Script>
  );
}

export default MetaPixel;
