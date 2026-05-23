import { buildBootstrapLabels } from "./bootstrap-data.js";

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

export async function readLatestSnapshot(env = {}) {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    return null;
  }

  let row;
  try {
    row = await env.DB
      .prepare(
        `SELECT id, generated_at, payload_json
         FROM snapshots
         ORDER BY generated_at DESC, created_at DESC, id DESC
         LIMIT 1`
      )
      .first();
  } catch (error) {
    console.warn(JSON.stringify({
      event: "lokana.d1_snapshot_read_failed",
      message: error instanceof Error ? error.message : String(error)
    }));
    return null;
  }

  if (!row?.payload_json) {
    return null;
  }

  return {
    id: row.id,
    generatedAt: row.generated_at,
    payload: JSON.parse(row.payload_json)
  };
}

export function hasD1(env = {}) {
  return Boolean(env.DB && typeof env.DB.prepare === "function");
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}-${hex}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function jsonValue(value) {
  return JSON.stringify(value ?? null);
}

function datasetCounts(payload) {
  return {
    sourceCount: payload.sources.length,
    signalCount: payload.signals.length,
    issueCount: payload.issues.length,
    watchlistCount: payload.watchlists.length
  };
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function snapshotMetadata(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    generatedAt: row.generated_at,
    counts: {
      sourceCount: Number(row.source_count || 0),
      signalCount: Number(row.signal_count || 0),
      issueCount: Number(row.issue_count || 0),
      watchlistCount: Number(row.watchlist_count || 0)
    },
    createdAt: row.created_at
  };
}

function summarizeJobDetails(jobKind, details) {
  const summary = {};
  if (details.counts && typeof details.counts === "object") {
    summary.counts = details.counts;
  }

  const collector = details.collector;
  const summarizer = details.summarizer || collector?.summarizer || null;
  if (jobKind === "collect_official_feeds" && collector && typeof collector === "object") {
    const feeds = Array.isArray(collector.feeds) ? collector.feeds : [];
    const failedFeeds = feeds
      .filter((feed) => feed && feed.status !== "completed")
      .map((feed) => feed.publisher || feed.id || "unknown");
    const emptyFeeds = feeds
      .filter((feed) => feed && feed.status === "completed" && Number(feed.acceptedEntries || 0) === 0)
      .map((feed) => feed.publisher || feed.id || "unknown");

    summary.feedCount = feeds.length;
    summary.failedFeedCount = failedFeeds.length;
    summary.emptyFeedCount = emptyFeeds.length;
    if (failedFeeds.length) summary.failedFeeds = failedFeeds;
    if (emptyFeeds.length) summary.emptyFeeds = emptyFeeds;

    for (const key of ["rawEntryCount", "clusteredIssueCount", "multiSourceIssueCount"]) {
      if (key in collector) {
        summary[key] = collector[key];
      }
    }
  }

  if (details.rebuiltFrom) {
    summary.rebuiltFrom = details.rebuiltFrom;
  }
  if (summarizer && typeof summarizer === "object") {
    if (summarizer.provider) summary.summaryProvider = summarizer.provider;
    if (summarizer.model) summary.summaryModel = summarizer.model;
    if (summarizer.status) summary.summaryStatus = summarizer.status;
    if (typeof summarizer.summarizedIssueCount === "number") {
      summary.summarizedIssueCount = summarizer.summarizedIssueCount;
    }
    if (summarizer.error) summary.summaryError = summarizer.error;
  }
  if (details.error) {
    summary.error = details.error;
  }

  return summary;
}

function jobFromRow(row) {
  const details = parseJsonValue(row.details_json, {});
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at || null,
    snapshotId: row.snapshot_id || null,
    summary: summarizeJobDetails(row.kind, details),
    details
  };
}

async function runBatch(env, statements) {
  if (typeof env.DB.batch === "function") {
    return await env.DB.batch(statements);
  }

  const results = [];
  for (const statement of statements) {
    results.push(await statement.run());
  }
  return results;
}

