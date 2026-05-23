# Lokana

Lokana is a Korean-first AI tech radar for tracking fast-moving AI signals as decision-ready issues instead of a raw news feed.

The active production stack is Cloudflare Pages for the static frontend, Cloudflare Workers for the API, Cloudflare D1 for the snapshot store, and a Worker Cron Trigger for scheduled collection.

## Production

- Frontend: `https://lokana.kr`
- API: `https://api.lokana.kr`
- Worker fallback: `https://lokana-api.ttoparr12.workers.dev`
- Production branch: `main`
- Pages deploy method: GitHub Actions direct upload to the existing `lokana` Pages project
- Pages build command in CI: `npm run build`
- Pages build output directory in CI: `dist`
- Worker schedule: `0 */6 * * *`

## What It Includes

- Static product UI with sample-data fallback
- Static admin console at `/admin.html`
- Role filters for developer, PM, leader, learner, and researcher perspectives
- Issue cards with source grouping, certainty, risk, evidence, timeline, and action tabs
- Watchlist and question-style exploration panels
- Cloudflare Worker API with D1 latest-snapshot reads
- Protected official RSS/Atom collection
- Optional Xiaomi MiMo `mimo-v2.5` summary refinement for clustered issues
- Admin status, jobs, collect, and manual rebuild endpoints
- Six-hour Cron collection
- Dependency-free mock API for local frontend testing
- Legacy FastAPI backend kept only as a local development/reference implementation

## Architecture

```text
https://lokana.kr
  Cloudflare Pages
  static files from dist/
  runtime-config.js -> https://api.lokana.kr

https://api.lokana.kr
  Cloudflare Worker: worker/src/index.js
  D1 binding: lokana-prod
  Cron: 0 */6 * * *
```

User requests read the latest prebuilt snapshot. RSS/Atom collection runs through protected admin endpoints or the scheduled Worker, not during normal page loads.

## Local Frontend

```bash
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html
```

To point the local frontend at production:

```text
http://127.0.0.1:8765/index.html?api=https://api.lokana.kr
```

Admin console:

```text
http://127.0.0.1:8765/admin.html?api=https://api.lokana.kr
```

Use the same `ADMIN_TOKEN` that is configured on the Cloudflare Worker. The admin console keeps the token in memory by default; if you enable "이 탭에서만 토큰 기억", it uses `sessionStorage` only for the current browser tab.

## Mock API

```bash
node api/mock-radar-server.js
```

Then open:

```text
http://127.0.0.1:8765/index.html?api=http://127.0.0.1:8787
```

## Static Build

Cloudflare Pages should run this from the repository root:

```bash
npm run build
```

For local production-like builds:

```bash
LOKANA_API_BASE_URL=https://api.lokana.kr npm run build
```

The build writes `dist/` and injects `dist/runtime-config.js`.

## Cloudflare Pages Auto Deploy

The existing Pages project `lokana` was created by Wrangler Direct Upload. Cloudflare Direct Upload projects cannot be switched to native Git integration later, so automatic deploys use GitHub Actions plus Wrangler.

Workflow:

```text
.github/workflows/deploy-pages.yml
```

GitHub repository secrets required:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The API token needs Cloudflare Pages edit permission on the account. If the secrets are missing, the workflow exits cleanly and skips deployment.

The workflow runs on pushes to `main` and performs:

```bash
npm run build
npx wrangler pages deploy dist --project-name=lokana --branch=main
```

If you want native Cloudflare Git integration instead, create a new Pages project from GitHub rather than reusing the current Direct Upload project.

## Cloudflare Worker API

```bash
cd worker
npm run check
npm run deploy:dry-run
```

Deploy:

```bash
cd worker
npm run deploy
```

Remote smoke:

```bash
cd worker
WORKER_URL=https://api.lokana.kr npm run smoke:remote
```

Full admin smoke:

```bash
cd worker
set -a
. ./.dev.vars
set +a
WORKER_URL=https://api.lokana.kr RUN_COLLECT=1 RUN_REBUILD=1 npm run smoke:remote
```

`worker/.dev.vars` contains the local copy of `ADMIN_TOKEN`. It is ignored by git and must never be committed.

## API Contract

```text
GET  /health
GET  /api/bootstrap
POST /api/admin/collect
POST /api/admin/rebuild-snapshot
GET  /api/admin/status
GET  /api/admin/jobs?limit=10
```

Admin endpoints require `X-Admin-Token`.

`GET /api/bootstrap` returns:

- `categories`
- `audienceLabels`
- `certaintyLabels`
- `directionLabels`
- `sources`
- `signals`
- `issues`
- `watchlists`
- `generatedAt`

## Repository Map

- `index.html`: static app shell
- `styles.css`: responsive product UI
- `app.js`: rendering, state, API bootstrap, and interactions
- `admin.html`: static admin console shell
- `admin.css`: admin console layout and states
- `admin.js`: admin API checks, protected actions, and result rendering
- `runtime-config.js`: local default API config
- `scripts/build-static.sh`: Pages build script
- `scripts/smoke-production.sh`: production smoke helper
- `api/mock-radar-server.js`: local mock API
- `worker/`: active Cloudflare Worker/D1 API
- `backend/`: legacy FastAPI/SQLite reference only
- `DESIGN.md`: Airbnb-inspired design system reference generated with `getdesign`

## Legacy FastAPI Reference

The FastAPI backend is no longer a production deployment path. Render deployment has been removed. Keep `backend/` only for local comparison or for borrowing collector/data-shaping ideas while the Worker path remains the source of truth.

Run it locally only when needed:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
ADMIN_TOKEN=localai-dev-admin-token backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8787
```

## Verification

```bash
npm run check
LOKANA_API_BASE_URL=https://api.lokana.kr npm run build
cd worker && npm run deploy:dry-run
```
