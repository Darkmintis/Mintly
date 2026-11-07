/**
 * Read routes (STATS_TOKEN or ADMIN_TOKEN):
 *   GET /v1/apps
 *   GET /v1/registry?app=
 *   GET /v1/stats?days=&app=
 *   GET /v1/export.csv?days=&app=
 */

import { buildStats } from '../aggregate.js';
import { getRegistry, listApps, selectStatsRows } from '../db.js';
import { error, json } from '../http.js';
import { checkRateLimit, clientIp } from '../ratelimit.js';
import { dayRange, isValidApp, parseDays } from '../validate.js';

const RATE_LIMIT_PER_MINUTE = 240;

function limited(request) {
  return !checkRateLimit(`read:${clientIp(request)}`, RATE_LIMIT_PER_MINUTE, 60_000).allowed;
}

export async function handleListApps(request, env) {
  if (limited(request)) return error(429, 'Too many requests');
  return json({ apps: await listApps(env) });
}

export async function handleGetRegistry(request, env, url) {
  if (limited(request)) return error(429, 'Too many requests');
  const app = url.searchParams.get('app') ?? '';
  if (!isValidApp(app)) return error(400, 'Invalid app slug');

  const rows = await getRegistry(env, app);
  const events = rows.map((row) => ({
    event: row.event,
    dim1: safeJsonArray(row.dim1_allow),
    dim2: safeJsonArray(row.dim2_allow),
  }));
  return json({ app, events });
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function handleStats(request, env, url) {
  if (limited(request)) return error(429, 'Too many requests');
  const appFilter = url.searchParams.get('app') ?? '';
  if (appFilter && !isValidApp(appFilter)) return error(400, 'Invalid app slug');

  const fallbackDays = Number.parseInt(env.DEFAULT_RANGE_DAYS ?? '7', 10) || 7;
  const days = parseDays(url.searchParams.get('days'), fallbackDays);
  const dayKeys = dayRange(days);

  const allApps = await listApps(env);
  const apps = appFilter ? allApps.filter((entry) => entry.app === appFilter) : allApps;
  if (appFilter && apps.length === 0) return error(404, `Unknown app "${appFilter}"`);

  const rows = await selectStatsRows(env, {
    fromDay: dayKeys[0],
    app: appFilter || undefined,
  });

  const registry = [];
  for (const entry of apps) {
    registry.push(...await getRegistry(env, entry.app));
  }

  const stats = buildStats({ rows, apps, registry, days: dayKeys });
  return json({
    generatedAt: new Date().toISOString(),
    rangeDays: days,
    ...stats,
  });
}

export async function handleExport(request, env, url) {
  if (limited(request)) return error(429, 'Too many requests');
  const appFilter = url.searchParams.get('app') ?? '';
  if (!isValidApp(appFilter)) return error(400, 'Invalid app slug');

  const days = parseDays(url.searchParams.get('days'), 30);
  const dayKeys = dayRange(days);
  const rows = await selectStatsRows(env, { fromDay: dayKeys[0], app: appFilter });

  const header = 'app,day,event,dim1,dim2,count';
  const lines = rows
    .map((row) => [row.app, row.day, row.event, row.dim1, row.dim2, row.count]
      .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
      .join(','))
    .sort();
  const filename = `mintly-${appFilter}-${dayKeys[0]}-${dayKeys[dayKeys.length - 1]}.csv`;

  return new Response([header, ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
