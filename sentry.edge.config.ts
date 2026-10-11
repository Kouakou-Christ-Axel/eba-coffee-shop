import * as Sentry from '@sentry/nextjs';
import { ENV } from 'varlock/env';

// Même garde que sentry.server.config.ts — voir ce fichier.
if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  });
}
