import * as Sentry from '@sentry/nextjs';

// Options communes aux runtimes server et edge (cf. sentry.server.config.ts,
// sentry.edge.config.ts) — un seul endroit pour éviter la dérive entre les deux.
export const sentrySharedOptions: Parameters<typeof Sentry.init>[0] = {
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
};
