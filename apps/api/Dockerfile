FROM node:24-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @miles/api db:generate && pnpm --filter @miles/api build

FROM node:24-bookworm-slim AS runner
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && groupadd --system --gid 1001 miles && useradd --system --uid 1001 --gid miles miles
WORKDIR /app
COPY --from=build --chown=miles:miles /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=miles:miles /app/node_modules ./node_modules
COPY --from=build --chown=miles:miles /app/apps/api ./apps/api
USER miles
EXPOSE 4000
CMD ["node", "apps/api/dist/src/server.js"]
