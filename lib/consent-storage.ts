// lib/consent-storage.ts
//
// Persistance du choix cookies du visiteur (RGPD / Consent Mode v2).
//
// localStorage plutôt que cookie : la valeur n'est jamais nécessaire côté
// serveur (GTM est 100% client), et tout l'état client du site vit déjà là —
// même convention de clé que 'eba-cart' (lib/cart-store.ts), 'eba-orders'
// (lib/order-history.ts) et 'eba-pwa-install-dismissed' (install-pwa.tsx).
//
// Ce module est volontairement pur et sans dépendance React : il est lu aussi
// bien par le store zustand que par le script d'amorçage inline
// (components/analytics/consent-boot.tsx), qui en réimplémente la lecture en
// JS brut — TOUTE ÉVOLUTION DU FORMAT DOIT ÊTRE RÉPERCUTÉE LÀ-BAS.

/** Clé localStorage du choix cookies. */
export const CONSENT_STORAGE_KEY = 'eba-cookie-consent';

/**
 * Version du format ET de la politique cookies. L'incrémenter re-sollicite
 * tous les visiteurs (nouveau traceur ajouté, finalité modifiée…).
 */
export const CONSENT_VERSION = 1;

/** `pending` = aucun choix exploitable stocké → on affiche la bannière. */
export type ConsentStatus = 'pending' | 'granted' | 'denied';

export type ConsentRecord = {
  version: number;
  /** Mesure d'audience (GA4). */
  analytics: boolean;
  /** Publicité / remarketing. Toujours aligné sur `analytics` en v1 : la
   * bannière ne propose pas encore de réglage par catégorie, mais le format
   * stocké le permettra sans migration. */
  ads: boolean;
  /** Horodatage du choix (preuve de recueil). */
  ts: number;
};

/**
 * Relit le choix stocké. Renvoie `null` (→ `pending`) dès que quoi que ce soit
 * cloche : clé absente, JSON corrompu, version périmée, localStorage
 * indisponible (navigation privée). Ne lève jamais.
 */
export function readConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Partial<ConsentRecord>;
    if (record.version !== CONSENT_VERSION) return null;
    if (typeof record.analytics !== 'boolean') return null;
    return {
      version: CONSENT_VERSION,
      analytics: record.analytics,
      // `ads` a pu être ajouté après coup : on retombe sur `analytics`.
      ads: typeof record.ads === 'boolean' ? record.ads : record.analytics,
      ts: typeof record.ts === 'number' ? record.ts : 0,
    };
  } catch {
    return null;
  }
}

/** Statut dérivé du stockage, directement consommable par le store. */
export function readConsentStatus(): ConsentStatus {
  const record = readConsent();
  if (!record) return 'pending';
  return record.analytics ? 'granted' : 'denied';
}

/** Écrit le choix. Best-effort : un localStorage indisponible n'est jamais bloquant. */
export function writeConsent(accepted: boolean): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    analytics: accepted,
    ads: accepted,
    ts: Date.now(),
  };
  if (typeof window === 'undefined') return record;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* noop */
  }
  return record;
}

/** Efface le choix — le visiteur sera re-sollicité (page /cookies). */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
