#!/usr/bin/env node
/**
 * mintly CLI — the agent-friendly interface to a Mintly deployment.
 *
 * Everything the dashboard can read, and everything an admin can change, is a
 * command here with --json output and stable exit codes:
 *   0 ok · 1 usage · 2 network/auth · 3 validation
 *
 * Config (env or flags):
 *   MINTLY_URL            deployment origin, e.g. https://mintly.example.workers.dev
 *   MINTLY_STATS_TOKEN    read-only token (stats, registry list, export)
 *   MINTLY_ADMIN_TOKEN    admin token (app add, registry add)
 */

import { parseArgs } from 'node:util';

const EXIT = { OK: 0, USAGE: 1, NETWORK: 2, VALIDATION: 3 };

const HELP = `mintly — privacy-first anonymous analytics for Cloudflare Workers

Usage:
  mintly app add <slug> [--name <display name>]
  mintly app list
  mintly registry add <app> <event> [--dim1 a,b] [--dim2 x,y]
  mintly registry list <app>
  mintly stats [--app <slug>] [--days 7] [--group event|dim1]
  mintly export <app> [--days 30] [--out <file>]
  mintly mcp                     start the MCP stdio server
  mintly help | version

Global options:
  --url <origin>     deployment URL (or MINTLY_URL)
  --token <token>    override the token for this call
  --json             machine-readable output (stdout only)

Env:
  MINTLY_URL, MINTLY_STATS_TOKEN, MINTLY_ADMIN_TOKEN

Exit codes: 0 ok · 1 usage · 2 network/auth · 3 validation`;

function optionList(parsed, name) {
  const value = parsed.values[name];
  if (value === undefined) return undefined;
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}

function fail(message, code = EXIT.USAGE) {
  process.stderr.write(`mintly: ${message}\n`);
  process.exit(code);
}

function requireUrl(parsed) {
  const url = (parsed.values.url ?? process.env.MINTLY_URL ?? '').replace(/\/+$/, '');
  if (!url) fail('missing deployment URL — set MINTLY_URL or pass --url', EXIT.USAGE);
  return url;
}

function tokenFor(parsed, kind) {
  if (parsed.values.token) return String(parsed.values.token);
  const value = kind === 'admin' ? process.env.MINTLY_ADMIN_TOKEN : process.env.MINTLY_STATS_TOKEN;
  if (!value) {
    fail(`missing ${kind === 'admin' ? 'MINTLY_ADMIN_TOKEN' : 'MINTLY_STATS_TOKEN'} — export it or pass --token`, EXIT.USAGE);
  }
  return value;
}

