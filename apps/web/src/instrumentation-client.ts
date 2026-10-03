import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Staff and care data is sensitive: send stack traces and the reference ID, not personal data.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: { request: { allow: ["x-request-id"] } }, httpBodies: [] },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