export async function persistCollectedSnapshot(env, collection, jobStatus = "completed") {
  if (!hasD1(env)) {
    throw new Error("D1 binding is not configured.");
  }

  const generatedAt = collection.generatedAt || new Date().toISOString();
  const snapshotId = randomId("snapshot");
  const jobId = randomId("job");
  const payload = collection.payload;
  const counts = datasetCounts(payload);
  const details = {
    generatedAt,
    counts,
    collector: collection.details
  };
  const statements = [
    env.DB.prepare("DELETE FROM watchlists"),
    env.DB.prepare("DELETE FROM signals"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM sources")
  ];

  for (const source of payload.sources) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO sources (id, type, publisher, title, url, reliability, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(source.id, source.type, source.publisher, source.title, source.url, source.reliability, source.publishedAt)
    );
  }

  for (const issue of payload.issues) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO issues (
           id, title, conclusion, categories_json, tags_json, certainty,
           importance, velocity, practical_value, korea_relevance, risk, direction,
           audiences_json, source_ids_json, signal_ids_json, updated_at,
           summary_json, timeline_json, validation_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        issue.id,
        issue.title,
        issue.conclusion,
        jsonValue(issue.categories),
        jsonValue(issue.tags),
        issue.certainty,
        issue.importance,
        issue.velocity,
        issue.practicalValue,
        issue.koreaRelevance,
        issue.risk,
        issue.direction,
        jsonValue(issue.audiences),
        jsonValue(issue.sourceIds),
        jsonValue(issue.signalIds),
        issue.updatedAt,
        jsonValue(issue.summary),
        jsonValue(issue.timeline),
        jsonValue(issue.validation)
      )
    );
  }

  for (const signal of payload.signals) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO signals (id, issue_id, source_id, type, title, strength, velocity, evidence_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(signal.id, signal.issueId, signal.sourceId, signal.type, signal.title, signal.strength, signal.velocity, signal.evidenceText)
    );
  }

  for (const watchlist of payload.watchlists) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO watchlists (id, label, kind, query_text, issue_ids_json, change_text)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(watchlist.id, watchlist.label, watchlist.kind, watchlist.query, jsonValue(watchlist.issueIds), watchlist.change)
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO snapshots (
         id, generated_at, payload_json, source_count, signal_count, issue_count, watchlist_count, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      snapshotId,
      generatedAt,
      JSON.stringify(payload),
      counts.sourceCount,
      counts.signalCount,
      counts.issueCount,
      counts.watchlistCount,
      generatedAt
    )
  );

  statements.push(
    env.DB.prepare(
      `INSERT INTO jobs (id, kind, status, started_at, finished_at, snapshot_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(jobId, "collect_official_feeds", jobStatus, generatedAt, generatedAt, snapshotId, jsonValue(details))
  );

  await runBatch(env, statements);

  return {
    jobId,
    snapshotId,
    generatedAt,
    counts,
    payload,
    details,
    status: jobStatus
  };
}

export async function persistFailedJob(env, kind, startedAt, error) {
  if (!hasD1(env)) {
    return null;
  }

  const jobId = randomId("job");
  const finishedAt = new Date().toISOString();
  const details = {
    generatedAt: startedAt,
    error: error instanceof Error ? error.message : String(error)
  };

  await env.DB
    .prepare(
      `INSERT INTO jobs (id, kind, status, started_at, finished_at, snapshot_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(jobId, kind, "failed", startedAt, finishedAt, null, jsonValue(details))
    .run();

  return {
    jobId,
    status: "failed",
    details
  };
}

export async function readTableCounts(env) {
  const tableNames = ["sources", "signals", "issues", "watchlists", "snapshots", "jobs"];
  const counts = {};

  for (const tableName of tableNames) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).first();
    counts[tableName] = Number(row?.count || 0);
  }

  return counts;
}

export async function readLatestSnapshotMetadata(env) {
  const row = await env.DB
    .prepare(
      `SELECT id, generated_at, source_count, signal_count, issue_count, watchlist_count, created_at
       FROM snapshots
       ORDER BY generated_at DESC, created_at DESC, id DESC
       LIMIT 1`
    )
    .first();
  return snapshotMetadata(row);
}

export async function readAdminJobs(env, limit = 20) {
  const safeLimit = clamp(Number(limit) || 20, 1, 50);
  const result = await env.DB
    .prepare(
      `SELECT id, kind, status, started_at, finished_at, snapshot_id, details_json
       FROM jobs
       ORDER BY started_at DESC, id DESC
       LIMIT ?`
    )
    .bind(safeLimit)
    .all();

  return (result.results || []).map(jobFromRow);
}

export async function readAdminStatus(env) {
  const recentJobs = await readAdminJobs(env, 10);
  return {
    tableCounts: await readTableCounts(env),
    latestSnapshot: await readLatestSnapshotMetadata(env),
    latestJob: recentJobs[0] || null,
    latestCollect: recentJobs.find((job) => job.kind === "collect_official_feeds") || null,
    latestRebuild: recentJobs.find((job) => job.kind === "rebuild_snapshot") || null,
    recentJobs
  };
}

