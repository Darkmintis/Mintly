import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dayKey,
  dayRange,
  parseDays,
  parseTz,
  utcDay,
  validateAppBody,
  validateEventBody,
  validateRegistryBody,
} from '../src/validate.js';

test('utcDay uses the UTC calendar', () => {
  assert.equal(utcDay(new Date('2026-11-07T23:59:00Z')), '2026-11-07');
  assert.equal(utcDay(new Date('2026-11-08T00:01:00Z')), '2026-11-08');
});

test('dayRange returns the requested number of ascending UTC days', () => {
  const days = dayRange(7, new Date('2026-11-07T12:00:00Z'));
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-11-01');
  assert.equal(days[6], '2026-11-07');
});

test('day bucketing follows the client timezone offset', () => {
  // 2026-11-07T20:00Z is already 2026-11-08 in Nepal (UTC+5:45).
  const evening = new Date('2026-11-07T20:00:00Z');
  assert.equal(dayKey(evening), '2026-11-07');
  assert.equal(dayKey(evening, 345), '2026-11-08');
  assert.equal(dayKey(evening, -300), '2026-11-07');

  const range = dayRange(3, evening, 345);
  assert.deepEqual(range, ['2026-11-06', '2026-11-07', '2026-11-08']);
});

test('parseTz clamps and rejects bad offsets', () => {
  assert.equal(parseTz('345'), 345);
  assert.equal(parseTz('-300'), -300);
  assert.equal(parseTz('840'), 840);
  assert.equal(parseTz('841'), 0);
  assert.equal(parseTz('-841'), 0);
  assert.equal(parseTz('nope'), 0);
  assert.equal(parseTz(undefined), 0);
});

test('parseDays clamps to 1..365 with a fallback', () => {
  assert.equal(parseDays('30'), 30);
  assert.equal(parseDays('0'), 7);
  assert.equal(parseDays('366'), 7);
  assert.equal(parseDays('nope', 14), 14);
  assert.equal(parseDays(undefined, 30), 30);
});

test('event body accepts the documented shape', () => {
  const result = validateEventBody({ event: 'ui_click', dim1: 'home.red_button', dim2: 'android' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { event: 'ui_click', dim1: 'home.red_button', dim2: 'android', count: 1 });
});

test('event body rejects unsafe names, free text and bad counts', () => {
  assert.equal(validateEventBody({ event: 'UI Click' }).ok, false);
  assert.equal(validateEventBody({ event: 'ui_click', dim1: 'user@example.com' }).ok, false);
  assert.equal(validateEventBody({ event: 'ui_click', dim1: 'home red' }).ok, false);
  assert.equal(validateEventBody({ event: 'ui_click', count: 0 }).ok, false);
  assert.equal(validateEventBody({ event: 'ui_click', count: 101 }).ok, false);
  assert.equal(validateEventBody({ event: 'ui_click', count: 2.5 }).ok, false);
  assert.equal(validateEventBody('nope').ok, false);
});

test('event body allows empty dimensions and caps count', () => {
  assert.equal(validateEventBody({ event: 'app_open' }).ok, true);
  const capped = validateEventBody({ event: 'app_open', count: 100 });
  assert.equal(capped.ok, true);
  assert.equal(capped.value.count, 100);
});

test('app body validates slugs and trims names', () => {
  assert.equal(validateAppBody({ app: 'blink' }).ok, true);
  assert.equal(validateAppBody({ app: 'Blink!' }).ok, false);
  assert.equal(validateAppBody({ app: 'a' }).ok, false);
  const named = validateAppBody({ app: 'blink', name: '  Blink  ' });
  assert.equal(named.value.name, 'Blink');
});

test('registry body dedupes and validates dimensions', () => {
  const result = validateRegistryBody({
    app: 'blink',
    event: 'ui_click',
    dim1: ['home.red_button', 'home.red_button'],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.dim1, ['home.red_button']);

  assert.equal(validateRegistryBody({ app: 'blink', event: 'ui_click', dim1: ['bad label'] }).ok, false);
  assert.equal(validateRegistryBody({ app: 'blink', event: 'ui_click', dim1: 'ok_id' }).ok, false);
});
