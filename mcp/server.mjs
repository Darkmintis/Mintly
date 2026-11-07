#!/usr/bin/env node
/**
 * Mintly MCP server (stdio, newline-delimited JSON-RPC 2.0).
 *
 * Gives coding agents first-class tools for a Mintly deployment:
 *   mintly_list_apps, mintly_query_stats, mintly_add_app, mintly_add_event
 *
 * Env: MINTLY_URL, MINTLY_STATS_TOKEN, MINTLY_ADMIN_TOKEN
 * Run: mintly mcp   (or: node mcp/server.mjs)
 */

import { createInterface } from 'node:readline';

const URL_BASE = (process.env.MINTLY_URL ?? '').replace(/\/+$/, '');
const STATS_TOKEN = process.env.MINTLY_STATS_TOKEN ?? '';
const ADMIN_TOKEN = process.env.MINTLY_ADMIN_TOKEN ?? '';

const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'mintly_list_apps',
    description: 'List apps registered in this Mintly deployment (read-only).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mintly_query_stats',
    description: 'Query anonymous event counts. Returns per-app totals, daily series, event breakdown and top button labels.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '1-365, default 7' },
        app: { type: 'string', description: 'Optional app slug' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mintly_add_app',
    description: 'Create an app and return its ingest key (shown once). Requires MINTLY_ADMIN_TOKEN.',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'lowercase slug, e.g. "blink"' },
        name: { type: 'string', description: 'display name' },
      },
      required: ['app'],
      additionalProperties: false,
    },
  },
  {
    name: 'mintly_add_event',
    description: 'Declare an event and its allowed button ids in the app registry. Requires MINTLY_ADMIN_TOKEN.',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string' },
        event: { type: 'string' },
        dim1: { type: 'array', items: { type: 'string' }, description: 'allowed button ids' },
        dim2: { type: 'array', items: { type: 'string' } },
      },
      required: ['app', 'event'],
      additionalProperties: false,
    },
  },
];

function reply(id, result) {
  write({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  write({ jsonrpc: '2.0', id, error: { code, message } });
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

async function callApi(path, { method = 'GET', body, token } = {}) {
  if (!URL_BASE) throw new Error('MINTLY_URL is not set');
  if (!token) throw new Error('Missing token for this operation');
  const response = await fetch(URL_BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

async function callTool(name, args = {}) {
  if (name === 'mintly_list_apps') {
    return await callApi('/v1/apps', { token: STATS_TOKEN });
  }
  if (name === 'mintly_query_stats') {
    const search = new URLSearchParams();
    search.set('days', String(args.days ?? 7));
    if (args.app) search.set('app', args.app);
    return await callApi(`/v1/stats?${search.toString()}`, { token: STATS_TOKEN });
  }
  if (name === 'mintly_add_app') {
    return await callApi('/v1/apps', {
      method: 'POST',
      body: { app: args.app, name: args.name },
      token: ADMIN_TOKEN,
    });
  }
  if (name === 'mintly_add_event') {
    return await callApi('/v1/registry', {
      method: 'POST',
      body: { app: args.app, event: args.event, dim1: args.dim1 ?? [], dim2: args.dim2 ?? [] },
      token: ADMIN_TOKEN,
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'mintly', version: '0.1.0' },
    });
  }
  if (method === 'notifications/initialized') return undefined;
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params?.name;
    try {
      const result = await callTool(name, params?.arguments ?? {});
      return reply(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      });
    } catch (cause) {
      return reply(id, {
        content: [{ type: 'text', text: cause.message ?? String(cause) }],
        isError: true,
      });
    }
  }
  return replyError(id, -32601, `Method not found: ${method}`);
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return replyError(null, -32700, 'Parse error');
  }
  if (message.id === undefined && String(message.method ?? '').startsWith('notifications/')) {
    return undefined;
  }
  handle(message).catch((cause) => replyError(message.id ?? null, -32603, cause.message ?? 'Internal error'));
});
