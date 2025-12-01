import * as Sentry from '@sentry/react';

const initSentry = () => {
  const disableDefaultDedupe = import.meta.env.VITE_DEDUPE_STRATEGY === 'custom';

  if (import.meta.env.VITE_SENTRY_DSN) {
    console.log('Sentry initialized with DSN');
    let integrationsToUse;

    if (disableDefaultDedupe) {
      integrationsToUse = Sentry.defaultIntegrations.filter(integration => {
        console.log('Sentry: Default Dedupe disabled. Custom logic can be enabled.');
        return integration.name !== 'Dedupe';
      });
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
      release: 'memory@1.0.0-dev', 
    });
    

  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

initSentry();

export { Sentry };
export default Sentry;