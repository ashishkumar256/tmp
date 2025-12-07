// src/Sentry.js
import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";
import { replayIntegration } from "@sentry/replay";

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
  
  const baseConfig = {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_DIST,
    debug: false,
    release: `${import.meta.env.VITE_SENTRY_PROJECT}@${import.meta.env.VITE_RELEASE_NAME}`,
    // ✅ Performance monitoring
    tracesSampleRate: 1.0,
    // ✅ Replay sampling
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    // ✅ Auto-instrumentation
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: true
      })
    ],
  };
  
  if (import.meta.env.VITE_DEDUPE_STRATEGY === "custom") {
    console.log("[Sentry] Using custom deduplication strategy + Replay + Performance");
    
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
    console.log("[Sentry] Using default deduplication + Replay + Performance");
  }
  
  Sentry.init(baseConfig);
  console.log("Sentry initialized with DSN + Replay + Performance");
};

initSentry();

// -----------------------------
// Manual Tracing Helpers (Updated for Transactions)
// -----------------------------
export const startTransaction = (name, attributes = {}) => {
  if (!Sentry || !Sentry.startSpan) return null;
  
  let transaction = null;
  let traceId = null;
  let spanId = null;
  
  // startSpan expects a callback function
  Sentry.startSpan({
    name,
    op: 'transaction',
    attributes: {
      ...attributes,
      startTime: Date.now(),
    }
  }, (span) => {
    transaction = span;
    traceId = span?.spanContext()?.traceId;
    spanId = span?.spanContext()?.spanId;
  });
  
  return {
    transaction,
    traceId,
    spanId,
    startSpan: (spanName, spanAttributes = {}, spanOp = 'task') => {
      if (!transaction) return null;
      
      let childSpan = null;
      Sentry.startSpan({
        name: spanName,
        op: spanOp,
        attributes: spanAttributes,
      }, (span) => {
        childSpan = span;
      });
      
      return childSpan;
    },
    end: () => {
      if (transaction?.end) {
        transaction.end();
        console.log(`[Transaction Ended] ${name}`);
      }
    }
  };
};

export const startSpan = (name, attributes = {}, op = 'task') => {
  if (!Sentry || !Sentry.startSpan) return null;
  
  let span = null;
  Sentry.startSpan({
    name,
    op,
    attributes,
  }, (createdSpan) => {
    span = createdSpan;
  });
  
  return span;
};

export const endSpan = (span) => {
  if (span && span.end) {
    span.end();
  }
};

export const getCurrentTraceId = () => {
  const span = Sentry.getCurrentHub().getScope().getSpan();
  return span?.spanContext().traceId;
};

export const captureMessageWithTrace = (message, level = 'info', extra = {}) => {
  const traceId = getCurrentTraceId();
  if (Sentry && Sentry.captureMessage) {
    Sentry.captureMessage(message, {
      level,
      tags: { 
        trace_id: traceId,
        ...extra.tags
      },
      extra: {
        ...extra,
        traceId,
        timestamp: new Date().toISOString()
      }
    });
  }
  return traceId;
};

export { Sentry };
export default Sentry;