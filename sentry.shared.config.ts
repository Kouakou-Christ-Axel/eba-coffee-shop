import * as Sentry from '@sentry/nextjs';

type SentryEvent = Parameters<
  NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSend']>
>[0];

// Corps multipart malformés envoyés par des scanners/bots (POST sur une URL au
// hasard, souvent via l'IP nue) : Next/undici les rejette avant tout code
// applicatif, il n'y a rien à corriger côté app — pur bruit.
const MALFORMED_BODY_PATTERNS = [
  /Failed to parse body as FormData/i,
  /no boundary found in multipart body/i,
];

// Message EXACT levé par les guards `requireRole*` (lib/auth-helpers.ts). Le
// layout dashboard redirige déjà vers /login (ou /) mais la page, rendue en
// parallèle, throw quand même : Sentry captait une exception pour chaque
// visiteur déconnecté. L'UX est gérée (redirection ou `dashboard/error.tsx`) et
// `getSession` logge côté serveur les vrais problèmes de cookie.
const UNAUTHORIZED_MESSAGE = 'Non autorisé';

// « Failed to find Server Action » est légitime après un déploiement (onglet
// resté ouvert sur l'ancien build) : on ne l'écarte que lorsque la requête vise
// une URL de scanner — WordPress (`/wp-admin/admin-ajax.php`) ou IP nue.
const SERVER_ACTION_NOT_FOUND = /Failed to find Server Action/i;
const SCANNER_PATH = /\/wp-|\.php(?:$|[?#])/i;
const BARE_IP_HOST = /^(?:\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\])$/i;

function isScannerUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const { hostname, pathname, search } = new URL(rawUrl);
    return (
      BARE_IP_HOST.test(hostname) || SCANNER_PATH.test(`${pathname}${search}`)
    );
  } catch {
    return false;
  }
}

/** Vrai pour le bruit connu : rien à corriger dans l'app, pas d'événement Sentry. */
export function shouldDropEvent(event: SentryEvent): boolean {
  const messages = (event.exception?.values ?? []).map(
    ({ value }) => value ?? ''
  );

  if (
    messages.some((message) =>
      MALFORMED_BODY_PATTERNS.some((pattern) => pattern.test(message))
    )
  ) {
    return true;
  }
  if (messages.includes(UNAUTHORIZED_MESSAGE)) return true;
  return (
    messages.some((message) => SERVER_ACTION_NOT_FOUND.test(message)) &&
    isScannerUrl(event.request?.url)
  );
}

export const sentrySharedOptions: Parameters<typeof Sentry.init>[0] = {
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  beforeSend(event) {
    return shouldDropEvent(event) ? null : event;
  },
};
