# Lokana

Lokana is a Korean-first AI tech radar for tracking fast-moving AI signals as decision-ready issues instead of a raw news feed.

The current version includes a static frontend, a FastAPI backend with a SQLite snapshot store, an official RSS/Atom collector, clustered issue scoring, and a mock API. The UI can run on sample data first, then switch to a real backend through `GET /api/bootstrap`.

## What It Includes

- Today view for high-priority AI changes
- Role filters for developer, PM, leader, learner, and researcher perspectives
- Sorting by importance, velocity, practical value, and Korea relevance
- Issue cards with source grouping, certainty, risk, and action buttons
- Detail panel with summary, evidence, timeline, and action tabs
- Watchlist and question-style exploration panels
- API fallback behavior: sample data when no API is configured
- FastAPI backend with a SQLite-backed snapshot read model
- RSS/Atom collector for official AI blog feeds
- Rule-based issue clustering and signal-based scoring
- Mock API server for integration testing
- Cloudflare Worker path with D1 latest-snapshot reads, protected official RSS/Atom collect, admin status/jobs, manual snapshot rebuild, six-hour Cron collection, and remote smoke checks

## Run The Static App

```bash
cd lokana
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html
```

## Test With The Mock API

Start the mock API:

```bash
cd lokana
node api/mock-radar-server.js
```

Start the static server in another terminal:

```bash
cd lokana
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html?api=http://127.0.0.1:8787
```

When the API is connected, the top status line changes from sample data to API-connected data.

## Run The FastAPI Backend

Create a local virtual environment and install the backend dependencies:

```bash
cd lokana
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

Start the backend:

```bash
cd lokana
ADMIN_TOKEN=localai-dev-admin-token backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8787
```

The first backend request creates a local SQLite database at `backend/data/lokana.sqlite3`. To override it in production, use a `sqlite:///...` style `DATABASE_URL`.

Connect the frontend:

```text
http://127.0.0.1:8765/index.html?api=http://127.0.0.1:8787
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Collect official feeds and rebuild the snapshot:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/collect \
  -H "X-Admin-Token: localai-dev-admin-token"
```

Read the latest admin status:

```bash
curl http://127.0.0.1:8787/api/admin/status \
  -H "X-Admin-Token: localai-dev-admin-token"
```

List recent jobs:

```bash
curl "http://127.0.0.1:8787/api/admin/jobs?limit=10" \
  -H "X-Admin-Token: localai-dev-admin-token"
```

Admin rebuild example:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/rebuild-snapshot \
  -H "X-Admin-Token: localai-dev-admin-token"
```

## Deployment

The current recommended zero-fixed-cost path is Cloudflare Workers plus D1 for the API, and static hosting for the frontend. The older FastAPI/Render setup is still present as a development reference, but the active deployment path is the Worker in `worker/`.

Current production targets:

- Frontend: `https://lokana.kr`
- API: `https://api.lokana.kr`
- Worker fallback: `https://lokana-api.ttoparr12.workers.dev`
- Scheduled collection: every 6 hours with `0 */6 * * *`

### Cloudflare Worker API

Local checks:

```bash
cd lokana/worker
npm run check
npm run deploy:dry-run
```

Cloudflare setup sequence:

1. Log in with `npx wrangler@latest login`.
2. Create D1 with `npx wrangler@latest d1 create lokana-prod`.
3. Replace the placeholder `database_id` in `worker/wrangler.jsonc`.
4. Apply remote migration with `npm run d1:migrate:remote`.
5. Set `ADMIN_TOKEN` with `npx wrangler@latest secret put ADMIN_TOKEN --config wrangler.jsonc`.
6. Deploy with `npm run deploy`.
7. Smoke-test workers.dev before connecting `api.lokana.kr`.
8. Enable the six-hour Cron Trigger after manual remote smoke passes.

Remote smoke:

