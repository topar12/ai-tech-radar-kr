import worker from "../src/index.js";
import { buildSampleBootstrap } from "../src/bootstrap-data.js";

const generatedAt = "2026-05-21T12:00:00Z";
const payload = buildSampleBootstrap(generatedAt);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function rowPayload(sourcePayload) {
  return {
    sources: sourcePayload.sources.map((source) => ({
      id: source.id,
      type: source.type,
      publisher: source.publisher,
      title: source.title,
      url: source.url,
      reliability: source.reliability,
      published_at: source.publishedAt
    })),
    signals: sourcePayload.signals.map((signal) => ({
      id: signal.id,
      issue_id: signal.issueId,
      source_id: signal.sourceId,
      type: signal.type,
      title: signal.title,
      strength: signal.strength,
      velocity: signal.velocity,
      evidence_text: signal.evidenceText
    })),
    issues: sourcePayload.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      conclusion: issue.conclusion,
      categories_json: JSON.stringify(issue.categories),
      tags_json: JSON.stringify(issue.tags),
      certainty: issue.certainty,
      importance: issue.importance,
      velocity: issue.velocity,
      practical_value: issue.practicalValue,
      korea_relevance: issue.koreaRelevance,
      risk: issue.risk,
      direction: issue.direction,
      audiences_json: JSON.stringify(issue.audiences),
      source_ids_json: JSON.stringify(issue.sourceIds),
      signal_ids_json: JSON.stringify(issue.signalIds),
      updated_at: issue.updatedAt,
      summary_json: JSON.stringify(issue.summary),
      timeline_json: JSON.stringify(issue.timeline),
      validation_json: JSON.stringify(issue.validation)
    })),
    watchlists: sourcePayload.watchlists.map((watchlist) => ({
      id: watchlist.id,
      label: watchlist.label,
      kind: watchlist.kind,
      query_text: watchlist.query,
      issue_ids_json: JSON.stringify(watchlist.issueIds),
      change_text: watchlist.change
    }))
  };
}

function createFakeD1(sourcePayload) {
  const tables = rowPayload(sourcePayload);
  const snapshots = [
    {
      id: "snapshot-smoke-initial",
      generated_at: sourcePayload.generatedAt,
      payload_json: JSON.stringify(sourcePayload),
      source_count: sourcePayload.sources.length,
      signal_count: sourcePayload.signals.length,
      issue_count: sourcePayload.issues.length,
      watchlist_count: sourcePayload.watchlists.length,
      created_at: sourcePayload.generatedAt
    }
  ];
  const jobs = [
    {
      id: "job-smoke-collect",
      kind: "collect_official_feeds",
      status: "completed",
      started_at: sourcePayload.generatedAt,
      finished_at: sourcePayload.generatedAt,
      snapshot_id: "snapshot-smoke-initial",
      details_json: JSON.stringify({
        generatedAt: sourcePayload.generatedAt,
        counts: {
          sourceCount: sourcePayload.sources.length,
          signalCount: sourcePayload.signals.length,
          issueCount: sourcePayload.issues.length,
          watchlistCount: sourcePayload.watchlists.length
        },
        collector: {
          feeds: [
            {
              id: "smoke-feed",
              publisher: "Smoke",
              status: "completed",
              acceptedEntries: 1
            }
          ],
          rawEntryCount: 1,
          clusteredIssueCount: 1,
          multiSourceIssueCount: 0
        }
      })
    }
  ];

  function latestSnapshot() {
    return [...snapshots].sort((left, right) => right.generated_at.localeCompare(left.generated_at) || right.id.localeCompare(left.id))[0];
  }

  function countFor(sql) {
    const table = sql.match(/FROM\s+(\w+)/i)?.[1];
    const counts = {
      sources: tables.sources.length,
      signals: tables.signals.length,
      issues: tables.issues.length,
      watchlists: tables.watchlists.length,
      snapshots: snapshots.length,
      jobs: jobs.length
    };
    return { count: counts[table] || 0 };
  }

  function rowsFor(sql, values) {
    if (/FROM\s+sources/i.test(sql)) return tables.sources;
    if (/FROM\s+signals/i.test(sql)) return tables.signals;
    if (/FROM\s+issues/i.test(sql)) return tables.issues;
    if (/FROM\s+watchlists/i.test(sql)) return tables.watchlists;
    if (/FROM\s+jobs/i.test(sql)) {
      const limit = Number(values[0] || 20);
      return [...jobs].sort((left, right) => right.started_at.localeCompare(left.started_at) || right.id.localeCompare(left.id)).slice(0, limit);
    }
    return [];
  }

  function runStatement(sql, values) {
    if (/INSERT INTO snapshots/i.test(sql)) {
      snapshots.push({
        id: values[0],
        generated_at: values[1],
        payload_json: values[2],
        source_count: values[3],
        signal_count: values[4],
        issue_count: values[5],
        watchlist_count: values[6],
        created_at: values[7]
      });
    }
    if (/INSERT INTO jobs/i.test(sql)) {
      jobs.push({
        id: values[0],
        kind: values[1],
        status: values[2],
        started_at: values[3],
        finished_at: values[4],
        snapshot_id: values[5],
        details_json: values[6]
      });
    }
    return { success: true };
  }

  return {
    state: { tables, snapshots, jobs },
    prepare(sql) {
      return {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          if (/COUNT\(\*\)\s+AS\s+count/i.test(sql)) return countFor(sql);
          if (/FROM\s+snapshots/i.test(sql)) return latestSnapshot() || null;
          return rowsFor(sql, this.values)[0] || null;
        },
        async all() {
          return { results: rowsFor(sql, this.values) };
        },
        async run() {
          return runStatement(sql, this.values);
        }
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
      return statements.map(() => ({ success: true }));
    }
  };
}

async function request(path, init = {}, targetEnv) {
  const response = await worker.fetch(
    new Request(`https://api.lokana.kr${path}`, {
      ...init,
      headers: {
        Origin: "http://127.0.0.1:8765",
        "X-Admin-Token": "local-token",
        ...(init.headers || {})
      }
    }),
    targetEnv,
    {}
  );
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

const DB = createFakeD1(payload);
const env = {
  CORS_ORIGINS: "http://127.0.0.1:8765,http://localhost:8765,https://lokana.kr",
  ADMIN_TOKEN: "local-token",
  DB
};

const status = await request("/api/admin/status", {}, env);
assert(status.response.status === 200, "admin status should return 200");
assert(status.body.ok === true, "admin status should be ok");
assert(status.body.tableCounts.sources === payload.sources.length, "admin status should include source count");
assert(status.body.latestSnapshot.id === "snapshot-smoke-initial", "admin status should include latest snapshot");
assert(status.body.latestCollect.id === "job-smoke-collect", "admin status should include latest collect");

const jobs = await request("/api/admin/jobs?limit=1", {}, env);
assert(jobs.response.status === 200, "admin jobs should return 200");
assert(jobs.body.count === 1, "admin jobs should respect limit");
assert(jobs.body.jobs[0].summary.feedCount === 1, "admin jobs should summarize collect details");

const rebuild = await request("/api/admin/rebuild-snapshot", { method: "POST" }, env);
assert(rebuild.response.status === 200, "admin rebuild should return 200");
assert(rebuild.body.status === "completed", "admin rebuild should complete");
assert(DB.state.snapshots.length === 2, "admin rebuild should insert a new snapshot");
assert(DB.state.jobs.some((job) => job.kind === "rebuild_snapshot"), "admin rebuild should insert a job");

console.log("Lokana Worker F4 admin smoke passed.");
