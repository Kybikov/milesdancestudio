FROM node:24-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web apps/web
RUN pnpm --filter @miles/web build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 miles && useradd --system --uid 1001 --gid miles miles
WORKDIR /app
COPY --from=build --chown=miles:miles /app/apps/web/.next/standalone ./
COPY --from=build --chown=miles:miles /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=miles:miles /app/apps/web/public ./apps/web/public
USER miles
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
