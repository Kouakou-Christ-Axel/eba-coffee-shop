import * as Sentry from '@sentry/nextjs';
import { ENV } from 'varlock/env';

// Instrumentation serveur uniquement (Node.js) — pas de pendant navigateur :
// voir la note dans next.config.ts sur le choix de ne pas instrumenter le
// site public. Inerte sans SENTRY_DSN (dev local, previews sans secret).
if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  });
}
