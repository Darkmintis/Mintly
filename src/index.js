/**
 * Mintly — privacy-first anonymous analytics for Cloudflare Workers.
 *
 * One Worker, one D1 database, one dashboard. No cookies, no user ids, no
 * third-party scripts: only daily counters per app / event / dimension.
 */

import { authenticate, hasScope } from './auth.js';
import { DASHBOARD_HEADERS, error, json } from './http.js';
import { handleCreateApp, handlePutRegistry } from './routes/admin.js';
import { handleEvent } from './routes/events.js';
import { handleExport, handleGetRegistry, handleListApps, handleStats } from './routes/stats.js';
import { DASHBOARD_HTML } from './dashboard/html.js';
import { DASHBOARD_CSS } from './dashboard/css.js';
import { DASHBOARD_JS } from './dashboard/js.js';

const VERSION = '0.1.0';

const ASSET_HEADERS = {
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    try {
      // ---- API -----------------------------------------------------------
      if (pathname === '/v1/event') {
        return await handleEvent(request, env);
      }

      if (pathname === '/v1/apps') {
        if (method === 'POST') {
          return await withScope(request, env, ['admin'], () => handleCreateApp(request, env));
        }
        if (method === 'GET') {
          return await withScope(request, env, ['admin', 'stats'], () => handleListApps(request, env));
        }
        return error(405, 'Method not allowed');
      }

      if (pathname === '/v1/registry') {
        if (method === 'POST') {
          return await withScope(request, env, ['admin'], () => handlePutRegistry(request, env));
        }
        if (method === 'GET') {
          return await withScope(request, env, ['admin', 'stats'],
            () => handleGetRegistry(request, env, url));
        }
        return error(405, 'Method not allowed');
      }

      if (pathname === '/v1/stats') {
        if (method !== 'GET') return error(405, 'Method not allowed');
        return await withScope(request, env, ['admin', 'stats'], () => handleStats(request, env, url));
      }

      if (pathname === '/v1/export.csv') {
        if (method !== 'GET') return error(405, 'Method not allowed');
        return await withScope(request, env, ['admin', 'stats'], () => handleExport(request, env, url));
      }

      if (pathname === '/health') {
        return json({
          ok: true,
          name: 'mintly',
          version: VERSION,
          registryEnforced: env.REGISTRY_ENFORCE === '1',
        });
      }

      // ---- Dashboard -----------------------------------------------------
      if (pathname === '/' || pathname === '/dashboard') {
        return new Response(DASHBOARD_HTML, { headers: DASHBOARD_HEADERS });
      }
      if (pathname === '/assets/app.css') {
        return new Response(DASHBOARD_CSS, {
          headers: { ...ASSET_HEADERS, 'Content-Type': 'text/css; charset=utf-8' },
        });
      }
      if (pathname === '/assets/app.js') {
        return new Response(DASHBOARD_JS, {
          headers: { ...ASSET_HEADERS, 'Content-Type': 'text/javascript; charset=utf-8' },
        });
      }

      return error(404, 'Not found');
    } catch (cause) {
      console.error('mintly: unhandled error', cause);
      return error(500, 'Internal error');
    }
  },
};

async function withScope(request, env, scopes, handler) {
  if (!env.STATS_TOKEN || !env.ADMIN_TOKEN) {
    return error(503, 'Mintly is not configured yet: set STATS_TOKEN and ADMIN_TOKEN as Worker secrets.');
  }
  const auth = await authenticate(request, env);
  if (!auth || !hasScope(auth, ...scopes)) {
    return error(401, 'Unauthorized: send Authorization: Bearer <STATS_TOKEN or ADMIN_TOKEN>');
  }
  return handler();
}
