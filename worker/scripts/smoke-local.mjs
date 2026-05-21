import worker from "../src/index.js";

const env = {
  CORS_ORIGINS: "http://127.0.0.1:8765,http://localhost:8765,https://lokana.kr"
};

async function request(path, init = {}) {
  const response = await worker.fetch(
    new Request(`https://api.lokana.kr${path}`, {
      ...init,
      headers: {
        Origin: "http://127.0.0.1:8765",
        ...(init.headers || {})
      }
    }),
    env,
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

const admin = await request("/api/admin/status");
assert(admin.response.status === 501, "admin routes should clearly report later phase");

console.log("Lokana Worker F1 smoke passed.");
