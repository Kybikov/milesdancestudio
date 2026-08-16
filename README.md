# Miles Dance Studio

Production-ready mobile-first admin system for Miles Dance Studio.

See [docs/README.md](docs/README.md) for product, architecture, security, and deployment documentation.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Admin: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
node tests/e2e/api-smoke.mjs
node tests/e2e/production-smoke.mjs
```

The end-to-end scripts require `E2E_OWNER_EMAIL` and `E2E_OWNER_PASSWORD`; production smoke also accepts `E2E_BASE_URL` and `E2E_API_URL`.
