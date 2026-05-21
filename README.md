# AI Tech Radar KR

AI Tech Radar KR is a Korean-first prototype for tracking fast-moving AI technology signals as decision-ready issues instead of a raw news feed.

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

## Run The Static App

```bash
cd ai-tech-radar-kr
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/index.html
```

## Test With The Mock API

Start the mock API:

```bash
cd ai-tech-radar-kr
node api/mock-radar-server.js
```

Start the static server in another terminal:

```bash
cd ai-tech-radar-kr
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
cd ai-tech-radar-kr
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

Start the backend:

```bash
cd ai-tech-radar-kr
ADMIN_TOKEN=localai-dev-admin-token backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8787
```

The first backend request creates a local SQLite database at `backend/data/localai-radar.sqlite3`. To override it in Round 3, use a `sqlite:///...` style `DATABASE_URL`.

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

Round 7 adds repo-native deployment artifacts for a simple two-service setup:

- `render.yaml`: Render Blueprint for the backend web service and the static frontend
- `runtime-config.js`: frontend runtime hook for the API base URL
- `scripts/build-static.sh`: static build script that injects `RADAR_API_BASE_URL`
- `backend/.env.example`: local and production env reference
- `backend/scripts/backup_sqlite.py`: SQLite backup helper

### Recommended deployment shape

1. Deploy the backend web service on Render with the persistent disk in `render.yaml`.
2. Set these backend environment variables before the first production collect:
   - `ADMIN_TOKEN`
   - `CORS_ORIGINS`
   - optional later: `GITHUB_TOKEN`, `HF_TOKEN`
3. Deploy the static frontend service on Render from the same repo.
4. Set `RADAR_API_BASE_URL` on the static site to your backend public URL and redeploy the static site.

The backend uses SQLite today, so the persistent disk is intentional. That keeps data across deploys, but it also means the backend is not yet on a multi-instance database setup and should be treated as a single-instance deployment target.

### Render backend values

`render.yaml` already sets:

- `DATABASE_URL=sqlite:////var/data/localai-radar.sqlite3`
- `COLLECTOR_TIMEOUT_SECONDS=15`
- `COLLECTOR_MAX_ITEMS_PER_FEED=4`
- `SSL_CERT_FILE=/etc/ssl/cert.pem`

You still need to set:

- `ADMIN_TOKEN`
- `CORS_ORIGINS`

### Frontend runtime config

The frontend now loads `runtime-config.js` before `app.js`.

Local default:

```js
window.RADAR_API_BASE_URL = window.RADAR_API_BASE_URL || "";
```

Render static builds overwrite that file in `dist/` using `RADAR_API_BASE_URL`. If it is empty, the app falls back to sample data.

### GitHub Pages fallback

If you do not want to host the frontend on Render, this repo can also be published as a static site from GitHub Pages. In that case the simplest path is:

1. Publish the repository root from the `main` branch.
2. Use `?api=https://your-backend-domain` in the URL, or edit `runtime-config.js` for a fixed frontend deployment target.

### Backup

Create a timestamped backup of the SQLite file:

```bash
cd ai-tech-radar-kr
PYTHONPATH=backend backend/.venv/bin/python backend/scripts/backup_sqlite.py
```

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
- `DESIGN.md`: Airbnb-inspired design system reference generated with `getdesign`
- `api/mock-radar-server.js`: dependency-free mock API

## Verification

The current version was checked with:

```bash
node --check app.js
node --check api/mock-radar-server.js
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
