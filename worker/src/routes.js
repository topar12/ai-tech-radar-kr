import { buildSampleBootstrap } from "./bootstrap-data.js";
import { corsHeaders, preflightResponse } from "./cors.js";

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
    storage: "sample",
    generatedAt: utcNowIso(),
    corsConfigured: Boolean(env.CORS_ORIGINS),
    d1Configured: Boolean(env.DB),
    phase: "F1"
  });
}

function bootstrap(request, env) {
  return jsonResponse(request, env, buildSampleBootstrap(utcNowIso()));
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
    return bootstrap(request, env);
  }

  if (url.pathname.startsWith("/api/admin/")) {
    return adminNotReady(request, env);
  }

  return notFound(request, env);
}
