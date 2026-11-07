import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bearerToken,
  generateAppKey,
  generateToken,
  safeEqual,
  sha256Hex,
} from '../src/auth.js';

test('sha256Hex matches the well-known digest', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('generated app keys are prefixed and unguessably long', () => {
  const key = generateAppKey();
  assert.match(key, /^mk_[A-Za-z0-9]{32}$/);
  assert.notEqual(key, generateAppKey());
});

test('generated deployment tokens are 64 hex chars', () => {
  const token = generateToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.notEqual(token, generateToken());
});

test('safeEqual compares without boolean short-circuit surprises', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test('bearerToken parses well-formed Authorization headers only', () => {
  const withHeader = new Request('https://x.test', { headers: { Authorization: 'Bearer abc123' } });
  assert.equal(bearerToken(withHeader), 'abc123');

  const lower = new Request('https://x.test', { headers: { Authorization: 'bearer abc123' } });
  assert.equal(bearerToken(lower), 'abc123');

  const none = new Request('https://x.test');
  assert.equal(bearerToken(none), null);

  const basic = new Request('https://x.test', { headers: { Authorization: 'Basic abc123' } });
  assert.equal(bearerToken(basic), null);
});
