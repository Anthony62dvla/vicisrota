# VicisRota: one image build, two targets.
#   web   - the small production server (Next.js standalone output)
#   tools - the full workspace, for database migrations and admin commands
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/compliance/package.json packages/compliance/
COPY packages/db/package.json packages/db/
COPY packages/messaging/package.json packages/messaging/
RUN npm ci --no-audit --no-fund

FROM deps AS tools
COPY . .
ENV NODE_ENV=production

FROM tools AS build
# Public settings are baked into the browser code at build time.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN NEXT_TELEMETRY_DISABLED=1
# Placeholders so the build can load server code; the real values come from .env at run time.
RUN BETTER_AUTH_SECRET=build-only-placeholder BETTER_AUTH_URL=http://localhost:3000 DATABASE_URL=postgres://build@localhost/build \
    npm run build -w @vicisrota/web

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 vicisrota
COPY --from=build --chown=vicisrota /app/apps/web/.next/standalone ./
COPY --from=build --chown=vicisrota /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=vicisrota /app/apps/web/public ./apps/web/public
USER vicisrota
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
