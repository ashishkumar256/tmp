import * as Sentry from '@sentry/react';

// Initialize Sentry
const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    const config = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: "development",
      debug: true,
      tracesSampleRate: 1.0,
    };
    
    // Check if custom dedupe strategy is enabled
    if (import.meta.env.VITE_DEDUPE_STRATEGY === 'custom') {
      // Disable default integrations and manually add all except dedupe
      config.defaultIntegrations = false;
      config.integrations = (integrations) => {
        return integrations.filter(integration => 
          integration.name !== 'Dedupe'
        );
      };
    } else {
      // Use default integrations (including dedupe)
      config.integrations = Sentry.defaultIntegrations;
    }
    
    Sentry.init(config);
    config.log("config:", config)
    console.log('Sentry initialized with DSN');
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

export { Sentry };
export default Sentry;