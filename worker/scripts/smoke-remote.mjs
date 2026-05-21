const baseUrl = process.env.WORKER_URL || process.env.API_BASE_URL || "";
const adminToken = process.env.ADMIN_TOKEN || process.env.LOKANA_ADMIN_TOKEN || "";
const runCollect = process.env.RUN_COLLECT === "1";
const runRebuild = process.env.RUN_REBUILD === "1";
const expectD1 = process.env.EXPECT_D1 !== "0";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function endpoint(path) {
  assert(baseUrl, "Set WORKER_URL, for example WORKER_URL=https://lokana-api.<account>.workers.dev");
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function request(path, init = {}) {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function adminRequest(path, init = {}) {
  assert(adminToken, "Set ADMIN_TOKEN to run admin smoke checks.");
  return await request(path, {
    ...init,
    headers: {
      "X-Admin-Token": adminToken,
      ...(init.headers || {})
    }
  });
}

function countsFromBootstrap(payload) {
  return {
    sources: payload.sources?.length || 0,
    signals: payload.signals?.length || 0,
    issues: payload.issues?.length || 0,
    watchlists: payload.watchlists?.length || 0
  };
}

function assertBootstrapPayload(payload) {
  assert(payload && typeof payload === "object", "bootstrap should return an object");
  for (const key of ["categories", "audienceLabels", "certaintyLabels", "directionLabels"]) {
    assert(payload[key] && typeof payload[key] === "object", `bootstrap should include ${key}`);
  }
  for (const key of ["sources", "signals", "issues", "watchlists"]) {
    assert(Array.isArray(payload[key]), `bootstrap ${key} should be an array`);
  }
}

const summary = {
  baseUrl,
  runCollect,
  runRebuild,
  adminChecked: Boolean(adminToken)
};

const health = await request("/health");
assert(health.response.status === 200, `health expected 200, got ${health.response.status}`);
assert(health.body?.ok === true, "health should be ok");
assert(health.body?.service === "lokana-worker-api", "health should identify lokana-worker-api");
if (expectD1) {
  assert(health.body?.d1Configured === true, "health should report d1Configured=true");
}
summary.health = {
  phase: health.body.phase,
  storage: health.body.storage,
  d1Configured: health.body.d1Configured
};

const bootstrapBefore = await request("/api/bootstrap");
assert(bootstrapBefore.response.status === 200, `bootstrap expected 200, got ${bootstrapBefore.response.status}`);
assertBootstrapPayload(bootstrapBefore.body);
summary.bootstrapBefore = {
  generatedAt: bootstrapBefore.body.generatedAt,
  counts: countsFromBootstrap(bootstrapBefore.body),
  firstIssue: bootstrapBefore.body.issues?.[0]?.title || null
};

if (!adminToken) {
  summary.adminSkipped = "Set ADMIN_TOKEN plus RUN_COLLECT=1 and RUN_REBUILD=1 for full remote smoke.";
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const unauthorized = await request("/api/admin/status");
assert([401, 503].includes(unauthorized.response.status), "admin status without token should be protected");
summary.unauthorizedStatus = unauthorized.response.status;

let statusBefore = await adminRequest("/api/admin/status");
assert(statusBefore.response.status === 200, `admin status expected 200, got ${statusBefore.response.status}`);
summary.statusBefore = {
  tableCounts: statusBefore.body.tableCounts,
  latestSnapshot: statusBefore.body.latestSnapshot,
  latestJob: statusBefore.body.latestJob
    ? {
        kind: statusBefore.body.latestJob.kind,
        status: statusBefore.body.latestJob.status
      }
    : null
};

if (runCollect) {
  const collect = await adminRequest("/api/admin/collect", { method: "POST" });
  assert(collect.response.status === 200, `collect expected 200, got ${collect.response.status}`);
  assert(collect.body?.ok === true, "collect should be ok");
  assert((collect.body.counts?.issueCount || 0) > 0, "collect should create issues");
  summary.collect = {
    status: collect.body.status,
    counts: collect.body.counts,
    feeds: collect.body.collector?.feeds?.map((feed) => ({
      publisher: feed.publisher,
      status: feed.status,
      acceptedEntries: feed.acceptedEntries || 0
    }))
  };
}

const jobs = await adminRequest("/api/admin/jobs?limit=5");
assert(jobs.response.status === 200, `admin jobs expected 200, got ${jobs.response.status}`);
assert(Array.isArray(jobs.body?.jobs), "admin jobs should include jobs array");
summary.jobs = jobs.body.jobs.map((job) => ({
  kind: job.kind,
  status: job.status,
  summary: job.summary
}));

if (runRebuild) {
  const rebuild = await adminRequest("/api/admin/rebuild-snapshot", { method: "POST" });
  assert(rebuild.response.status === 200, `rebuild expected 200, got ${rebuild.response.status}`);
  assert(rebuild.body?.ok === true, "rebuild should be ok");
  assert((rebuild.body.counts?.issueCount || 0) > 0, "rebuild should preserve issues");
  summary.rebuild = {
    status: rebuild.body.status,
    counts: rebuild.body.counts
  };
}

statusBefore = await adminRequest("/api/admin/status");
assert(statusBefore.response.status === 200, "admin status after checks should return 200");
summary.statusAfter = {
  tableCounts: statusBefore.body.tableCounts,
  latestSnapshot: statusBefore.body.latestSnapshot,
  latestJob: statusBefore.body.latestJob
    ? {
        kind: statusBefore.body.latestJob.kind,
        status: statusBefore.body.latestJob.status
      }
    : null,
  latestCollect: statusBefore.body.latestCollect
    ? {
        status: statusBefore.body.latestCollect.status,
        summary: statusBefore.body.latestCollect.summary
      }
    : null,
  latestRebuild: statusBefore.body.latestRebuild
    ? {
        status: statusBefore.body.latestRebuild.status,
        summary: statusBefore.body.latestRebuild.summary
      }
    : null
};

const bootstrapAfter = await request("/api/bootstrap");
assert(bootstrapAfter.response.status === 200, "bootstrap after checks should return 200");
assertBootstrapPayload(bootstrapAfter.body);
if (runCollect || runRebuild) {
  assert((bootstrapAfter.body.issues?.length || 0) > 0, "bootstrap after collect/rebuild should include issues");
}
summary.bootstrapAfter = {
  generatedAt: bootstrapAfter.body.generatedAt,
  counts: countsFromBootstrap(bootstrapAfter.body),
  firstIssue: bootstrapAfter.body.issues?.[0]?.title || null
};

console.log(JSON.stringify(summary, null, 2));
