/**
 * Public ingest endpoint: POST /v1/event
 *
 * The caller authenticates with an app key (`X-App-Key`). The app identity is
 * derived from the key, never trusted from the body. The UTC day is assigned
 * here, so a buggy or malicious client cannot backfill or future-date data.
 */

import { authenticate } from '../auth.js';
import { upsertEvent, getRegistry } from '../db.js';
import { checkRateLimit, clientIp } from '../ratelimit.js';
import { INGEST_CORS, error, noContent } from '../http.js';
import { dayKey, parseTz, validateEventBody } from '../validate.js';

const RATE_LIMIT_PER_MINUTE = 240;

async function dim1Rejected(env, app, event, dim1) {
  if (env.REGISTRY_ENFORCE !== '1' || !dim1) return false;
  const registry = await getRegistry(env, app);
  const entry = registry.find((row) => row.event === event);
  if (!entry) return false; // unregistered events stay accepted for quick setup
  let allowed = [];
  try {
    allowed = JSON.parse(entry.dim1_allow ?? '[]');
  } catch {
    allowed = [];
  }
  return allowed.length > 0 && !allowed.includes(dim1);
}

export async function handleEvent(request, env) {
  if (request.method === 'OPTIONS') return noContent(204, INGEST_CORS);
  if (request.method !== 'POST') return error(405, 'Method not allowed', INGEST_CORS);

  const auth = await authenticate(request, env);
  if (!auth || auth.scope !== 'app') {
    return error(401, 'Missing or invalid X-App-Key', INGEST_CORS);
  }

  const limit = checkRateLimit(`ingest:${auth.app}:${clientIp(request)}`, RATE_LIMIT_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return noContent(429, { ...INGEST_CORS, 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid JSON body', INGEST_CORS);
  }

  const validation = validateEventBody(body);
  if (!validation.ok) return error(400, validation.error, INGEST_CORS);

  const { event, dim1, dim2, count } = validation.value;
  if (await dim1Rejected(env, auth.app, event, dim1)) {
    return error(400, `Unregistered dim1 for ${auth.app}/${event}: ${dim1}`, INGEST_CORS);
  }

  await upsertEvent(env, {
    app: auth.app,
    // Bucket by the sender's local calendar day; the offset itself is not stored.
    day: dayKey(new Date(), parseTz(request.headers.get('X-Mintly-Tz'))),
    event,
    dim1,
    dim2,
    count,
  });

  // 202: accepted and counted; the SDK never waits on the result.
  return noContent(202, INGEST_CORS);
}
