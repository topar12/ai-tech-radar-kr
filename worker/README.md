# Lokana Worker

This is the Cloudflare Worker migration surface for the zero-fixed-cost Lokana architecture.

F1 only locks the Worker API shape:

- `GET /health`
- `GET /api/bootstrap`
- CORS for local frontend testing and `https://lokana.kr`
- clear `501` responses for admin routes that land in later free-architecture rounds

D1 persistence, migrations, collector jobs, and admin operations are intentionally left for F2-F4.

## Check Locally Without Cloudflare Login

```bash
cd /Users/juho/Desktop/localAI/worker
npm run check
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

Wrangler login and deploy come later, after D1 is introduced.
