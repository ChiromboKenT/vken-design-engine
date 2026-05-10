FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Build tools (needed for better-sqlite3 native compilation fallback)
# Chromium + system deps for Playwright screenshot capture
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-minimal \
    build-essential \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

ENV VKEN_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
COPY samples ./samples
COPY scripts ./scripts
COPY infra ./infra
COPY kb ./kb

# Install deps (postinstall builds sidecar-proto, sidecar, platform, tools/dev, tools/pack)
RUN NODE_ENV=development pnpm install --frozen-lockfile --prod=false

# Explicit workspace package build before daemon TSC (contracts exports src directly)
RUN pnpm --filter '@open-design/sidecar-proto' run build
RUN pnpm --filter '@open-design/sidecar' run build
RUN pnpm --filter '@open-design/platform' run build

ENV NODE_ENV=production
RUN pnpm --filter @open-design/daemon build
RUN pnpm build
RUN node samples/install-all.mjs

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
RUN chmod +x infra/space/entrypoint.sh
EXPOSE 7860
ENV PORT=7860
ENV OD_DATA_DIR=/data
ENTRYPOINT ["infra/space/entrypoint.sh"]
