#!/usr/bin/env node
/**
 * Local dashboard preview — no Cloudflare account, no wrangler, no network.
 *
 * Runs the real Worker code (same router, auth, aggregation, dashboard) against
 * the in-memory D1 stand-in used by the tests, seeded with two weeks of
 * realistic demo data for four apps.
 *
 *   npm run preview
 *   open http://127.0.0.1:8787/dashboard
 *
 * Tokens (local only): preview-local-token / preview-local-admin
 *
 * This is a developer convenience only; nothing is persisted and it must never
 * be deployed.
 */

import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

import worker from '../src/index.js';
import { sha256Hex } from '../src/auth.js';
import { dayRange } from '../src/validate.js';
import { FakeD1 } from '../tests/helpers/fake-d1.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const STATS_TOKEN = process.env.STATS_TOKEN || 'preview-local-token';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'preview-local-admin';
const DAYS = 14;
let activePort = PORT;

const env = {
  DB: new FakeD1(),
  STATS_TOKEN,
  ADMIN_TOKEN,
  DEFAULT_RANGE_DAYS: '7',
  REGISTRY_ENFORCE: '0',
};

/**
 * Four real Darkmintis apps with plausible buttons, screens and events.
 * Every event/button used below is also declared in the registry, so the
 * dashboard starts with a complete registry and no "unregistered" warnings.
 */
const APPS = [
  {
    app: 'blink',
    name: 'Blink',
    scale: 34,
    platforms: { android: 1 },
    ui: {
      'home.upload_cta': 26,
      'home.scan_qr': 12,
      'share.copy_link': 9,
      'history.share_again': 7,
      'settings.privacy_mode': 4,
      'receive.save_all': 5,
    },
    screens: { home: 46, history: 18, settings: 9, receive: 22 },
    custom: [
      { event: 'share_created', rate: 0.2, dims: { privacy: 0.34, instant: 0.24, normal: 0.42 } },
      { event: 'receive_completed', rate: 0.25, dims: { single: 0.72, batch: 0.28 } },
    ],
  },
  {
    app: 'flare',
    name: 'Flare',
    scale: 52,
    platforms: { android: 0.8, web: 0.2 },
    ui: {
      'play.start': 20,
      'shop.open': 9,
      'settings.open': 4,
    },
    screens: { play: 38, shop: 14, settings: 7 },
    custom: [
      { event: 'run_started', rate: 0.6, dims: { quick: 0.55, ranked: 0.45 } },
      { event: 'purchase_completed', rate: 0.09, dims: { coins: 0.7, skin: 0.3 } },
    ],
  },
  {
    app: 'neverend',
    name: 'NeverEnd',
    scale: 24,
    platforms: { android: 1 },
    ui: {
      'games.sky_climb': 16,
      'games.chrome_race': 11,
      'games.unlock_new': 4,
      'settings.open': 3,
    },
    screens: { games: 30, sky_climb: 14, chrome_race: 10, settings: 5 },
    custom: [
      { event: 'game_started', rate: 0.55, dims: { sky_climb: 0.62, chrome_race: 0.38 } },
      { event: 'game_unlocked', rate: 0.05, dims: {} },
    ],
  },
  {
    app: 'linkmesh',
    name: 'LinkMesh',
    scale: 26,
    platforms: { android: 0.7, web: 0.3 },
    ui: {
      'chat.group': 14,
      'chat.public': 9,
      'chat.private': 7,
      'settings.open': 3,
    },
    screens: { chat: 34, groups: 16, settings: 6 },
    custom: [
      { event: 'message_sent', rate: 0.9, dims: { group: 0.5, public: 0.3, private: 0.2 } },
      { event: 'chat_created', rate: 0.1, dims: { group: 0.7, private: 0.3 } },
    ],
  },
];

let seedValue = 1337;
function random() {
  seedValue = (seedValue * 9301 + 49297) % 233280;
  return seedValue / 233280;
}
function jitter(min, max) {
  return min + random() * (max - min);
}
function pick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[0][0];
}
function round(value) {
  return Math.max(0, Math.round(value));
}

