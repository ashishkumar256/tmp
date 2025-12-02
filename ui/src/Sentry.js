import * as Sentry from '@sentry/react';

// Storage for deduplication tracking - by error fingerprint
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

// Initialize Sentry
const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    const config = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_DIST,
      // TURN OFF DEBUG MODE to reduce noise
      debug: false,
      tracesSampleRate: 1.0,

      // NEW: Session Replay sampling
      integrations: [
        Sentry.replayIntegration()
      ],
      replaysSessionSampleRate: 0.01,   // 1% normal sessions
      replaysOnErrorSampleRate: 1.0,   // 100% sessions when error captured

      release: `${import.meta.env.VITE_SENTRY_PROJECT}@${import.meta.env.VITE_RELEASE_NAME}`,
    };
    
    // Check if custom dedupe strategy is enabled
    if (import.meta.env.VITE_DEDUPE_STRATEGY === 'custom') {      
      // CRITICAL: We need to filter out the built-in Dedupe integration
      config.integrations = (integrations) => {
        // Remove Sentry's built-in Dedupe integration
        const filteredIntegrations = integrations.filter(integration => 
          integration.name !== 'Dedupe'
        );
        
        // console.log('[Sentry] Integrations after filtering:', filteredIntegrations.map(i => i.name));
        console.log('[Sentry] Using custom deduplication strategy');
        return filteredIntegrations;
      };
      
      // Add our custom deduplication logic in beforeSend
      config.beforeSend = (event, hint) => {        
        // Skip non-error events (transactions, replays, outcomes, etc.)
        if (!event.exception?.values && !event.message) {
          return event;
        }
        
        // Get fingerprint for this specific error
        const fingerprint = getErrorFingerprint(event);
        
        if (fingerprint === 'unknown') {
          console.log('Unknown fingerprint, allowing through');
          return event;
        }
        
        const shouldReport = shouldReportError(fingerprint);
        const currentCount = getErrorCount(fingerprint);
        
        if (!shouldReport) {
          const nextReportAt = Math.floor((currentCount - 1) / 10) * 10 + 11;
          console.log(`[Sentry Custom Dedupe] Skipping "${fingerprint}" error #${currentCount} - Next report at #${nextReportAt}`);
          return null; // Drop the event
        }
        
        console.log(`[Sentry Custom Dedupe] Reporting "${fingerprint}" error #${currentCount} of the day`);
        
        event.extra = event.extra || {};
        event.extra.deduplication = {
          day: new Date().toISOString().split('T')[0],
          fingerprint: fingerprint,
          count: currentCount,
          nextReportAt: Math.floor((currentCount - 1) / 10) * 10 + 11,
        };
        
        return event;
      };
    } else {
      console.log('[Sentry] Using default deduplication strategy');
      // Use default integrations (including dedupe)
      config.integrations = Sentry.defaultIntegrations;
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