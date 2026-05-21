# Lokana Worker

This is the Cloudflare Worker migration surface for the zero-fixed-cost Lokana architecture.

F1 locked the Worker API shape. F2 adds the local D1 schema and latest-snapshot read path:

- `GET /health`
- `GET /api/bootstrap`
- CORS for local frontend testing and `https://lokana.kr`
- clear `501` responses for admin routes that land in later free-architecture rounds
- D1 migration for the current Lokana read model
- local D1 seed helper that writes one bootstrap snapshot
- D1-first `/api/bootstrap`, with sample fallback when D1 is not configured or empty

Collector jobs and admin operations are intentionally left for F3-F4.

## Check Locally Without Cloudflare Login

```bash
cd /Users/juho/Desktop/localAI/worker
npm run check
```

## Seed Local D1

Apply the migration and write a local sample snapshot:

```bash
cd /Users/juho/Desktop/localAI/worker
npm run d1:migrate:local
npm run d1:seed:local
```

## Run With Wrangler

```bash
cd /Users/juho/Desktop/localAI/worker
npm run dev
```

Then connect the frontend to:

```text
http://127.0.0.1:8765/index.html?api=http://127.0.0.1:8788
```

For production, replace the placeholder `database_id` in `wrangler.jsonc` with the ID returned by:

```bash
npx wrangler@latest d1 create lokana-prod
```

Wrangler login and deploy come later, after the local D1 path is verified.
