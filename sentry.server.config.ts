import * as Sentry from '@sentry/nextjs';
import { ENV } from 'varlock/env';
import { sentrySharedOptions } from './sentry.shared.config';

if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    ...sentrySharedOptions,
  });
}
