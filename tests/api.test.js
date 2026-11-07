import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { FakeD1 } from './helpers/fake-d1.js';

const ORIGIN = 'https://mintly.test';
const STATS_TOKEN = 'a'.repeat(64);
const ADMIN_TOKEN = 'b'.repeat(64);

function makeEnv(overrides = {}) {
  return {
    DB: new FakeD1(),
    STATS_TOKEN,
    ADMIN_TOKEN,
    DEFAULT_RANGE_DAYS: '7',
    REGISTRY_ENFORCE: '0',
    ...overrides,
  };
}

async function call(env, method, path, { token, appKey, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (appKey) headers['X-App-Key'] = appKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const request = new Request(ORIGIN + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return worker.fetch(request, env);
}

async function createApp(env, app = 'demo', name = 'Demo') {
  const response = await call(env, 'POST', '/v1/apps', {
    token: ADMIN_TOKEN,
    body: { app, name },
  });
  assert.equal(response.status, 201);
  return response.json();
}

test('health reports the service', async () => {
  const response = await call(makeEnv(), 'GET', '/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.name, 'mintly');
});

test('dashboard and assets are served with strict headers', async () => {
  const env = makeEnv();
  const page = await call(env, 'GET', '/dashboard');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await page.text();
  assert.match(html, /Mintly/);
  assert.match(html, /\/assets\/app\.js/);
  assert.ok(!/style="/.test(html), 'dashboard HTML must not use inline style attributes (CSP)');

  const css = await call(env, 'GET', '/assets/app.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const cssSource = await css.text();
  assert.match(cssSource, /--accent/);
  assert.match(cssSource, /\.span-all/);

  const js = await call(env, 'GET', '/assets/app.js');
  assert.equal(js.status, 200);
  const source = await js.text();
  assert.ok(source.length > 5000);
  assert.ok(!/style="/.test(source), 'dashboard JS must not build inline style attributes (CSP)');
  assert.doesNotThrow(() => new Function(source)); // generated browser JS parses
});

test('read API requires a token', async () => {
  const env = makeEnv();
  assert.equal((await call(env, 'GET', '/v1/stats')).status, 401);
  assert.equal((await call(env, 'GET', '/v1/apps', { token: 'wrong' })).status, 401);
});

test('app creation requires the admin token and returns the key once', async () => {
  const env = makeEnv();
  assert.equal((await call(env, 'POST', '/v1/apps', { body: { app: 'demo' } })).status, 401);
  assert.equal((await call(env, 'POST', '/v1/apps', { token: STATS_TOKEN, body: { app: 'demo' } })).status, 401);

  const created = await createApp(env);
  assert.equal(created.app, 'demo');
  assert.match(created.key, /^mk_[A-Za-z0-9]{32}$/);

  const duplicate = await call(env, 'POST', '/v1/apps', {
    token: ADMIN_TOKEN,
    body: { app: 'demo' },
  });
  assert.equal(duplicate.status, 409);

  const list = await call(env, 'GET', '/v1/apps', { token: STATS_TOKEN }).then((r) => r.json());
  assert.equal(list.apps.length, 1);
  assert.equal(list.apps[0].key, undefined, 'keys are never listed');
});

test('ingest validates keys and bodies, then aggregates', async () => {
  const env = makeEnv();
  const created = await createApp(env);

  const badKey = await call(env, 'POST', '/v1/event', {
    appKey: 'mk_not_a_key',
    body: { event: 'ui_click' },
  });
  assert.equal(badKey.status, 401);

  const invalid = await call(env, 'POST', '/v1/event', {
    appKey: created.key,
    body: { event: 'Not Valid!' },
  });
  assert.equal(invalid.status, 400);

  const first = await call(env, 'POST', '/v1/event', {
    appKey: created.key,
    body: { event: 'ui_click', dim1: 'home.red_button', dim2: 'android' },
  });
  assert.equal(first.status, 202);

  await call(env, 'POST', '/v1/event', { appKey: created.key, body: { event: 'ui_click', dim1: 'home.blue_button' } });
  await call(env, 'POST', '/v1/event', { appKey: created.key, body: { event: 'app_open', dim2: 'android' } });

  const stats = await call(env, 'GET', '/v1/stats?days=7', { token: STATS_TOKEN }).then((r) => r.json());
  assert.equal(stats.rangeDays, 7);
  assert.equal(stats.total, 3);
  const demo = stats.apps[0];
  assert.equal(demo.today, 3);
  assert.equal(demo.series.length, 7);
  assert.deepEqual(demo.events, [
    { event: 'ui_click', count: 2 },
    { event: 'app_open', count: 1 },
  ]);
  assert.equal(demo.top[0].count, 1);
});

test('registry is manageable and flags unknown labels server-side when enforced', async () => {
  const env = makeEnv();
  const created = await createApp(env);

  const put = await call(env, 'POST', '/v1/registry', {
    token: ADMIN_TOKEN,
    body: { app: 'demo', event: 'ui_click', dim1: ['home.red_button'] },
  });
  assert.equal(put.status, 200);

  const registry = await call(env, 'GET', '/v1/registry?app=demo', { token: STATS_TOKEN }).then((r) => r.json());
  assert.deepEqual(registry.events, [
    { event: 'ui_click', dim1: ['home.red_button'], dim2: [] },
  ]);

  // Registry enforcement is opt-in per deployment.
  const strictEnv = { ...env, REGISTRY_ENFORCE: '1' };
  const rejected = await call(strictEnv, 'POST', '/v1/event', {
    appKey: created.key,
    body: { event: 'ui_click', dim1: 'home.blue_button' },
  });
  assert.equal(rejected.status, 400);

  const accepted = await call(strictEnv, 'POST', '/v1/event', {
    appKey: created.key,
    body: { event: 'ui_click', dim1: 'home.red_button' },
  });
  assert.equal(accepted.status, 202);

  const strictStats = await call(strictEnv, 'GET', '/v1/stats?days=1', { token: STATS_TOKEN }).then((r) => r.json());
  assert.equal(strictStats.total, 1);
  assert.deepEqual(strictStats.apps[0].unregistered, []);
});

test('stats can be filtered by app and export as CSV', async () => {
  const env = makeEnv();
  const [one, two] = [await createApp(env, 'one'), await createApp(env, 'two', 'Two')];

  await call(env, 'POST', '/v1/event', { appKey: one.key, body: { event: 'ui_click', dim1: 'a' } });
  await call(env, 'POST', '/v1/event', { appKey: two.key, body: { event: 'ui_click', dim1: 'b' } });
  await call(env, 'POST', '/v1/event', { appKey: two.key, body: { event: 'app_open' } });

  const filtered = await call(env, 'GET', '/v1/stats?days=7&app=two', { token: STATS_TOKEN }).then((r) => r.json());
  assert.equal(filtered.apps.length, 1);
  assert.equal(filtered.apps[0].app, 'two');
  assert.equal(filtered.total, 2);

  const unknown = await call(env, 'GET', '/v1/stats?days=7&app=missing', { token: STATS_TOKEN });
  assert.equal(unknown.status, 404);

  const csv = await call(env, 'GET', '/v1/export.csv?app=two&days=7', { token: STATS_TOKEN });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = await csv.text();
  assert.match(text, /^app,day,event,dim1,dim2,count/);
  assert.match(text, /"two","\d{4}-\d{2}-\d{2}","ui_click","b","","1"/);
});
