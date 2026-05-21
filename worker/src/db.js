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
