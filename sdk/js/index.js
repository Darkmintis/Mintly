/**
 * @darkmintis/mintly — tiny browser/Node SDK for Mintly.
 *
 * No cookies, no identifiers: it sends event names, button ids and counts.
 * Fire-and-forget by design — analytics must never break the host app.
 *
 *   const mintly = createMintly({ url, app: 'blink', key: 'mk_...' });
 *   mintly.click('home.red_button', { platform: 'android' });
 *   mintly.appOpen({ platform: 'android' });
 *   mintly.event('share_created', 'privacy');
 */

const DEFAULTS = {
  flushIntervalMs: 4000,
  maxBatch: 8,
  maxQueue: 100,
};

export function createMintly({ url, key, app, fetchImpl, ...options }) {
  if (!url) throw new Error('mintly: url is required');
  if (!key) throw new Error('mintly: key is required');
  const config = { ...DEFAULTS, ...options };
  const endpoint = String(url).replace(/\/+$/, '') + '/v1/event';
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) throw new Error('mintly: no fetch implementation available');

  // Sent with every event so the Worker buckets by the user's local day.
  const timezoneOffset = String(-new Date().getTimezoneOffset());

  let queue = [];
  let timer = null;
  let inFlight = 0;
  let closed = false;

  function schedule() {
    if (timer || closed) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, config.flushIntervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function enqueue(event, dim1 = '', dim2 = '', count = 1) {
    if (closed) return;
    if (queue.length >= config.maxQueue) queue.shift(); // drop oldest, never grow unbounded
    queue.push({ event, dim1, dim2, count });
    if (queue.length >= config.maxBatch) void flush();
    else schedule();
  }

  async function send(entry) {
    inFlight += 1;
    try {
      await doFetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': key,
          'X-Mintly-Tz': timezoneOffset,
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Ignore: analytics is best-effort, privacy-first, never retried forever.
    } finally {
      inFlight -= 1;
    }
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const batch = queue.splice(0, config.maxBatch);
    await Promise.allSettled(batch.map(send));
  }

  function close() {
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return flush();
  }

  return {
    app,
    event(event, dim1 = '', dim2 = '', count = 1) {
      enqueue(String(event), String(dim1 ?? ''), String(dim2 ?? ''), Math.max(1, Math.min(100, count | 0 || 1)));
    },
    click(button, { dim2 = '' } = {}) {
      enqueue('ui_click', String(button ?? ''), String(dim2 ?? ''));
    },
    appOpen({ dim2 = '' } = {}) {
      enqueue('app_open', '', String(dim2 ?? ''));
    },
    flush,
    close,
    get pending() {
      return queue.length + inFlight;
    },
  };
}

export default createMintly;
