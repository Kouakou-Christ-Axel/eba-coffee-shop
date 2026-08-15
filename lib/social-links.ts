// lib/social-links.ts
//
// Source UNIQUE des profils sociaux du commerce. Même principe que
// lib/contact-links.ts pour les liens de contact : une seule liste, un seul
// endroit à compléter le jour où un réseau s'ajoute.
//
// Deux consommateurs, un seul ordre :
// - le pied de page (`components/layouts/site-footer.tsx`), qui associe chaque
//   `key` à son icône ;
// - le JSON-LD (`lib/json-ld.ts`), dont le `sameAs` doit lister TOUS les
//   profils — c'est ce que les moteurs (et les audits SEO) lisent pour relier
//   le site à ses comptes sociaux.
//
// Les réseaux non renseignés (chaîne vide) sont filtrés ici, pas chez l'appelant.

import type { ContactSettings } from '@/lib/contact-settings';

export type SocialNetworkKey =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'youtube';

export type SocialProfile = {
  key: SocialNetworkKey;
  /** Nom du réseau, tel qu'annoncé à l'utilisateur (`aria-label`). */
  label: string;
  url: string;
};

/**
 * Profils sociaux renseignés, dans l'ordre d'affichage (les deux comptes
 * historiques d'abord). Un réseau laissé vide dans les réglages n'apparaît pas.
 */
export function buildSocialProfiles(contact: ContactSettings): SocialProfile[] {
  const candidates: SocialProfile[] = [
    { key: 'instagram', label: 'Instagram', url: contact.instagramUrl },
    { key: 'tiktok', label: 'TikTok', url: contact.tiktokUrl },
    { key: 'facebook', label: 'Facebook', url: contact.facebookUrl },
    { key: 'x', label: 'X', url: contact.xUrl },
    { key: 'linkedin', label: 'LinkedIn', url: contact.linkedinUrl },
    { key: 'youtube', label: 'YouTube', url: contact.youtubeUrl },
  ];
  return candidates.filter((profile) => profile.url.trim().length > 0);
}

/** `sameAs` schema.org : les URLs seules, dans le même ordre. */
export function buildSameAs(contact: ContactSettings): string[] {
  return buildSocialProfiles(contact).map((profile) => profile.url);
}

/**
 * Pseudo X (`@eba`) déduit de l'URL du profil, pour la balise `twitter:site`.
 * `null` si aucune URL X n'est renseignée ou si elle ne pointe pas sur un
 * profil (ex. lien vers un post). On ne stocke pas le pseudo à part : il est
 * toujours contenu dans l'URL, et deux champs à tenir synchronisés dériveraient.
 */
export function xHandleFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'x.com' && host !== 'twitter.com') return null;
  const [segment, ...rest] = parsed.pathname.split('/').filter(Boolean);
  if (!segment || rest.length > 0) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(segment)) return null;
  return `@${segment}`;
}
