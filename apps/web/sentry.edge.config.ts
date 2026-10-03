import * as Sentry from "@sentry/nextjs";

// With no DSN set, Sentry stays off and errors still go to the server log.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Staff and care data is sensitive: send stack traces and the reference ID, not personal data.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { allow: ["x-request-id"] } }, httpBodies: [] },
});
