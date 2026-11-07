import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStats } from '../src/aggregate.js';

const days = ['2026-11-05', '2026-11-06', '2026-11-07'];

function app(name) {
  return { app: name, name: name.toUpperCase() };
}

test('buildStats totals, series and today bucket', () => {
  const payload = buildStats({
    apps: [app('demo')],
    registry: [],
    days,
    rows: [
      { app: 'demo', day: '2026-11-05', event: 'ui_click', dim1: 'home.red_button', dim2: '', count: 3 },
      { app: 'demo', day: '2026-11-07', event: 'ui_click', dim1: 'home.blue_button', dim2: '', count: 2 },
      { app: 'demo', day: '2026-11-07', event: 'app_open', dim1: '', dim2: 'android', count: 1 },
    ],
  });

  assert.equal(payload.total, 6);
  const demo = payload.apps[0];
  assert.equal(demo.total, 6);
  assert.equal(demo.today, 3);
  assert.deepEqual(demo.series.map((entry) => entry.count), [3, 0, 3]);
  assert.deepEqual(demo.events, [
    { event: 'ui_click', count: 5 },
    { event: 'app_open', count: 1 },
  ]);
  assert.deepEqual(demo.top, [
    { event: 'ui_click', dim1: 'home.red_button', count: 3 },
    { event: 'ui_click', dim1: 'home.blue_button', count: 2 },
  ]);
  assert.deepEqual(demo.buttons, [
    { dim1: 'home.red_button', count: 3 },
    { dim1: 'home.blue_button', count: 2 },
  ]);
});

test('buildStats flags unregistered dims only when there is a registry entry', () => {
  const payload = buildStats({
    apps: [app('demo')],
    days,
    registry: [
      { app: 'demo', event: 'ui_click', dim1_allow: '["home.red_button"]', dim2_allow: '[]' },
    ],
    rows: [
      { app: 'demo', day: '2026-11-07', event: 'ui_click', dim1: 'home.red_button', dim2: '', count: 4 },
      { app: 'demo', day: '2026-11-07', event: 'ui_click', dim1: 'home.blue_button', dim2: '', count: 2 },
      { app: 'demo', day: '2026-11-07', event: 'app_open', dim1: '', dim2: '', count: 9 },
    ],
  });

  const demo = payload.apps[0];
  assert.deepEqual(demo.unregistered, [{ event: 'ui_click', dim1: 'home.blue_button', count: 2 }]);
});

test('buildStats keeps apps with no activity and ignores unknown apps', () => {
  const payload = buildStats({
    apps: [app('quiet'), app('demo')],
    registry: [],
    days,
    rows: [
      { app: 'ghost', day: '2026-11-07', event: 'ui_click', dim1: 'x', dim2: '', count: 5 },
      { app: 'demo', day: '2026-11-07', event: 'ui_click', dim1: 'x', dim2: '', count: 1 },
    ],
  });
  assert.equal(payload.total, 1);
  const quiet = payload.apps.find((entry) => entry.app === 'quiet');
  assert.equal(quiet.total, 0);
  assert.deepEqual(quiet.series.map((entry) => entry.count), [0, 0, 0]);
});
