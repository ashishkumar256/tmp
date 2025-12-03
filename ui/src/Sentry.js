import * as Sentry from "@sentry/react";
import "@sentry/replay";   // ✅ Required for Replay

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
  // Report 1st, 11th, 21st, ... errors (every 10th after the first)
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


const initSentry = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    const baseConfig = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_DIST,
      debug: false,
      tracesSampleRate: 1.0,
      release: `${import.meta.env.VITE_SENTRY_PROJECT}@${import.meta.env.VITE_RELEASE_NAME}`,

      // ✅ Replay sampling
      replaysSessionSampleRate: 1.0,   // capture all sessions
      replaysOnErrorSampleRate: 1.0,   // capture all sessions with errors
    };

    if (import.meta.env.VITE_DEDUPE_STRATEGY === "custom") {
      baseConfig.integrations = (integrations) => {
        // keep all default integrations except Dedupe
        const filtered = integrations.filter(
          (integration) => integration.name !== "Dedupe"
        );
        // ✅ add Replay back in
        filtered.push(Sentry.replayIntegration());
        console.log("[Sentry] Using custom deduplication strategy + Replay");
        return filtered;
      };

      baseConfig.beforeSend = (event, hint) => {
        if (!event.exception?.values && !event.message) {
          return event;
        }
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
      // ✅ default integrations + Replay
      baseConfig.integrations = [
        ...Sentry.defaultIntegrations,
        Sentry.replayIntegration(),
      ];
      console.log("[Sentry] Using default deduplication + Replay");
    }

    Sentry.init(baseConfig);
    console.log("Sentry initialized with DSN + Replay");
  } else {
    console.log("Sentry not initialized - no DSN provided");
  }
};

initSentry();

export { Sentry };
export default Sentry;