async function request(parsed, path, { method = 'GET', body, kind = 'stats' } = {}) {
  const url = requireUrl(parsed) + path;
  const headers = { Authorization: `Bearer ${tokenFor(parsed, kind)}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (cause) {
    fail(`network error: ${cause.message}`, EXIT.NETWORK);
  }
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = undefined; }
  if (!response.ok) {
    let message = payload?.error ?? (text || response.statusText);
    if (response.status === 401) {
      message += ` (check ${kind === 'admin' ? 'MINTLY_ADMIN_TOKEN' : 'MINTLY_STATS_TOKEN'} and MINTLY_URL)`;
    } else if (response.status === 429) {
      message += ' (rate limited — retry in a minute)';
    } else if (response.status === 503) {
      message += ' (run `npm run setup` to create the Worker secrets)';
    }
    fail(`HTTP ${response.status}: ${message}`, response.status === 400 || response.status === 409 ? EXIT.VALIDATION : EXIT.NETWORK);
  }
  return payload;
}

function printTable(rows, columns) {
  const widths = columns.map((col) => Math.max(col.label.length, ...rows.map((row) => String(row[col.key] ?? '').length)));
  const line = (cells) => cells.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join('  ');
  process.stdout.write(line(columns.map((col) => col.label)) + '\n');
  process.stdout.write(widths.map((width) => '-'.repeat(width)).join('  ') + '\n');
  for (const row of rows) {
    process.stdout.write(line(columns.map((col) => row[col.key])) + '\n');
  }
}

async function listApps(parsed) {
  const data = await request(parsed, '/v1/apps');
  if (parsed.values.json) return printJson(data);
  const apps = data.apps ?? [];
  if (apps.length === 0) return process.stdout.write('No apps yet — create one: mintly app add <slug>\n');
  printTable(apps, [
    { key: 'app', label: 'app' },
    { key: 'name', label: 'name' },
  ]);
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value) + '\n');
}

async function main() {
  const parsed = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      token: { type: 'string' },
      json: { type: 'boolean' },
      name: { type: 'string' },
      dim1: { type: 'string' },
      dim2: { type: 'string' },
      days: { type: 'string' },
      group: { type: 'string' },
      app: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const [command, sub, ...rest] = parsed.positionals;

  if (!command || command === 'help' || parsed.values.help) return process.stdout.write(HELP + '\n');
  if (command === 'version') return process.stdout.write('mintly 0.1.0\n');
  if (command === 'mcp') return runMcp();

  if (command === 'app') {
    if (sub === 'list') return listApps(parsed);
    if (sub === 'add') {
      const slug = rest[0];
      if (!slug) fail('usage: mintly app add <slug> [--name <name>]');
      const body = { app: slug };
      if (parsed.values.name) body.name = String(parsed.values.name);
      const data = await request(parsed, '/v1/apps', { method: 'POST', body, kind: 'admin' });
      if (parsed.values.json) return printJson(data);
      process.stdout.write(`Created app ${data.app} (${data.name || data.app})\n`);
      process.stdout.write(`Key (shown once, store it): ${data.key}\n`);
      return;
    }
    fail('unknown app command — try: mintly app add|list');
  }

  if (command === 'registry') {
    if (sub === 'list') {
      const app = rest[0];
      if (!app) fail('usage: mintly registry list <app>');
      const data = await request(parsed, `/v1/registry?app=${encodeURIComponent(app)}`);
      if (parsed.values.json) return printJson(data);
      const events = data.events ?? [];
      if (events.length === 0) return process.stdout.write(`Registry for ${app} is empty.\n`);
      for (const entry of events) {
        const dims = entry.dim1.length > 0 ? entry.dim1.join(', ') : '(any dim1)';
        process.stdout.write(`${entry.event}  →  ${dims}\n`);
      }
      return;
    }
    if (sub === 'add') {
      const [app, event] = rest;
      if (!app || !event) fail('usage: mintly registry add <app> <event> [--dim1 a,b] [--dim2 x,y]');
      const body = {
        app,
        event,
        dim1: optionList(parsed, 'dim1') ?? [],
        dim2: optionList(parsed, 'dim2') ?? [],
      };
      const data = await request(parsed, '/v1/registry', { method: 'POST', body, kind: 'admin' });
      if (parsed.values.json) return printJson(data);
      process.stdout.write(`Registered ${app}/${event} with ${data.dim1.length} dim1 values.\n`);
      return;
    }
    fail('unknown registry command — try: mintly registry add|list');
  }

  if (command === 'stats') {
    const search = new URLSearchParams();
    const days = parsed.values.days ?? '7';
    if (parsed.values.app) search.set('app', String(parsed.values.app));
    search.set('days', String(days));
    search.set('tz', String(-new Date().getTimezoneOffset()));
    const data = await request(parsed, `/v1/stats?${search.toString()}`);
    if (parsed.values.json) return printJson(data);

    const group = parsed.values.group === 'dim1' ? 'dim1' : 'event';
    for (const app of data.apps) {
      process.stdout.write(`\n${app.name} (${app.app}) — ${app.total} events in ${data.rangeDays}d\n`);
      if (group === 'dim1') {
        const rows = app.buttons.map((entry) => ({ label: entry.dim1, count: entry.count }));
        if (rows.length === 0) { process.stdout.write('  no button activity yet\n'); continue; }
        printTable(rows, [
          { key: 'label', label: 'button' },
          { key: 'count', label: 'clicks' },
        ]);
      } else {
        if (app.events.length === 0) { process.stdout.write('  no activity yet\n'); continue; }
        printTable(app.events, [
          { key: 'event', label: 'event' },
          { key: 'count', label: 'count' },
        ]);
      }
    }
    return;
  }

  if (command === 'export') {
    const app = rest[0];
    if (!app) fail('usage: mintly export <app> [--days 30] [--out file.csv]');
    const search = new URLSearchParams({ app, days: String(parsed.values.days ?? '30') });
    search.set('tz', String(-new Date().getTimezoneOffset()));
    const url = requireUrl(parsed) + `/v1/export.csv?${search.toString()}`;
    let response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${tokenFor(parsed, 'stats')}` } });
    } catch (cause) {
      fail(`network error: ${cause.message}`, EXIT.NETWORK);
    }
    if (!response.ok) fail(`HTTP ${response.status}`, EXIT.NETWORK);
    const csv = await response.text();
    if (parsed.values.out) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(String(parsed.values.out), csv, 'utf8');
      process.stdout.write(`Wrote ${parsed.values.out}\n`);
    } else {
      process.stdout.write(csv);
    }
    return;
  }

  fail(`unknown command "${command}" — run mintly help`);
}

async function runMcp() {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [new URL('../mcp/server.mjs', import.meta.url).pathname], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((cause) => fail(cause.message ?? String(cause), EXIT.NETWORK));
