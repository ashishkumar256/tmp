import * as Sentry from '@sentry/react';

// Check if this is an error event (not transaction, replay, etc.)
const isErrorEvent = (event) => {
  // Error events have exception values
  if (event.exception?.values?.length > 0) {
    return true;
  }
  
  // Message events are also errors/warnings/info
  if (event.message) {
    return true;
  }
  
  // Transactions, replays, outcomes, etc. should not be deduplicated
  return false;
};

// Generate a fingerprint for an error
const getErrorFingerprint = (event) => {
  // For error events with exception
  const exception = event.exception?.values?.[0];
  if (exception) {
    const message = exception.value || '';
    const type = exception.type || '';
    return `${type}:${message}`.toLowerCase().replace(/\s+/g, '_');
  }
  
  // For message events
  if (event.message) {
    return `message:${event.message}`.toLowerCase().replace(/\s+/g, '_');
  }
  
  return 'unknown';
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
  // Skip non-error events (transactions, replays, outcomes, etc.)
  if (!isErrorEvent(event)) {
    console.log('[Sentry Dedupe] Skipping non-error event (transaction/replay/outcome)');
    return event; // Allow through without deduplication
  }
  
  // Get fingerprint for this specific error
  const fingerprint = getErrorFingerprint(event);
  
  // Skip if fingerprint is 'unknown' (shouldn't happen for real errors)
  if (fingerprint === 'unknown') {
    console.warn('[Sentry Dedupe] Unknown error type detected, allowing through');
    return event;
  }
  
  const shouldReport = shouldReportError(fingerprint);
  
  if (!shouldReport) {
    const currentCount = getErrorCount(fingerprint);
    const nextReportAt = Math.floor((currentCount - 1) / 10) * 10 + 11;
    console.log(`[Sentry Dedupe] Skipping "${fingerprint}" error #${currentCount} - Next report at #${nextReportAt}`);
    
    // Return null to drop the event
    return null;
  }
  
  const currentCount = getErrorCount(fingerprint);
  console.log(`[Sentry Dedupe] Reporting "${fingerprint}" error #${currentCount} of the day`);
  
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
      release: import.meta.env.VITE_RELEASE_NAME || import.meta.env.npm_package_version,
      // Disable automatic performance monitoring to reduce noise
      integrations: function(integrations) {
        // Filter out performance monitoring integrations if not needed
        return integrations.filter(integration => 
          integration.name !== 'BrowserTracing' && 
          integration.name !== 'BrowserProfilingIntegration' &&
          integration.name !== 'Replay'
        );
      }
    };

    // Check if custom dedupe strategy is enabled
    if (import.meta.env.VITE_DEDUPE_STRATEGY === 'custom') {
      // Add only our custom dedupe integration
      config.integrations = [
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