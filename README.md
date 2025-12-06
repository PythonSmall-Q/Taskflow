# Taskflow Zero

Modern, real-time, intelligent task management on Cloudflare Workers.

## Tech Stack

- Cloudflare Workers + Hono (API)
- Cloudflare D1 (DB), R2 (files), KV (cache), Durable Objects (realtime), Workers AI
- React + Vite (PWA)

## Quick Start (Local)

Prereqs: Node 18+, `npm`, Cloudflare `wrangler` CLI (login once: `wrangler login`).

1) Install deps

```bash
npm install
```

2) Create local D1 database and run migrations

```bash
wrangler d1 create taskflow-db --config wrangler.toml --local
wrangler d1 migrations apply taskflow-db --local --config wrangler.toml --file apps/api/migrations/0001_init.sql
```

3) Build web and run the Worker (serves SPA from `apps/web/dist`)

```bash
npm --workspace @taskflow/web run build
npm --workspace @taskflow/api run dev
```

Open: http://127.0.0.1:8787

## Environment

`wrangler.toml` defines bindings. For production, add a `production` environment and set real IDs:

```toml
[env.production]
route = "your-domain.tld/*"
[[env.production.d1_databases]]
# ... production DB binding
```

Set a strong JWT secret:

```bash
wrangler secret put JWT_SECRET
```

## API Highlights

- POST /auth/register, /auth/login
- GET /openapi.yaml (OpenAPI 3.0)
- GET /projects, POST /projects
- GET /tasks/:projectId, POST /tasks, POST /tasks/move
- POST /files (multipart) + GET /files/:key
- GET /realtime/room/:id (WebSocket via Durable Object)
- GET /oauth/google|github/start, GET /oauth/google|github/callback (demo)
- POST /ai/auto-tag, POST /ai/assign (stubs)

See `apps/api/src/routes/*`.

## Notes

- OAuth (Google/GitHub), SSO, advanced reports, AI assistants are scaffold targets (not fully implemented in MVP).
- Cloudflare Access middleware stub is present; wire it to verify Access JWT via JWKs for production.
- PWA enabled; offline shell will serve after first load.

## Deploy

```bash
npm run build
npm --workspace @taskflow/api run deploy
```

### Custom domains (for everyone)

Each user can deploy to their own domain by setting the production env in `wrangler.toml`:

1) Edit `wrangler.toml` `[env.production]` and set `route = "your-domain.tld/*"`.
2) Bind your own resources in `env.production` (`D1`, `R2`, `KV`, `AI`).
3) Set secrets (e.g., `JWT_SECRET`) per environment:

```bash
wrangler secret put JWT_SECRET -e production
```

4) Deploy to your domain:

```bash
wrangler deploy -e production
```
