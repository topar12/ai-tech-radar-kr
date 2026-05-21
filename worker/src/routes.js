import { buildSampleBootstrap } from "./bootstrap-data.js";
import { collectJobStatus, collectOfficialFeedDataset } from "./collector.js";
import { corsHeaders, preflightResponse } from "./cors.js";
import {
  hasD1,
  persistCollectedSnapshot,
  persistFailedJob,
  readAdminJobs,
  readAdminStatus,
  readLatestSnapshot,
  rebuildSnapshotFromCurrentTables
} from "./db.js";

function utcNowIso() {
  return new Date().toISOString();
}

function jsonResponse(request, env, payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cacheControl || "no-store");

  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(JSON.stringify(payload, null, 2), {
    status: init.status || 200,
    headers
  });
}

function notFound(request, env) {
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: "not_found",
      message: "No Lokana Worker route matched this request."
    },
    { status: 404 }
  );
}

function adminNotReady(request, env, feature = "admin route") {
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: "not_implemented",
      message: `${feature} is not implemented.`
    },
    { status: 501 }
  );
}

async function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left || "")),
    crypto.subtle.digest("SHA-256", encoder.encode(right || ""))
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return diff === 0;
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return {
      ok: false,
      status: 503,
      payload: {
        ok: false,
        error: "admin_token_not_configured",
        message: "Set ADMIN_TOKEN as a Cloudflare Worker secret before running admin collect."
      }
    };
  }

  const providedToken = request.headers.get("X-Admin-Token") || "";
  if (!(await timingSafeEqual(providedToken, env.ADMIN_TOKEN))) {
    return {
      ok: false,
      status: 401,
      payload: {
        ok: false,
        error: "unauthorized",
        message: "Missing or invalid X-Admin-Token."
      }
    };
  }

  return { ok: true };
}

function health(request, env) {
  return jsonResponse(request, env, {
    ok: true,
    service: "lokana-worker-api",
    runtime: "cloudflare-worker",
    storage: hasD1(env) ? "d1" : "sample",
    generatedAt: utcNowIso(),
    corsConfigured: Boolean(env.CORS_ORIGINS),
    d1Configured: hasD1(env),
    phase: "F4"
  });
}

async function bootstrap(request, env) {
  const snapshot = await readLatestSnapshot(env);
  if (snapshot) {
    return jsonResponse(request, env, snapshot.payload, {
      headers: {
        "X-Lokana-Storage": "d1",
        "X-Lokana-Snapshot": snapshot.id || ""
      }
    });
  }

  return jsonResponse(request, env, buildSampleBootstrap(utcNowIso()), {
    headers: {
      "X-Lokana-Storage": "sample"
    }
  });
}

async function collect(request, env) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return jsonResponse(request, env, auth.payload, { status: auth.status });
  }

  if (!hasD1(env)) {
    return jsonResponse(
      request,
      env,
      {
        ok: false,
        error: "d1_not_configured",
        message: "D1 binding is required before collect can persist a snapshot."
      },
      { status: 503 }
    );
  }

  const generatedAt = utcNowIso();
  try {
    const collection = await collectOfficialFeedDataset({ env, fetchFn: fetch, generatedAt });
    const status = collectJobStatus(collection.details);
    const result = await persistCollectedSnapshot(env, collection, status);
    return jsonResponse(request, env, {
      ok: true,
      jobId: result.jobId,
      snapshotId: result.snapshotId,
      generatedAt: result.generatedAt,
      counts: result.counts,
      status: result.status,
      collector: result.details.collector,
      message: "Official RSS/Atom feeds collected and D1 snapshot rebuilt."
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "lokana.collect_failed",
        message: error instanceof Error ? error.message : String(error)
      })
    );
    const failedJob = await persistFailedJob(env, "collect_official_feeds", generatedAt, error).catch((jobError) => {
      console.warn(
        JSON.stringify({
          event: "lokana.collect_failed_job_write_failed",
          message: jobError instanceof Error ? jobError.message : String(jobError)
        })
      );
      return null;
    });
    return jsonResponse(
      request,
      env,
      {
        ok: false,
        error: "collect_failed",
        jobId: failedJob?.jobId || null,
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}

function d1NotConfigured(request, env) {
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: "d1_not_configured",
      message: "D1 binding is required for this admin route."
    },
    { status: 503 }
  );
}

async function adminGuard(request, env) {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return {
      ok: false,
      response: jsonResponse(request, env, auth.payload, { status: auth.status })
    };
  }

  if (!hasD1(env)) {
    return {
      ok: false,
      response: d1NotConfigured(request, env)
    };
  }

  return { ok: true };
}

function adminReadFailed(request, env, feature, error) {
  console.warn(
    JSON.stringify({
      event: `lokana.${feature}_failed`,
      message: error instanceof Error ? error.message : String(error)
    })
  );
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: `${feature}_failed`,
      message: error instanceof Error ? error.message : String(error)
    },
    { status: 502 }
  );
}

async function adminStatus(request, env) {
  const guard = await adminGuard(request, env);
  if (!guard.ok) return guard.response;

  try {
    return jsonResponse(request, env, {
      ok: true,
      ...(await readAdminStatus(env))
    });
  } catch (error) {
    return adminReadFailed(request, env, "admin_status", error);
  }
}

async function adminJobs(request, env, url) {
  const guard = await adminGuard(request, env);
  if (!guard.ok) return guard.response;

  try {
    const jobs = await readAdminJobs(env, url.searchParams.get("limit"));
    return jsonResponse(request, env, {
      ok: true,
      jobs,
      count: jobs.length
    });
  } catch (error) {
    return adminReadFailed(request, env, "admin_jobs", error);
  }
}

async function rebuildSnapshot(request, env) {
  const guard = await adminGuard(request, env);
  if (!guard.ok) return guard.response;

  try {
    const result = await rebuildSnapshotFromCurrentTables(env, utcNowIso());
    return jsonResponse(request, env, {
      ok: true,
      jobId: result.jobId,
      snapshotId: result.snapshotId,
      generatedAt: result.generatedAt,
      counts: result.counts,
      status: result.status,
      message: "D1 snapshot rebuilt from current tables."
    });
  } catch (error) {
    return adminReadFailed(request, env, "rebuild_snapshot", error);
  }
}

export async function handleRequest(request, env = {}) {
  if (request.method === "OPTIONS") {
    return preflightResponse(request, env);
  }

  const url = new URL(request.url);
  const routeKey = `${request.method} ${url.pathname}`;

  if (routeKey === "GET /health") {
    return health(request, env);
  }

  if (routeKey === "GET /api/bootstrap") {
    return await bootstrap(request, env);
  }

  if (routeKey === "POST /api/admin/collect") {
    return await collect(request, env);
  }

  if (routeKey === "GET /api/admin/status") {
    return await adminStatus(request, env);
  }

  if (routeKey === "GET /api/admin/jobs") {
    return await adminJobs(request, env, url);
  }

  if (routeKey === "POST /api/admin/rebuild-snapshot") {
    return await rebuildSnapshot(request, env);
  }

  if (url.pathname.startsWith("/api/admin/")) {
    return adminNotReady(request, env, url.pathname);
  }

  return notFound(request, env);
}
