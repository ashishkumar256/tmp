// src/Sentry.js
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/react";   // ✅ Performance monitoring
import "@sentry/replay";   // ✅ Required for Replay

// -----------------------------
// Deduplication helpers
// -----------------------------
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
  return count === 1 || (count - 1) % 10 === 0;
};

const getErrorFingerprint = (event) => {
  const exception = event.exception?.values?.[0];
  if (exception) {
    const message = exception.value || "";
    const type = exception.type || "";
    return `${type}:${message}`.toLowerCase().replace(/\s+/g, "_");
  }
  if (event.message) {
    return `message:${event.message}`.toLowerCase().replace(/\s+/g, "_");
  }
  return "unknown";
};

// -----------------------------
// Initialization
// -----------------------------
const initSentry = () => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.log("Sentry not initialized - no DSN provided");
    return;
  }
  
  // ✅ Define Replay integration once
  const replay = Sentry.replayIntegration({
    maskAllText: false,   // show UI text
    maskAllInputs: true,  // keep PII masked
    blockAllMedia: true   // safer default
  });
  
  const baseConfig = {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_DIST,
    debug: false,
    release: `${import.meta.env.VITE_SENTRY_PROJECT}@${import.meta.env.VITE_RELEASE_NAME}`,
    // ✅ Performance monitoring
    tracesSampleRate: 1.0,   // capture 100% of transactions (adjust in production)
    // ✅ Replay sampling
    replaysSessionSampleRate: 1.0,   // capture all sessions
    replaysOnErrorSampleRate: 1.0,   // capture all sessions with errors
  };
  
  if (import.meta.env.VITE_DEDUPE_STRATEGY === "custom") {
    baseConfig.integrations = (integrations) => {
      const filtered = integrations.filter(
        (integration) => integration.name !== "Dedupe"
      );
      filtered.push(
        new BrowserTracing(),  // ✅ add performance monitoring
        replay                 // ✅ add Replay
      );
      console.log("[Sentry] Using custom deduplication strategy + Replay + Performance");
      return filtered;
    };
    
    baseConfig.beforeSend = (event) => {
      if (!event.exception?.values && !event.message) return event;
      const fingerprint = getErrorFingerprint(event);
      if (fingerprint === "unknown") return event;
      const shouldReport = shouldReportError(fingerprint);
      const currentCount = getErrorCount(fingerprint);
      if (!shouldReport) {
        const nextReportAt = Math.floor((currentCount - 1) / 10) * 10 + 11;
        console.log(
          `[Sentry Custom Dedupe] Skipping "${fingerprint}" error #${currentCount} - Next report at #${nextReportAt}`
        );
        return null;
      }
      console.log(
        `[Sentry Custom Dedupe] Reporting "${fingerprint}" error #${currentCount} of the day`
      );
      event.extra = event.extra || {};
      event.extra.deduplication = {
        day: new Date().toISOString().split("T")[0],
        fingerprint,
        count: currentCount,
        nextReportAt: Math.floor((currentCount - 1) / 10) * 10 + 11,
      };
      return event;
    };
  } else {
    baseConfig.integrations = [
      ...Sentry.defaultIntegrations,
      new BrowserTracing(),  // ✅ add performance monitoring
      replay                 // ✅ add Replay
    ];
    console.log("[Sentry] Using default deduplication + Replay + Performance");
  }
  
  Sentry.init(baseConfig);
  console.log("Sentry initialized with DSN + Replay + Performance");
};

initSentry();

// -----------------------------
// Manual Tracing Helpers - SIMPLIFIED
// -----------------------------
export const startManualTrace = () => {
  if (!Sentry || !Sentry.startSpan) return null;
  
  // Get the current active span (if any)
  const currentSpan = Sentry.getCurrentHub().getScope().getSpan();
  
  // Create a new span/transaction for the calculation
  const transaction = Sentry.startTransaction({
    name: 'array_memory_calculation',
    op: 'task',
  });
  
  // Set it as the active span
  Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
  
  return {
    transaction,
    traceId: transaction.spanContext().traceId,
    spanId: transaction.spanContext().spanId,
  };
};

export const addManualSpan = (name, data = {}, op = 'task') => {
  if (!Sentry || !Sentry.startSpan) return null;
  
  // Create a child span under the current active span
  return Sentry.startSpan({
    name,
    op,
    data,
  });
};

export const finishManualTrace = (transaction) => {
  if (transaction && transaction.finish) {
    transaction.finish();
  }
};

export const getCurrentTraceId = () => {
  const span = Sentry.getCurrentHub().getScope().getSpan();
  return span?.spanContext().traceId;
};

export { Sentry };
export default Sentry;