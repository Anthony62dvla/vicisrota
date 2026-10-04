import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (see deploy/). Traced from the repo root so the workspace packages are included.
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Workspace packages ship as TypeScript source.
  transpilePackages: ["@vicisrota/compliance", "@vicisrota/db"],
};

// Uploads source maps only when SENTRY_AUTH_TOKEN is set; otherwise a no-op wrapper.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
