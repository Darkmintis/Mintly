/**
 * Authentication helpers.
 *
 * Two credential kinds:
 * - deployment tokens (STATS_TOKEN read-only, ADMIN_TOKEN admin) sent as
 *   `Authorization: Bearer <token>` and compared in constant time;
 * - app keys (`mk_...`) sent as `X-App-Key` from SDKs. Only a SHA-256 hash is
 *   stored, so a database leak never exposes usable keys.
 */

import { getAppByKey } from './db.js';

const TEXT = new TextEncoder();
const KEY_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', TEXT.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate an unguessable app key, e.g. `mk_9xQ...` (32 random chars). */
export function generateAppKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = '';
  for (const byte of bytes) out += KEY_ALPHABET[byte % KEY_ALPHABET.length];
  return `mk_${out}`;
}

/** Generate a deployment token (used for STATS_TOKEN / ADMIN_TOKEN). */
export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time-ish string comparison. Length differences still short-circuit,
 * but secrets are fixed-length hex tokens, so that leak is acceptable.
 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the caller's scope from a request.
 * @returns {Promise<null|{scope:'admin'}|{scope:'stats'}|{scope:'app',app:string,key:string}>}
 */
export async function authenticate(request, env) {
  const bearer = bearerToken(request);
  if (bearer) {
    if (!env.ADMIN_TOKEN || !env.STATS_TOKEN) return null;
    if (safeEqual(bearer, env.ADMIN_TOKEN)) return { scope: 'admin' };
    if (safeEqual(bearer, env.STATS_TOKEN)) return { scope: 'stats' };
    return null;
  }
  const key = request.headers.get('X-App-Key')?.trim();
  if (!key) return null;
  const row = await getAppByKey(env, key);
  if (!row) return null;
  return { scope: 'app', app: row.app, key };
}

export function hasScope(auth, ...scopes) {
  return auth !== null && scopes.includes(auth.scope);
}
