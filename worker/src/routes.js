import { buildSampleBootstrap } from "./bootstrap-data.js";
import { corsHeaders, preflightResponse } from "./cors.js";
import { hasD1, readLatestSnapshot } from "./db.js";

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

function adminNotReady(request, env) {
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: "not_implemented",
      message: "Cloudflare admin routes land in F4. F1 only serves health and bootstrap."
    },
    { status: 501 }
  );
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
    phase: "F2"
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

  if (url.pathname.startsWith("/api/admin/")) {
    return adminNotReady(request, env);
  }

  return notFound(request, env);
}