```bash
cd lokana/worker
WORKER_URL=https://api.lokana.kr npm run smoke:remote

WORKER_URL=https://api.lokana.kr \
ADMIN_TOKEN=your-production-admin-token \
RUN_COLLECT=1 \
RUN_REBUILD=1 \
npm run smoke:remote
```

### Frontend runtime config

The frontend loads `runtime-config.js` before `app.js`.

Local default:

```js
window.LOKANA_API_BASE_URL = window.LOKANA_API_BASE_URL || "";
window.RADAR_API_BASE_URL = window.RADAR_API_BASE_URL || window.LOKANA_API_BASE_URL || "";
```

For a static production build, inject the Worker API URL:

```bash
LOKANA_API_BASE_URL=https://api.lokana.kr bash scripts/build-static.sh
```

### Legacy Render Reference

The repo still includes Render/FastAPI artifacts for development comparison:

- `render.yaml`: Render Blueprint for the older backend web service and static frontend
- `backend/.env.example`: local and production env reference
- `backend/scripts/backup_sqlite.py`: SQLite backup helper

Do not use Render for the free target unless the Cloudflare path is deliberately paused.

Static builds overwrite `dist/runtime-config.js` using `LOKANA_API_BASE_URL`. If it is empty, the app falls back to sample data.

### GitHub Pages fallback

If you do not want to use Cloudflare Pages for the frontend, this repo can also be published as a static site from GitHub Pages. In that case the simplest path is:

1. Publish the repository root from the `main` branch.
2. Use `?api=https://api.lokana.kr` in the URL, or edit `runtime-config.js` for a fixed frontend deployment target.

### Legacy FastAPI backup

Create a timestamped backup of the SQLite file:

```bash
cd lokana
PYTHONPATH=backend backend/.venv/bin/python backend/scripts/backup_sqlite.py
```

### Cloudflare free migration path

The repo also includes an F5-ready Cloudflare Worker path for the zero-fixed-cost architecture:

- `worker/`: Worker API surface
- `worker/wrangler.jsonc`: Cloudflare Worker config
- `worker/migrations/0001_initial.sql`: D1 schema for the current read model
- `worker/scripts/seed-local.mjs`: local D1 seed helper
- `worker/scripts/smoke-local.mjs`: dependency-free local contract check
- `worker/scripts/collect-smoke.mjs`: dependency-free collector and D1 write check
- `worker/scripts/admin-smoke.mjs`: dependency-free admin status/jobs/rebuild check
- `worker/scripts/collect-live.mjs`: live official feed fetch check without D1 writes
- `worker/scripts/smoke-remote.mjs`: deployed Worker smoke check
- Worker Cron Trigger: `0 */6 * * *`

Run the Worker contract check:

```bash
cd lokana/worker
npm run check
npm run deploy:dry-run
```

Apply and seed local D1:

```bash
cd lokana/worker
npm run d1:migrate:local
npm run d1:seed:local
```

Run a live feed parse check without writing D1:

```bash
cd lokana/worker
npm run collect:live
```

Run the Worker with local D1 and trigger protected collect:

```bash
cd lokana/worker
npm run d1:migrate:local
printf 'ADMIN_TOKEN=local-dev-token\n' > .dev.vars
npm run dev -- --ip 127.0.0.1
```

Then in another terminal:

```bash
curl -X POST http://127.0.0.1:8788/api/admin/collect \
  -H "X-Admin-Token: local-dev-token"
```

Admin operations:

```bash
curl http://127.0.0.1:8788/api/admin/status \
  -H "X-Admin-Token: local-dev-token"

curl "http://127.0.0.1:8788/api/admin/jobs?limit=10" \
  -H "X-Admin-Token: local-dev-token"

curl -X POST http://127.0.0.1:8788/api/admin/rebuild-snapshot \
  -H "X-Admin-Token: local-dev-token"
```

Remote smoke after deployment:

