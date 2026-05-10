FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Playwright system dependencies for Chromium on Debian Bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
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

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
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
RUN NODE_ENV=development pnpm install --frozen-lockfile --prod=false
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
