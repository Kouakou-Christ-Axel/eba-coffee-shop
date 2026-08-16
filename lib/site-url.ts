// lib/site-url.ts
//
// Racine publique du site, NORMALISÉE (sans slash final).
//
// Pourquoi ce module existe : `NEXT_PUBLIC_SITE_URL` est saisie à la main dans
// l'hébergeur, et une URL se copie-colle presque toujours avec son slash final
// (`https://eba-coffee.com/`). Tout le code SEO concatène `${siteUrl}${path}`
// avec un `path` qui commence déjà par `/` — d'où des URLs `…com//a-propos`
// dans le sitemap, le robots.txt et le JSON-LD, alors que les canonicals
// (résolus par `metadataBase` via `new URL()`) restaient corrects. Google
// recevait donc deux signaux contradictoires pour la même page.
//
// La normalisation vit ici, en un seul point, plutôt que d'être exigée de
// chaque appelant : personne ne peut « oublier » de la faire s'il passe par
// `siteUrl()`.

import { ENV } from 'varlock/env';

/**
 * Retire le(s) slash(s) final(aux) d'une racine de site.
 *
 * Pur et sans dépendance à varlock : utilisable depuis les modules qui lisent
 * `process.env` directement (emails, actions dashboard).
 */
export function normalizeSiteUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

/**
 * Racine publique du site, garantie SANS slash final — à concaténer avec un
 * chemin qui, lui, commence par `/`.
 *
 * Fonction et non constante de module : `ENV` n'est peuplée que dans le
 * runtime Next.js, et une lecture au chargement du module ferait échouer tout
 * import depuis un contexte hors Next (tests, scripts).
 */
export function siteUrl(): string {
  return normalizeSiteUrl(ENV.NEXT_PUBLIC_SITE_URL);
}
