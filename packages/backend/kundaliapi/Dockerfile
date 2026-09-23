FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
# Skip puppeteer's own Chromium download at install time too — the runtime
# stage installs system chromium and points PUPPETEER_EXECUTABLE_PATH at it.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

FROM base AS deps
COPY package.json ./
# In monorepo, lockfile is at root — copy from build context
COPY ../../pnpm-lock.yaml ./pnpm-lock.yaml 2>/dev/null || true
COPY ../../pnpm-workspace.yaml ./pnpm-workspace.yaml 2>/dev/null || true
RUN pnpm install --frozen-lockfile 2>/dev/null || npm install --omit=dev

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build 2>/dev/null || npx tsc

FROM node:20-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apt-get update && apt-get install -y chromium --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 3400
CMD ["node", "dist/index.js"]
