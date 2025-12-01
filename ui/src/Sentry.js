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
  // Report 1st, 11th, 21st, 31st... errors (every 10th error after 1st)
  // Pattern: 1, 11, 21, 31, 41...
  return count === 1 || (count - 1) % 10 === 0;
};

// Track if we've already processed page load errors
let pageLoadErrorsHandled = false;

// Custom event processor for deduplication
const dedupeEventProcessor = (event) => {
  // Skip page load errors for deduplication (they're automatic)
  // Only count errors that happen after user interaction
  const isPageLoadError = !pageLoadErrorsHandled;
  
  if (isPageLoadError) {
    // Mark that we've handled page load errors
    pageLoadErrorsHandled = true;
    console.log('[Sentry Dedupe] Page load error detected - allowing through without counting');
    return event;
  }
  
  const shouldReport = shouldReportError();
  
  if (!shouldReport) {
    console.log(`[Sentry Dedupe] Skipping error #${getErrorCount()} - Next report at #${Math.floor((getErrorCount() - 1) / 10) * 10 + 11}`);
    
    // Return null to drop the event
    return null;
  }
  
  console.log(`[Sentry Dedupe] Reporting error #${getErrorCount()} of the day`);
  
  // Add deduplication metadata to the event
  event.extra = event.extra || {};
  event.extra.deduplication = {
    day: getDailyKey(),
    count: getErrorCount(),
    nextReportAt: Math.floor((getErrorCount() - 1) / 10) * 10 + 11,
    type: 'user_triggered'
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
      // Disable automatic error capturing on page load
      beforeSend(event, hint) {
        // Allow page load errors through without deduplication
        return event;
      }
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
      console.log('[Sentry] User-triggered errors will be reported at: 1st, 11th, 21st, 31st... (resets daily)');
      console.log('[Sentry] Page load errors are allowed through without counting');
    } else {
      // Use default integrations (including dedupe)
      config.integrations = Sentry.defaultIntegrations;
      console.log('[Sentry] Using default deduplication strategy');
    }

    Sentry.init(config);
    console.log('Sentry initialized with DSN');
    
    // Log current error count for the day
    console.log(`[Sentry] Today's user-triggered error count: ${getErrorCount()}`);
  } else {
    console.log('Sentry not initialized - no DSN provided');
  }
};

// Initialize immediately
initSentry();

export { Sentry };
export default Sentry;