import * as Sentry from '@sentry/react';

// Storage for deduplication tracking
const getDailyKey = () => {
  const now = new Date();
  return `sentry-dedup-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

const getErrorCount = () => {
  const key = getDailyKey();
  const data = localStorage.getItem(key);
  return data ? parseInt(data, 10) : 0;
};

const incrementErrorCount = () => {
  const key = getDailyKey();
  const count = getErrorCount() + 1;
  localStorage.setItem(key, count.toString());
  return count;
};

const shouldReportError = () => {
  const count = incrementErrorCount();
  // Report 1st, 10th, 20th, 30th... errors (every 10th error)
  return count === 1 || count % 10 === 0;
};

// Custom event processor for deduplication
const dedupeEventProcessor = (event) => {
  const shouldReport = shouldReportError();
  
  if (!shouldReport) {
    console.log(`[Sentry Dedupe] Skipping error #${getErrorCount()} - Next report at #${Math.ceil(getErrorCount() / 10) * 10}`);
    
    // Return null to drop the event
    return null;
  }
  
  console.log(`[Sentry Dedupe] Reporting error #${getErrorCount()} of the day`);
  
  // Add deduplication metadata to the event
  event.extra = event.extra || {};
  event.extra.deduplication = {
    day: getDailyKey(),
    count: getErrorCount(),
    nextReportAt: Math.ceil(getErrorCount() / 10) * 10 + 1
  };
  
  return event;
};

// Custom integration for deduplication
const createDedupeIntegration = () => ({
  name: 'CustomDedupe',
  setup(client) {
    client.addEventProcessor(dedupeEventProcessor);
  }
});

// Initialize Sentry
const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    const config = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: "development",
      debug: true,
      tracesSampleRate: 1.0,
      release: "memory@1.0.0",
    };

    // Check if custom dedupe strategy is enabled
    if (import.meta.env.VITE_DEDUPE_STRATEGY === 'custom') {
      // Disable default integrations and manually add all except dedupe
      config.defaultIntegrations = false;
      config.integrations = (integrations) => {
        const filtered = integrations.filter(integration =>
          integration.name !== 'Dedupe'
        );
        // Add our custom deduplication integration
        filtered.push(createDedupeIntegration());
        return filtered;
      };
      
      console.log('[Sentry] Custom deduplication strategy enabled');
      console.log('[Sentry] Errors will be reported at: 1st, 10th, 20th, 30th... (resets daily)');
    } else {
      // Use default integrations (including dedupe)
      config.integrations = Sentry.defaultIntegrations;
      console.log('[Sentry] Using default deduplication strategy');
    }

    Sentry.init(config);
    console.log('Sentry initialized with DSN');
    
    // Log current error count for the day
    console.log(`[Sentry] Today's error count: ${getErrorCount()}`);
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

// Export helper functions for testing
export const testDedupe = {
  getDailyKey,
  getErrorCount,
  shouldReportError,
  resetCount: () => {
    const key = getDailyKey();
    localStorage.removeItem(key);
    console.log(`[Sentry Test] Reset count for ${key}`);
  }
};

export { Sentry };
export default Sentry;