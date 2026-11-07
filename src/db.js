/**
 * Every SQL statement lives here. Handlers never build SQL strings, and a
 * future storage swap (e.g. Analytics Engine) only has to replace this file.
 */

const UPSERT_EVENT = `
  INSERT INTO events_daily (app, day, event, dim1, dim2, count)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(app, day, event, dim1, dim2) DO UPDATE SET count = count + excluded.count
`;

export async function getAppByKey(env, key) {
  const { sha256Hex } = await import('./auth.js');
  return env.DB.prepare('SELECT app, name FROM apps WHERE key_hash = ?')
    .bind(await sha256Hex(key))
    .first();
}

export async function insertApp(env, { app, name, keyHash, createdAt }) {
  await env.DB.prepare(
    'INSERT INTO apps (app, name, key_hash, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(app, name, keyHash, createdAt)
    .run();
}

export async function listApps(env) {
  const result = await env.DB.prepare(
    'SELECT app, name, created_at FROM apps ORDER BY app',
  ).all();
  return result.results ?? [];
}

export async function appExists(env, app) {
  const row = await env.DB.prepare('SELECT app FROM apps WHERE app = ?').bind(app).first();
  return Boolean(row);
}

export async function upsertEvent(env, { app, day, event, dim1, dim2, count }) {
  await env.DB.prepare(UPSERT_EVENT)
    .bind(app, day, event, dim1, dim2, count)
    .run();
}

/** All counter rows for the requested window (optionally one app). */
export async function selectStatsRows(env, { fromDay, app }) {
  const result = app
    ? await env.DB.prepare(
      'SELECT app, day, event, dim1, dim2, count FROM events_daily WHERE day >= ? AND app = ?',
    ).bind(fromDay, app).all()
    : await env.DB.prepare(
      'SELECT app, day, event, dim1, dim2, count FROM events_daily WHERE day >= ?',
    ).bind(fromDay).all();
  return result.results ?? [];
}

export async function getRegistry(env, app) {
  const result = await env.DB.prepare(
    'SELECT event, dim1_allow, dim2_allow FROM registry WHERE app = ? ORDER BY event',
  ).bind(app).all();
  return result.results ?? [];
}

export async function putRegistry(env, { app, event, dim1, dim2 }) {
  await env.DB.prepare(
    'INSERT INTO registry (app, event, dim1_allow, dim2_allow) VALUES (?, ?, ?, ?) '
    + 'ON CONFLICT(app, event) DO UPDATE SET dim1_allow = excluded.dim1_allow, dim2_allow = excluded.dim2_allow',
  )
    .bind(app, event, JSON.stringify(dim1), JSON.stringify(dim2))
    .run();
}

export async function deleteApp(env, app) {
  await env.DB.prepare('DELETE FROM events_daily WHERE app = ?').bind(app).run();
  await env.DB.prepare('DELETE FROM registry WHERE app = ?').bind(app).run();
  await env.DB.prepare('DELETE FROM apps WHERE app = ?').bind(app).run();
}
