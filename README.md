# AI Tech Radar KR

AI Tech Radar KR is a Korean-first prototype for tracking fast-moving AI technology signals as decision-ready issues instead of a raw news feed.

The current version is a dependency-free static web app with a mock API contract. It is designed so the UI can run on sample data first, then switch to a real backend through `GET /api/bootstrap`.

## What It Includes

- Today view for high-priority AI changes
- Role filters for developer, PM, leader, learner, and researcher perspectives
- Sorting by importance, velocity, practical value, and Korea relevance
- Issue cards with source grouping, certainty, risk, and action buttons
- Detail panel with summary, evidence, timeline, and action tabs
- Watchlist and question-style exploration panels
- API fallback behavior: sample data when no API is configured
- Mock API server for integration testing
- HTML product blueprint and API integration guide

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

See [ai-tech-radar-api-integration-guide.html](./ai-tech-radar-api-integration-guide.html) for the full contract and setup guidance.

## Project Files

- `index.html`: app shell
- `styles.css`: responsive product UI
- `app.js`: rendering, state, API bootstrap, and interactions
- `api/mock-radar-server.js`: dependency-free mock API
- `ai-tech-radar-kr-blueprint.html`: product blueprint
- `ai-tech-radar-api-integration-guide.html`: API connection guide

## Verification

The current version was checked with:

```bash
node --check app.js
node --check api/mock-radar-server.js
```

Browser checks confirmed sample fallback, mock API replacement, and zero console errors.
