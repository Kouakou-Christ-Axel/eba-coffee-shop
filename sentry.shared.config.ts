import * as Sentry from '@sentry/nextjs';

// Corps multipart malformés envoyés par des scanners/bots (POST sur une URL au
// hasard, souvent via l'IP nue) : Next/undici les rejette avant tout code
// applicatif, il n'y a rien à corriger côté app — pur bruit.
const MALFORMED_BODY_PATTERNS = [
  /Failed to parse body as FormData/i,
  /no boundary found in multipart body/i,
];

export const sentrySharedOptions: Parameters<typeof Sentry.init>[0] = {
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  beforeSend(event) {
    const isMalformedBody = event.exception?.values?.some(({ value }) =>
      MALFORMED_BODY_PATTERNS.some((pattern) => pattern.test(value ?? ''))
    );
    return isMalformedBody ? null : event;
  },
};
