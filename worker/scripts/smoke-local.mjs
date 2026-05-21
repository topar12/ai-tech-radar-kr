import worker from "../src/index.js";
import { buildSampleBootstrap } from "../src/bootstrap-data.js";

const env = {
  CORS_ORIGINS: "http://127.0.0.1:8765,http://localhost:8765,https://lokana.kr"
};

async function request(path, init = {}, targetEnv = env) {
  const response = await worker.fetch(
    new Request(`https://api.lokana.kr${path}`, {
      ...init,
      headers: {
        Origin: "http://127.0.0.1:8765",
        ...(init.headers || {})
      }
    }),
    targetEnv,
    {}
  );
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const health = await request("/health");
assert(health.response.status === 200, "health should return 200");
assert(health.body.ok === true, "health should be ok");
assert(health.body.service === "lokana-worker-api", "health should identify worker service");

const bootstrap = await request("/api/bootstrap");
assert(bootstrap.response.status === 200, "bootstrap should return 200");
assert(Array.isArray(bootstrap.body.sources), "bootstrap sources should be an array");
assert(Array.isArray(bootstrap.body.signals), "bootstrap signals should be an array");
assert(Array.isArray(bootstrap.body.issues), "bootstrap issues should be an array");
assert(Array.isArray(bootstrap.body.watchlists), "bootstrap watchlists should be an array");
assert(bootstrap.body.categories && typeof bootstrap.body.categories === "object", "bootstrap categories should exist");
assert(bootstrap.response.headers.get("Access-Control-Allow-Origin") === "http://127.0.0.1:8765", "CORS origin should be reflected for allowed local app");
assert(bootstrap.response.headers.get("X-Lokana-Storage") === "sample", "bootstrap without D1 should use sample fallback");

const d1Payload = buildSampleBootstrap("2026-05-21T12:00:00.000Z");
d1Payload.issues[0] = {
  ...d1Payload.issues[0],
  title: "D1 smoke snapshot"
};
const fakeD1 = {
  prepare() {
    return {
      async first() {
        return {
          id: "snapshot-smoke",
          generated_at: d1Payload.generatedAt,
          payload_json: JSON.stringify(d1Payload)
        };
      }
    };
  }
};
const d1Bootstrap = await request("/api/bootstrap", {}, { ...env, DB: fakeD1 });
assert(d1Bootstrap.response.status === 200, "D1 bootstrap should return 200");
assert(d1Bootstrap.body.issues[0].title === "D1 smoke snapshot", "D1 bootstrap should prefer latest snapshot payload");
assert(d1Bootstrap.response.headers.get("X-Lokana-Storage") === "d1", "D1 bootstrap should identify D1 storage");

const preflight = await worker.fetch(
  new Request("https://api.lokana.kr/api/bootstrap", {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:8765",
      "Access-Control-Request-Method": "GET"
    }
  }),
  env,
  {}
);
assert(preflight.status === 204, "preflight should return 204");

const collectWithoutToken = await request("/api/admin/collect", { method: "POST" });
assert(collectWithoutToken.response.status === 503, "collect without configured admin token should be unavailable");
assert(collectWithoutToken.body.error === "admin_token_not_configured", "collect should explain missing admin token");

const collectWithoutD1 = await request(
  "/api/admin/collect",
  {
    method: "POST",
    headers: {
      "X-Admin-Token": "local-token"
    }
  },
  { ...env, ADMIN_TOKEN: "local-token" }
);
assert(collectWithoutD1.response.status === 503, "collect with token but without D1 should be unavailable");
assert(collectWithoutD1.body.error === "d1_not_configured", "collect should explain missing D1 binding");

const adminStatus = await request("/api/admin/status");
assert(adminStatus.response.status === 501, "remaining admin routes should clearly report later phase");

console.log("Lokana Worker F3 smoke passed.");
