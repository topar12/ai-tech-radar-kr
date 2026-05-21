const defaultOrigins = [
  "http://127.0.0.1:8765",
  "http://localhost:8765",
  "https://lokana.kr"
];

function configuredOrigins(env = {}) {
  const raw = typeof env.CORS_ORIGINS === "string" ? env.CORS_ORIGINS : "";
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : defaultOrigins;
}

export function corsHeaders(request, env = {}) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = configuredOrigins(env);
  const allowAny = allowedOrigins.includes("*");
  const allowedOrigin = allowAny || !origin || allowedOrigins.includes(origin)
    ? origin || allowedOrigins[0] || "*"
    : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowAny ? "*" : allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export function preflightResponse(request, env = {}) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env)
  });
}
