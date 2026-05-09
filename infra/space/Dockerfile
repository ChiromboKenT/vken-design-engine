FROM mcr.microsoft.com/playwright:v1.59.1-noble AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
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
