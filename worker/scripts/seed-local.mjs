import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSampleBootstrap } from "../src/bootstrap-data.js";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return sqlString(JSON.stringify(value));
}

function issueRows(issue) {
  return [
    issue.id,
    issue.title,
    issue.conclusion,
    JSON.stringify(issue.categories),
    JSON.stringify(issue.tags),
    issue.certainty,
    issue.importance,
    issue.velocity,
    issue.practicalValue,
    issue.koreaRelevance,
    issue.risk,
    issue.direction,
    JSON.stringify(issue.audiences),
    JSON.stringify(issue.sourceIds),
    JSON.stringify(issue.signalIds),
    issue.updatedAt,
    JSON.stringify(issue.summary),
    JSON.stringify(issue.timeline),
    JSON.stringify(issue.validation)
  ];
}

function values(row) {
  return row
    .map((value) => (typeof value === "number" ? String(value) : sqlString(value)))
    .join(", ");
}

const generatedAt = new Date().toISOString();
const payload = buildSampleBootstrap(generatedAt);
payload.issues[0] = {
  ...payload.issues[0],
  title: "D1 snapshot을 읽는 Cloudflare Worker",
  conclusion: "Worker가 sample constant 대신 D1의 최신 snapshot 1행을 우선 읽는다.",
  summary: {
    ...payload.issues[0].summary,
    whatHappened: "D1 schema와 local seed helper가 추가되어 snapshot readback이 가능해졌다.",
    whyMatters: "무료 운영 구조에서 사용자 요청은 무거운 수집이 아니라 저장된 bootstrap snapshot만 읽게 된다.",
    nextAction: "F3에서 RSS collector를 Worker/D1 흐름에 붙인다."
  },
  timeline: [
    "F1 Worker API 골격 추가",
    "F2 D1 schema와 seed snapshot 추가",
    "F3 collector 포팅 예정"
  ],
  validation: [
    "D1 migration apply",
    "local seed snapshot insert",
    "GET /api/bootstrap D1 readback"
  ]
};
payload.signals[1] = {
  ...payload.signals[1],
  title: "D1 snapshots 테이블에서 bootstrap을 읽음",
  evidenceText: "latest snapshot 1행의 payload_json을 그대로 프론트 계약으로 반환한다."
};
payload.watchlists[0] = {
  ...payload.watchlists[0],
  change: "F2 D1 seed snapshot 준비"
};

const snapshotId = `snapshot-local-${generatedAt.replaceAll(/[:.]/g, "-")}`;
const jobId = `job-local-seed-${generatedAt.replaceAll(/[:.]/g, "-")}`;

const sql = [
  "PRAGMA foreign_keys = ON;",
  "DELETE FROM jobs;",
  "DELETE FROM snapshots;",
  "DELETE FROM watchlists;",
  "DELETE FROM signals;",
  "DELETE FROM issues;",
  "DELETE FROM sources;",
  ...payload.sources.map((source) => (
    `INSERT INTO sources (id, type, publisher, title, url, reliability, published_at) VALUES (${values([
      source.id,
      source.type,
      source.publisher,
      source.title,
      source.url,
      source.reliability,
      source.publishedAt
    ])});`
  )),
  ...payload.issues.map((issue) => (
    `INSERT INTO issues (
      id, title, conclusion, categories_json, tags_json, certainty, importance, velocity,
      practical_value, korea_relevance, risk, direction, audiences_json, source_ids_json,
      signal_ids_json, updated_at, summary_json, timeline_json, validation_json
    ) VALUES (${values(issueRows(issue))});`
  )),
  ...payload.signals.map((signal) => (
    `INSERT INTO signals (id, issue_id, source_id, type, title, strength, velocity, evidence_text) VALUES (${values([
      signal.id,
      signal.issueId,
      signal.sourceId,
      signal.type,
      signal.title,
      signal.strength,
      signal.velocity,
      signal.evidenceText
    ])});`
  )),
  ...payload.watchlists.map((watchlist) => (
    `INSERT INTO watchlists (id, label, kind, query_text, issue_ids_json, change_text) VALUES (${values([
      watchlist.id,
      watchlist.label,
      watchlist.kind,
      watchlist.query,
      JSON.stringify(watchlist.issueIds),
      watchlist.change
    ])});`
  )),
  `INSERT INTO snapshots (
    id, generated_at, payload_json, source_count, signal_count, issue_count, watchlist_count, created_at
  ) VALUES (
    ${sqlString(snapshotId)},
    ${sqlString(generatedAt)},
    ${jsonSql(payload)},
    ${payload.sources.length},
    ${payload.signals.length},
    ${payload.issues.length},
    ${payload.watchlists.length},
    ${sqlString(generatedAt)}
  );`,
  `INSERT INTO jobs (
    id, kind, status, started_at, finished_at, snapshot_id, details_json
  ) VALUES (
    ${sqlString(jobId)},
    'seed_local_snapshot',
    'completed',
    ${sqlString(generatedAt)},
    ${sqlString(generatedAt)},
    ${sqlString(snapshotId)},
    ${jsonSql({ source: "worker/scripts/seed-local.mjs", snapshotId })}
  );`
].join("\n");

const tempDir = mkdtempSync(join(tmpdir(), "lokana-d1-seed-"));
const seedPath = join(tempDir, "seed.sql");
writeFileSync(seedPath, sql);

try {
  execFileSync(
    "npx",
    ["wrangler@latest", "d1", "execute", "lokana-prod", "--local", "--config", "wrangler.jsonc", "--file", seedPath],
    { stdio: "inherit" }
  );
  console.log(`Seeded local D1 snapshot ${snapshotId}.`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