async function seed() {
  const db = env.DB;
  const now = Date.now();

  for (const spec of APPS) {
    db.apps.push({
      app: spec.app,
      name: spec.name,
      key_hash: await sha256Hex(`mk_preview_${spec.app}_000000000000`),
      created_at: now,
    });

    db.registry.set(`${spec.app}\u0000ui_click`, {
      event: 'ui_click',
      dim1_allow: JSON.stringify(Object.keys(spec.ui)),
      dim2_allow: JSON.stringify(Object.keys(spec.platforms)),
    });
    db.registry.set(`${spec.app}\u0000screen_view`, {
      event: 'screen_view',
      dim1_allow: JSON.stringify(Object.keys(spec.screens)),
      dim2_allow: JSON.stringify(Object.keys(spec.platforms)),
    });
    db.registry.set(`${spec.app}\u0000app_open`, {
      event: 'app_open',
      dim1_allow: '[]',
      dim2_allow: JSON.stringify(Object.keys(spec.platforms)),
    });
    for (const custom of spec.custom) {
      db.registry.set(`${spec.app}\u0000${custom.event}`, {
        event: custom.event,
        dim1_allow: JSON.stringify(Object.keys(custom.dims)),
        dim2_allow: JSON.stringify(Object.keys(spec.platforms)),
      });
    }
  }

  // Buckets follow this machine's local calendar, matching the dashboard.
  const days = dayRange(DAYS, new Date(), -new Date().getTimezoneOffset());
  const uiWeight = (spec) => Object.values(spec.ui).reduce((sum, weight) => sum + weight, 0);
  const screenWeight = (spec) => Object.values(spec.screens).reduce((sum, weight) => sum + weight, 0);

  days.forEach((day, index) => {
    const growth = 0.6 + index * 0.038;
    for (const spec of APPS) {
      const base = spec.scale * growth * jitter(0.72, 1.28);
      const platform = pick(spec.platforms);

      for (const [button, weight] of Object.entries(spec.ui)) {
        const count = round((base * weight) / uiWeight(spec) * jitter(0.7, 1.3));
        if (count > 0) bump(spec.app, day, 'ui_click', button, platform, count);
      }

      const screenTotal = round(base * jitter(1.35, 1.75));
      for (const [screen, weight] of Object.entries(spec.screens)) {
        const count = round((screenTotal * weight) / screenWeight(spec) * jitter(0.75, 1.25));
        if (count > 0) bump(spec.app, day, 'screen_view', screen, platform, count);
      }

      const opens = round(base * jitter(0.7, 1.05));
      if (opens > 0) bump(spec.app, day, 'app_open', '', platform, opens);

      for (const custom of spec.custom) {
        const total = round(base * custom.rate * jitter(0.6, 1.4));
        if (total <= 0) continue;
        const dims = Object.keys(custom.dims);
        if (dims.length === 0) {
          bump(spec.app, day, custom.event, '', platform, total);
        } else {
          for (const [dim, weight] of Object.entries(custom.dims)) {
            const count = round(total * weight * jitter(0.7, 1.3));
            if (count > 0) bump(spec.app, day, custom.event, dim, platform, count);
          }
        }
      }
    }
  });

  function bump(app, day, event, dim1, dim2, count) {
    const key = [app, day, event, dim1, dim2].join('\u0000');
    const existing = db.events.get(key);
    if (existing) existing.count += count;
    else db.events.set(key, { app, day, event, dim1, dim2, count });
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

await seed();

const server = createServer(async (incoming, outgoing) => {
  try {
    const body = await readBody(incoming);
    const url = 'http://' + HOST + ':' + activePort + incoming.url;
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(url, {
      method: incoming.method,
      headers,
      body: ['GET', 'HEAD'].includes(incoming.method ?? 'GET') ? undefined : body,
    });
    const response = await worker.fetch(request, env);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
    console.log(incoming.method + ' ' + incoming.url + ' -> ' + response.status);
  } catch (cause) {
    console.error('preview error:', cause);
    outgoing.statusCode = 500;
    outgoing.setHeader('Content-Type', 'application/json');
    outgoing.end(JSON.stringify({ error: String(cause?.message ?? cause) }));
  }
});

let pidFile = null;
let bannerPrinted = false;

/** Listen on PORT, or the next free port when a stale preview is still alive. */
function startListening(port, remaining) {
  activePort = port;
  server.once('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && remaining > 0) {
      console.log('Port ' + port + ' is busy, trying ' + (port + 1) + '...');
      startListening(port + 1, remaining - 1);
      return;
    }
    console.error('Preview could not start: ' + (error && error.message ? error.message : String(error)));
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    if (bannerPrinted) return;
    bannerPrinted = true;
    pidFile = join(tmpdir(), 'mintly-preview-' + port + '.pid');
    try { writeFileSync(pidFile, String(process.pid)); } catch (e) { /* pidfile is optional */ }
    console.log('');
    console.log('Mintly local preview');
    console.log('  Dashboard  : http://' + HOST + ':' + activePort + '/dashboard');
    console.log('  Stats token: ' + STATS_TOKEN);
    console.log('  Admin token: ' + ADMIN_TOKEN);
    console.log('');
    console.log('Demo apps (app keys, for curl experiments):');
    for (const spec of APPS) {
      console.log('  ' + spec.name.padEnd(10) + ' mk_preview_' + spec.app + '_000000000000');
    }
    console.log('');
    console.log('Demo data: 4 apps, ' + DAYS + ' days of clicks, screens, opens and domain events.');
    console.log('Every seeded event/button is declared in the registry. Nothing is persisted.');
    console.log('Ctrl+C to stop.');
    console.log('');
  });
}

startListening(PORT, 10);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nStopping preview.');
    if (pidFile) { try { rmSync(pidFile, { force: true }); } catch (e) { /* ignore */ } }
    server.close(() => process.exit(0));
  });
}
