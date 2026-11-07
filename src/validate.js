/**
 * Input validation. Everything that reaches the database passes through here.
 * Event and dimension grammars are intentionally narrow: lowercase identifiers
 * only, so nothing free-form (and therefore nothing personal) can be stored.
 */

export const APP_RE = /^[a-z][a-z0-9-]{1,31}$/;
export const EVENT_RE = /^[a-z][a-z0-9_]{1,39}$/;
export const DIM_RE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

export const MAX_COUNT = 100;
export const MAX_DIMS = 50;
export const MAX_DAYS = 365;

/** UTC day key, e.g. "2026-11-07". The server owns the clock; clients never send it. */
export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** The last `days` UTC day keys, oldest first, ending today. */
export function dayRange(days, now = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    out.push(utcDay(d));
  }
  return out;
}

export function isValidApp(app) {
  return typeof app === 'string' && APP_RE.test(app);
}

export function isValidEvent(event) {
  return typeof event === 'string' && EVENT_RE.test(event);
}

export function isValidDim(dim) {
  return typeof dim === 'string' && (dim === '' || DIM_RE.test(dim));
}

export function isValidCount(count) {
  return Number.isInteger(count) && count >= 1 && count <= MAX_COUNT;
}

export function isValidDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

export function parseDays(raw, fallback = 7) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) return fallback;
  return n;
}

function cleanDimensions(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_DIMS) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const trimmed = item.trim();
    if (trimmed === '' || !isValidDim(trimmed)) return null;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * Validate an ingest body. The app always comes from the key, never the body.
 * @returns {{ok:true,value:{event:string,dim1:string,dim2:string,count:number}}|{ok:false,error:string}}
 */
export function validateEventBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a JSON object body' };
  }
  const event = body.event;
  if (!isValidEvent(event)) {
    return { ok: false, error: 'Invalid event: use lowercase letters, digits and underscores (2-40 chars)' };
  }
  const dim1 = body.dim1 ?? '';
  const dim2 = body.dim2 ?? '';
  if (!isValidDim(dim1)) {
    return { ok: false, error: 'Invalid dim1: lowercase letters, digits and . _ : - only (max 64)' };
  }
  if (!isValidDim(dim2)) {
    return { ok: false, error: 'Invalid dim2: lowercase letters, digits and . _ : - only (max 64)' };
  }
  const count = body.count === undefined ? 1 : Number(body.count);
  if (!isValidCount(count)) {
    return { ok: false, error: `Invalid count: integer between 1 and ${MAX_COUNT}` };
  }
  return { ok: true, value: { event, dim1, dim2, count } };
}

/**
 * Validate an app creation body.
 * @returns {{ok:true,value:{app:string,name:string}}|{ok:false,error:string}}
 */
export function validateAppBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a JSON object body' };
  }
  if (!isValidApp(body.app)) {
    return { ok: false, error: 'Invalid app slug: lowercase letters, digits and dashes (2-32 chars, start with a letter)' };
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 64) : '';
  return { ok: true, value: { app: body.app, name } };
}

/**
 * Validate a registry entry.
 * @returns {{ok:true,value:{app:string,event:string,dim1:string[],dim2:string[]}}|{ok:false,error:string}}
 */
export function validateRegistryBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a JSON object body' };
  }
  if (!isValidApp(body.app)) return { ok: false, error: 'Invalid app slug' };
  if (!isValidEvent(body.event)) return { ok: false, error: 'Invalid event name' };
  const dim1 = cleanDimensions(body.dim1);
  const dim2 = cleanDimensions(body.dim2);
  if (dim1 === null) return { ok: false, error: 'Invalid dim1 allowlist: expected an array of valid dimensions' };
  if (dim2 === null) return { ok: false, error: 'Invalid dim2 allowlist: expected an array of valid dimensions' };
  return { ok: true, value: { app: body.app, event: body.event, dim1, dim2 } };
}
