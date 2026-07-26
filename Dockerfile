FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# npm install (not ci): local npm 11.12.1 mis-marks @esbuild/* platform
# packages in the lockfile; npm install tolerates it, npm ci hard-fails.
RUN npm install --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk upgrade --no-cache
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider -q http://localhost:3000/ || exit 1
CMD ["node", "server.js"]

FROM node:22-alpine AS migrate
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --no-package-lock
COPY drizzle.config.ts ./
COPY src/db ./src/db
CMD ["npx", "drizzle-kit", "migrate"]
