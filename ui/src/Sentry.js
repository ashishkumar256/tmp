import * as Sentry from '@sentry/react';

const initSentry = () => {
  // Check the values being read from the environment
  console.log('Sentry Check: VITE_SENTRY_DSN is', import.meta.env.VITE_SENTRY_DSN ? 'set' : 'undefined');
  console.log('Sentry Check: VITE_DEDUPE_STRATEGY is', import.meta.env.VITE_DEDUPE_STRATEGY);
  
  // This evaluates to true if VITE_DEDUPE_STRATEGY is 'custom'
  const disableDefaultDedupe = import.meta.env.VITE_DEDUPE_STRATEGY === 'custom';

  // The DSN check is what is causing the entire block to be skipped
  if (import.meta.env.VITE_SENTRY_DSN) {
    let integrationsToUse;

    if (disableDefaultDedupe) {
      integrationsToUse = Sentry.defaultIntegrations.filter(integration => {
        return integration.name !== 'Dedupe';
      });
      console.log('Sentry: Default Dedupe disabled. Custom logic can be enabled.');
    } else {
      integrationsToUse = Sentry.defaultIntegrations;
      console.log('Sentry: Default Dedupe enabled.');
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: "development",
      debug: true,
      integrations: integrationsToUse,
      tracesSampleRate: 1.0,
    });
    console.log('Sentry initialized with DSN'); // Add a final log for success

  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

initSentry();

export { Sentry };
export default Sentry;