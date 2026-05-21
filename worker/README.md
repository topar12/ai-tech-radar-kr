# Lokana Worker

This is the Cloudflare Worker migration surface for the zero-fixed-cost Lokana architecture.

F1 locked the Worker API shape. F2 added the local D1 schema and latest-snapshot read path. F3 adds protected official RSS/Atom collection into D1:

- `GET /health`
- `GET /api/bootstrap`
- `POST /api/admin/collect`
- CORS for local frontend testing and `https://lokana.kr`
- clear `501` responses for admin status/jobs/rebuild routes that land in later free-architecture rounds
- D1 migration for the current Lokana read model
- local D1 seed helper that writes one bootstrap snapshot
- D1-first `/api/bootstrap`, with sample fallback when D1 is not configured or empty
- OpenAI, Hugging Face, and Google AI official RSS/Atom feed collection
- D1 batch write for sources, signals, issues, watchlists, snapshots, and jobs

Admin status/jobs/rebuild operations are intentionally left for F4.

## Check Locally Without Cloudflare Login

```bash
cd /Users/juho/Desktop/localAI/worker
npm run check
```

## Check Live Feed Parsing

This fetches current official feeds and prints counts, but does not write D1:

```bash
cd /Users/juho/Desktop/localAI/worker
npm run collect:live
```

## Seed Local D1

Apply the migration and write a local sample snapshot:

```bash
cd /Users/juho/Desktop/localAI/worker
npm run d1:migrate:local
npm run d1:seed:local
```

## Run With Wrangler

Create a local admin secret file first. It is ignored by git:

```bash
cd /Users/juho/Desktop/localAI/worker
printf 'ADMIN_TOKEN=local-dev-token\n' > .dev.vars
```

```bash
cd /Users/juho/Desktop/localAI/worker
npm run dev
```

Then connect the frontend to:

```text
http://127.0.0.1:8765/index.html?api=http://127.0.0.1:8788
```

Trigger a local collect run:

```bash
curl -X POST http://127.0.0.1:8788/api/admin/collect \
  -H "X-Admin-Token: local-dev-token"
```

For production, replace the placeholder `database_id` in `wrangler.jsonc` with the ID returned by:

```bash
npx wrangler@latest d1 create lokana-prod
```

Set the production admin secret before exposing collect:

```bash
npx wrangler@latest secret put ADMIN_TOKEN --config wrangler.jsonc
```

Wrangler login and deploy come later, after the local collect path is verified.
