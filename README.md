# AI Tech Radar KR

AI Tech Radar KR is a Korean-first prototype for tracking fast-moving AI technology signals as decision-ready issues instead of a raw news feed.

The current version includes a static frontend, a FastAPI backend with a SQLite snapshot store, and a mock API. The UI can run on sample data first, then switch to a real backend through `GET /api/bootstrap`.

## What It Includes

- Today view for high-priority AI changes
- Role filters for developer, PM, leader, learner, and researcher perspectives
- Sorting by importance, velocity, practical value, and Korea relevance
- Issue cards with source grouping, certainty, risk, and action buttons
- Detail panel with summary, evidence, timeline, and action tabs
- Watchlist and question-style exploration panels
- API fallback behavior: sample data when no API is configured
- FastAPI backend with a SQLite-backed snapshot read model
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

Admin rebuild example:

```bash
curl -X POST http://127.0.0.1:8787/api/admin/rebuild-snapshot \
  -H "X-Admin-Token: localai-dev-admin-token"
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

## Project Files

- `index.html`: app shell
- `styles.css`: responsive product UI
- `app.js`: rendering, state, API bootstrap, and interactions
- `backend/`: FastAPI app, SQLite snapshot store, and admin rebuild flow
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

Browser checks confirmed sample fallback, persisted FastAPI bootstrap replacement, and zero console errors in the successful frontend integration path.