```bash
cd lokana/worker
WORKER_URL=https://lokana-api.<account>.workers.dev npm run smoke:remote

WORKER_URL=https://lokana-api.<account>.workers.dev \
ADMIN_TOKEN=your-production-admin-token \
RUN_COLLECT=1 \
RUN_REBUILD=1 \
npm run smoke:remote
```

The Worker serves `GET /health`, `GET /api/bootstrap`, `POST /api/admin/collect`, `GET /api/admin/status`, `GET /api/admin/jobs`, and `POST /api/admin/rebuild-snapshot`. Bootstrap reads the latest D1 snapshot first, then falls back to sample data when D1 is not configured or empty.

## API Contract

The app expects one bootstrap endpoint:

```text
GET /api/bootstrap
```

The response should include:

- `categories`
- `audienceLabels`
- `certaintyLabels`
- `directionLabels`
- `sources`
- `signals`
- `issues`
- `watchlists`
- `generatedAt`

The mock server in `api/mock-radar-server.js` returns the expected response shape for local integration testing.

The FastAPI backend serves the same contract and keeps the admin rebuild endpoint behind `X-Admin-Token`.

Round 3 stores the latest bootstrap payload as a persisted snapshot and reads that snapshot back on later requests.

Round 4 adds an official feed collector behind `POST /api/admin/collect`. The first verified feed set is:

- OpenAI News RSS: `https://openai.com/news/rss.xml`
- Hugging Face Blog RSS: `https://huggingface.co/blog/feed.xml`
- Google AI Blog RSS: `https://blog.google/technology/ai/rss/`

Round 5 clusters similar feed entries into issue-level records before the snapshot is written, so the frontend continues to consume the same bootstrap shape but sees more decision-ready issues instead of raw one-entry-per-issue output.

Round 6 adds admin operations visibility through `GET /api/admin/status` and `GET /api/admin/jobs`, plus warning-aware job statuses such as `completed_with_warnings` when a collect run only partially succeeds.

Round 7 adds deployment-ready artifacts for Render and a runtime-config hook for static hosting.

## Project Files

- `index.html`: app shell
- `styles.css`: responsive product UI
- `app.js`: rendering, state, API bootstrap, and interactions
- `backend/`: FastAPI app, SQLite snapshot store, RSS/Atom collector, and admin flows
- `worker/`: Cloudflare Worker and D1 path for the fully free hosting migration path
- `DESIGN.md`: Airbnb-inspired design system reference generated with `getdesign`
- `api/mock-radar-server.js`: dependency-free mock API

## Verification

The current version was checked with:

```bash
node --check app.js
node --check api/mock-radar-server.js
cd worker && npm run check
cd worker && npm run deploy:dry-run
```

Round 2 also verified:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/api/bootstrap
curl -X POST http://127.0.0.1:8787/api/admin/rebuild-snapshot -H "X-Admin-Token: localai-dev-admin-token"
```

Round 3 also verified:

```bash
backend/.venv/bin/python -m compileall backend/app
curl http://127.0.0.1:8787/api/bootstrap
curl -X POST http://127.0.0.1:8787/api/admin/rebuild-snapshot -H "X-Admin-Token: localai-dev-admin-token"
```

Round 4 also verified:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/collect -H "X-Admin-Token: localai-dev-admin-token"
curl http://127.0.0.1:8787/api/bootstrap
```

Round 5 also verified:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/collect -H "X-Admin-Token: localai-dev-admin-token"
curl http://127.0.0.1:8787/api/bootstrap
```

Round 6 also verified:

```bash
curl http://127.0.0.1:8787/api/admin/status -H "X-Admin-Token: localai-dev-admin-token"
curl "http://127.0.0.1:8787/api/admin/jobs?limit=10" -H "X-Admin-Token: localai-dev-admin-token"
```

Round 7 also verified:

```bash
bash scripts/build-static.sh
PYTHONPATH=backend backend/.venv/bin/python backend/scripts/backup_sqlite.py
```

Browser checks confirmed sample fallback, persisted FastAPI bootstrap replacement, and zero console errors in the successful frontend integration path.
