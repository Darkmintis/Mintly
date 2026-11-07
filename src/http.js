/** Response helpers. Every response goes through one of these. */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function error(status, message, headers = {}) {
  return json({ error: message }, status, headers);
}

/** CORS for the public ingest endpoint (SDKs may run in browsers). */
export const INGEST_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Key, X-Mintly-Tz',
  'Access-Control-Max-Age': '86400',
};

/** Headers for the dashboard shell: no third-party anything. */
export const DASHBOARD_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'none'",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

export function noContent(status = 204, headers = {}) {
  return new Response(null, { status, headers });
}
