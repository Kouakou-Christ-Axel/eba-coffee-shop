import * as Sentry from '@sentry/nextjs';
import { ENV } from 'varlock/env';
import { sentrySharedOptions } from './sentry.shared.config';

// Convention Next 16 / Turbopack (remplace sentry.client.config.ts, abandonné
// par @sentry/nextjs sous Turbopack) : sans ce fichier, Sentry.captureException
// appelé depuis un composant client (cf. les error.tsx) n'a aucun client
// Sentry attaché et l'event est silencieusement perdu.
if (ENV.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.NEXT_PUBLIC_SENTRY_DSN,
    ...sentrySharedOptions,
  });
}