async function readCurrentTablesAsPayload(env, generatedAt) {
  const sourceResult = await env.DB
    .prepare(
      `SELECT id, type, publisher, title, url, reliability, published_at
       FROM sources
       ORDER BY published_at DESC, id DESC`
    )
    .all();
  const signalResult = await env.DB
    .prepare(
      `SELECT id, issue_id, source_id, type, title, strength, velocity, evidence_text
       FROM signals
       ORDER BY strength DESC, velocity DESC, id DESC`
    )
    .all();
  const issueResult = await env.DB
    .prepare(
      `SELECT
         id, title, conclusion, categories_json, tags_json, certainty,
         importance, velocity, practical_value, korea_relevance, risk, direction,
         audiences_json, source_ids_json, signal_ids_json, updated_at,
         summary_json, timeline_json, validation_json
       FROM issues
       ORDER BY importance DESC, velocity DESC, updated_at DESC, id DESC`
    )
    .all();
  const watchlistResult = await env.DB
    .prepare(
      `SELECT id, label, kind, query_text, issue_ids_json, change_text
       FROM watchlists
       ORDER BY id ASC`
    )
    .all();

  const sources = (sourceResult.results || []).map((row) => ({
    id: row.id,
    type: row.type,
    publisher: row.publisher,
    title: row.title,
    url: row.url,
    reliability: Number(row.reliability || 0),
    publishedAt: row.published_at
  }));
  const signals = (signalResult.results || []).map((row) => ({
    id: row.id,
    issueId: row.issue_id,
    sourceId: row.source_id,
    type: row.type,
    title: row.title,
    strength: Number(row.strength || 0),
    velocity: Number(row.velocity || 0),
    evidenceText: row.evidence_text
  }));
  const issues = (issueResult.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    conclusion: row.conclusion,
    categories: parseJsonValue(row.categories_json, []),
    tags: parseJsonValue(row.tags_json, []),
    certainty: row.certainty,
    importance: Number(row.importance || 0),
    velocity: Number(row.velocity || 0),
    practicalValue: Number(row.practical_value || 0),
    koreaRelevance: Number(row.korea_relevance || 0),
    risk: Number(row.risk || 0),
    direction: row.direction,
    audiences: parseJsonValue(row.audiences_json, []),
    sourceIds: parseJsonValue(row.source_ids_json, []),
    signalIds: parseJsonValue(row.signal_ids_json, []),
    updatedAt: row.updated_at,
    summary: parseJsonValue(row.summary_json, {}),
    timeline: parseJsonValue(row.timeline_json, []),
    validation: parseJsonValue(row.validation_json, [])
  }));
  const watchlists = (watchlistResult.results || []).map((row) => ({
    id: row.id,
    label: row.label,
    kind: row.kind,
    query: row.query_text,
    issueIds: parseJsonValue(row.issue_ids_json, []),
    change: row.change_text
  }));

  return {
    ...buildBootstrapLabels(),
    sources,
    signals,
    issues,
    watchlists,
    generatedAt
  };
}

export async function rebuildSnapshotFromCurrentTables(env, generatedAt = new Date().toISOString()) {
  if (!hasD1(env)) {
    throw new Error("D1 binding is not configured.");
  }

  const jobId = randomId("job");
  try {
    const payload = await readCurrentTablesAsPayload(env, generatedAt);
    if (!payload.issues.length) {
      throw new Error("Cannot rebuild snapshot without current issues. Run collect first.");
    }

    const snapshotId = randomId("snapshot");
    const counts = datasetCounts(payload);
    const details = {
      generatedAt,
      counts,
      rebuiltFrom: "current_tables"
    };
    await runBatch(env, [
      env.DB
        .prepare(
          `INSERT INTO snapshots (
             id, generated_at, payload_json, source_count, signal_count, issue_count, watchlist_count, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          snapshotId,
          generatedAt,
          JSON.stringify(payload),
          counts.sourceCount,
          counts.signalCount,
          counts.issueCount,
          counts.watchlistCount,
          generatedAt
        ),
      env.DB
        .prepare(
          `INSERT INTO jobs (id, kind, status, started_at, finished_at, snapshot_id, details_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(jobId, "rebuild_snapshot", "completed", generatedAt, generatedAt, snapshotId, jsonValue(details))
    ]);

    return {
      jobId,
      snapshotId,
      generatedAt,
      counts,
      payload,
      details,
      status: "completed"
    };
  } catch (error) {
    await persistFailedJob(env, "rebuild_snapshot", generatedAt, error).catch((failure) => {
      console.warn(
        JSON.stringify({
          event: "lokana.rebuild_failed_job_write_failed",
          message: failure instanceof Error ? failure.message : String(failure)
        })
      );
    });
    throw error;
  }
}
