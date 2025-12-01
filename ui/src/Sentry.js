import * as Sentry from '@sentry/react';

// Initialize Sentry
const initSentry = () => {
  // Use a clear environment variable name for the flag, e.g., VITE_DISABLE_DEFAULT_DEDUPE
  const disableDefaultDedupe = import.meta.env.VITE_DISABLE_DEFAULT_DEDUPE === 'true';

  if (import.meta.env.VITE_SENTRY_DSN) {
    let integrationsToUse;

    if (disableDefaultDedupe) {
      // ✅ Scenario 1: Flag is set (e.g., VITE_DISABLE_DEFAULT_DEDUPE=true)
      // Filter out the default Dedupe integration.
      integrationsToUse = Sentry.defaultIntegrations.filter(integration => {
        return integration.name !== 'Dedupe';
      });

      // 💡 Add your custom dedupe integration here if you have one
      // For example:
      // integrationsToUse.push(new CustomDedupeIntegration());
      
      console.log('Sentry: Default Dedupe disabled. Custom logic can be enabled.');
    } else {
      // 🔄 Scenario 2: Flag is not set or set to 'false'
      // Use the full list of default integrations, which includes Dedupe.
      integrationsToUse = Sentry.defaultIntegrations;
      console.log('Sentry: Default Dedupe enabled.');
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: "development",
      debug: true,
      // Pass the filtered or full list of integrations
      integrations: integrationsToUse, 
      tracesSampleRate: 1.0,
    });
    
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

export { Sentry };
export default Sentry;