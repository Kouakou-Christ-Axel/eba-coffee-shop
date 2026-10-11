import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Capture les erreurs des Server Components, des Server Actions, des route
// handlers et du middleware — sendOrderToKitchen, les webhooks Jèko, les
// outils MCP, etc. Pas de pendant client : voir next.config.ts.
export const onRequestError = Sentry.captureRequestError;
