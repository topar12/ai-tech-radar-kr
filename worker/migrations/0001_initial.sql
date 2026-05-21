CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  publisher TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  reliability INTEGER NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  certainty TEXT NOT NULL,
  importance INTEGER NOT NULL,
  velocity INTEGER NOT NULL,
  practical_value INTEGER NOT NULL,
  korea_relevance INTEGER NOT NULL,
  risk INTEGER NOT NULL,
  direction TEXT NOT NULL,
  audiences_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  signal_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  timeline_json TEXT NOT NULL,
  validation_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  strength INTEGER NOT NULL,
  velocity INTEGER NOT NULL,
  evidence_text TEXT NOT NULL,
  FOREIGN KEY(issue_id) REFERENCES issues(id),
  FOREIGN KEY(source_id) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  query_text TEXT NOT NULL,
  issue_ids_json TEXT NOT NULL,
  change_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  signal_count INTEGER NOT NULL,
  issue_count INTEGER NOT NULL,
  watchlist_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  snapshot_id TEXT,
  details_json TEXT NOT NULL,
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_generated_at ON snapshots(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_started_at ON jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_issue_id ON signals(issue_id);
CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
