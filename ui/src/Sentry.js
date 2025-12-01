import * as Sentry from '@sentry/react';

// Generate a fingerprint for an error
const getErrorFingerprint = (event) => {
  // Use error message and stack trace to create a fingerprint
  const exception = event.exception?.values?.[0];
  if (!exception) return 'unknown';
  
  const message = exception.value || '';
  const type = exception.type || '';
  
  // Create a simple fingerprint from message and type
  // For more accurate deduplication, you could include stack trace
  return `${type}:${message}`.toLowerCase().replace(/\s+/g, '_');
};

// Storage for deduplication tracking
const getDailyKey = (fingerprint) => {
  const now = new Date();
  return `sentry-dedup-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${fingerprint}`;
};

const getErrorCount = (fingerprint) => {
  const key = getDailyKey(fingerprint);
  const data = localStorage.getItem(key);
  return data ? parseInt(data, 10) : 0;
};

const incrementErrorCount = (fingerprint) => {
  const key = getDailyKey(fingerprint);
  const count = getErrorCount(fingerprint) + 1;
  localStorage.setItem(key, count.toString());
  return count;
};

const shouldReportError = (fingerprint) => {
  const count = incrementErrorCount(fingerprint);
  // Report 1st, 11th, 21st, 31st... errors (every 10th error after 1st)
  // Pattern: 1, 11, 21, 31, 41...
  return count === 1 || (count - 1) % 10 === 0;
};

// Custom event processor for deduplication
const dedupeEventProcessor = (event) => {
  // Get fingerprint for this specific error
  const fingerprint = getErrorFingerprint(event);
  
  const shouldReport = shouldReportError(fingerprint);
  
  if (!shouldReport) {
    const currentCount = getErrorCount(fingerprint);
    const nextReportAt = Math.floor((currentCount - 1) / 10) * 10 + 11;
    console.log(`[Sentry Dedupe] Skipping ${fingerprint} error #${currentCount} - Next report at #${nextReportAt}`);
    
    // Return null to drop the event
    return null;
  }
  
  const currentCount = getErrorCount(fingerprint);
  console.log(`[Sentry Dedupe] Reporting ${fingerprint} error #${currentCount} of the day`);
  
  // Add deduplication metadata to the event
  event.extra = event.extra || {};
  event.extra.deduplication = {
    day: new Date().toISOString().split('T')[0],
    fingerprint: fingerprint,
    count: currentCount,
    nextReportAt: Math.floor((currentCount - 1) / 10) * 10 + 11,
    type: 'per_error_deduplication'
  };
  
  return event;
};

// Custom integration for deduplication with proper Sentry integration structure
class CustomDedupeIntegration {
  static id = 'CustomDedupe';
  name = 'CustomDedupe';

  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    addGlobalEventProcessor(dedupeEventProcessor);
  }
}

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
      // Create custom integrations array
      config.integrations = [
        new Sentry.BrowserTracing(),
        new Sentry.Replay(),
        new Sentry.BrowserProfilingIntegration(),
        new CustomDedupeIntegration()
      ];

      // Disable default integrations
      config.defaultIntegrations = false;

      console.log('[Sentry] Custom deduplication strategy enabled');
      console.log('[Sentry] Each unique error will be reported at: 1st, 11th, 21st, 31st... (resets daily)');
      console.log('[Sentry] Different errors have separate counters');
    } else {
      // Use default integrations (including dedupe)
      config.integrations = Sentry.defaultIntegrations;
      console.log('[Sentry] Using default deduplication strategy');
    }

    Sentry.init(config);
    console.log('Sentry initialized with DSN');
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

export { Sentry };
export default Sentry;