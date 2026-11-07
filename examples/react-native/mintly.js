// Mintly — React Native helper (zero dependencies, uses global fetch).
//
//   import { configure, click, appOpen } from './mintly';
//   configure({ url: 'https://mintly.example.workers.dev', key: 'mk_...' });
//   click('home.red_button');
//   appOpen();
//
// Events are queued and flushed in small batches; failures are ignored.

let config = { url: '', key: '' };
let queue = [];
let timer = null;
const FLUSH_MS = 4000;
const MAX_BATCH = 8;

export function configure({ url, key }) {
  config = { url: String(url || '').replace(/\/+$/, ''), key: String(key || '') };
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_MS);
}

function enqueue(event, dim1 = '', dim2 = '', count = 1) {
  if (!config.url || !config.key) return;
  if (queue.length >= 100) queue.shift();
  queue.push({ event, dim1, dim2, count });
  if (queue.length >= MAX_BATCH) void flush();
  else schedule();
}

export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue.splice(0, MAX_BATCH);
  await Promise.allSettled(batch.map((entry) => fetch(config.url + '/v1/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': config.key },
    body: JSON.stringify(entry),
  }).catch(() => undefined)));
}

export function event(name, dim1 = '', dim2 = '', count = 1) {
  enqueue(name, dim1, dim2, count);
}

export function click(button, { platform = 'android' } = {}) {
  enqueue('ui_click', button, platform);
}

export function appOpen({ platform = 'android' } = {}) {
  enqueue('app_open', '', platform);
}
