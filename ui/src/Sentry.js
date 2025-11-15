import * as Sentry from '@sentry/react';

// Initialize Sentry
const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: "development",
      debug: true,
      // Remove integrations that might cause issues in development
      integrations: [],
      tracesSampleRate: 1.0,
    });
    console.log('Sentry initialized with DSN');
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

export { Sentry };
export default Sentry;
