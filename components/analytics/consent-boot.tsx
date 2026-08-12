// components/analytics/consent-boot.tsx
//
// Amorçage de Google Consent Mode v2 — le script le PLUS EN AMONT de la page.
//
// Contrainte d'ordre : `gtag('consent', 'default', …)` doit s'exécuter AVANT le
// chargement de gtm.js, sinon la première salve de balises part sans contrainte
// de stockage. Or `<GoogleTagManager>` (@next/third-parties) s'appuie sur
// `next/script` en stratégie `afterInteractive`, donc APRÈS l'hydratation.
//
// D'où ce composant SERVEUR qui rend un `<script>` inline classique (ni async ni
// defer) : le navigateur l'exécute pendant l'analyse du HTML, très largement
// avant l'injection de GTM. Même patron que le JSON-LD de app/layout.tsx.
// `'unsafe-inline'` est déjà présent dans `script-src` (cf. next.config.ts).
//
// Le script relit lui-même le choix stocké et enchaîne un `consent update` pour
// les visiteurs qui avaient déjà accepté — sans quoi ils seraient re-bloqués à
// chaque visite en attendant que React monte la bannière. Le format lu est
// celui de lib/consent-storage.ts : TOUTE ÉVOLUTION DOIT ÊTRE RÉPERCUTÉE ICI.

import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '@/lib/consent-storage';

// `wait_for_update` laisse 500 ms aux balises pour attendre notre `update`
// avant de partir en mode dégradé — le temps que React monte et lise le choix.
// `ads_data_redaction` supprime les identifiants de clic publicitaire tant que
// `ad_storage` est refusé ; `url_passthrough` conserve gclid/utm dans l'URL lors
// des navigations, seule mesure restante sans cookie.
const bootScript = `
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
  try {
    var raw = window.localStorage.getItem('${CONSENT_STORAGE_KEY}');
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && saved.version === ${CONSENT_VERSION} && saved.analytics === true) {
        gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted'
        });
        gtag('set', 'ads_data_redaction', false);
      }
    }
  } catch (e) {
    /* localStorage indisponible (navigation privée) : on reste sur 'denied'. */
  }
})();
`;

export function ConsentBoot() {
  return (
    <script
      id="consent-mode-default"
      dangerouslySetInnerHTML={{ __html: bootScript }}
    />
  );
}

export default ConsentBoot;
