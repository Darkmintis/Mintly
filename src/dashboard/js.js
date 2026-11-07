/**
 * Mintly dashboard client. Hand-written, dependency-free, same-origin only.
 * Note: bar widths are applied through element.style so the strict CSP stays
 * free of 'unsafe-inline'.
 */
export const DASHBOARD_JS = `(function () {
  'use strict';

  var TOKEN_KEY = 'mintly_token';
  var APP_KEY = 'mintly_app';
  var state = {
    token: sessionStorage.getItem(TOKEN_KEY) || '',
    days: 7,
    app: localStorage.getItem(APP_KEY) || '',
    apps: [],
    tab: 'overview',
    data: null,
    registry: null,
    registryApp: ''
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function sum(values) { return values.reduce(function (a, b) { return a + b; }, 0); }

  // Day buckets follow the visitor local calendar. The offset is sent with
  // each request/event only to pick the bucket; it is never stored.
  function tzOffset() { return -new Date().getTimezoneOffset(); }

  function toast(message, isError) {
    var el = $('#toast');
    el.textContent = message;
    el.className = 'toast' + (isError ? ' is-error' : '');
    el.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.hidden = true; }, 4200);
  }

  function apiFailure(status, message) {
    var error = new Error(message);
    error.status = status;
    return error;
  }

  function statusMessage(status) {
    if (status === 401) return 'That token was rejected by this deployment.';
    if (status === 403) return 'This token does not have access to that resource.';
    if (status === 404) return 'Not found - the app or endpoint does not exist.';
    if (status === 429) return 'Too many requests. Wait a minute and try again.';
    if (status === 503) return 'This Mintly deployment is not configured yet.';
    if (status >= 500) return 'The Mintly worker hit an error. Try again in a moment.';
    return 'Request failed (' + status + ').';
  }

  function errorPanel(title, err) {
    var message = err && err.message ? err.message : 'Unexpected error';
    var hint = 'If this keeps happening, check the Worker logs (wrangler tail) and verify STATS_TOKEN.';
    if (err && err.status === 0) hint = 'The dashboard cannot reach the Mintly worker. Check the deployment URL and your connection.';
    else if (err && err.status === 429) hint = 'The read API is rate limited to 240 requests per minute. Wait a minute, then retry.';
    else if (err && err.status === 503) hint = 'Set STATS_TOKEN and ADMIN_TOKEN with wrangler secret put, then redeploy.';
    return '<div class="error-panel"><div class="error-title">' + esc(title) + '</div>'
      + '<div class="error-hint">' + esc(message) + '</div>'
      + '<div class="error-hint">' + esc(hint) + '</div>'
      + '<div class="error-actions"><button class="retry-btn" data-retry type="button">Try again</button></div></div>';
  }

  function loginMessage(err) {
    if (err && err.status === 0) return 'Cannot reach this Mintly worker - check the URL and your connection.';
    if (err && err.status === 401) return 'Token rejected. Paste the STATS_TOKEN (or ADMIN_TOKEN) printed by npm run setup.';
    if (err && err.status === 429) return 'Too many attempts - wait a minute and try again.';
    if (err && err.status === 503) return 'This deployment has no tokens configured yet. Run npm run setup first.';
    return 'Could not sign in: ' + (err && err.message ? err.message : 'unknown error');
  }

  function bindRetry(root, handler) {
    var retry = root.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', handler);
  }

  async function api(path, options) {
    var init = Object.assign({ headers: { Authorization: 'Bearer ' + state.token } }, options || {});
    var res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      throw apiFailure(0, 'Cannot reach the Mintly worker. Check the URL and your connection.');
    }
    if (res.status === 401) {
      logout();
      throw apiFailure(401, statusMessage(401));
    }
    if (!res.ok) {
      var payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }
      throw apiFailure(res.status, (payload && payload.error) || statusMessage(res.status));
    }
    var type = res.headers.get('content-type') || '';
    return type.indexOf('application/json') !== -1 ? res.json() : res.text();
  }

  // ---------- sparkline ---------------------------------------------------

  function sparkline(values) {
    var w = 600, h = 92, pad = 6;
    var max = Math.max.apply(null, values.concat([1]));
    var step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    var points = values.map(function (v, i) {
      var x = (pad + i * step).toFixed(1);
      var y = (h - pad - (v / max) * (h - pad * 2)).toFixed(1);
      return x + ',' + y;
    });
    var line = points.join(' ');
    var area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-label="Daily events">'
      + '<defs><linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="rgba(94,234,212,0.32)"/>'
      + '<stop offset="1" stop-color="rgba(94,234,212,0)"/>'
      + '</linearGradient></defs>'
      + '<polygon points="' + area + '" fill="url(#sparkfill)"/>'
      + '<polyline points="' + line + '" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>';
  }

  function barList(items, valueOf, labelOf, limit) {
    var list = items.slice().sort(function (a, b) { return valueOf(b) - valueOf(a); }).slice(0, limit || 12);
    if (list.length === 0) return '<div class="empty"><div class="empty-title">Nothing here yet</div><div class="empty-sub">Send a few events and they will appear within a second.</div></div>';
    var max = valueOf(list[0]) || 1;
    return '<div class="bars">' + list.map(function (item) {
      var value = valueOf(item);
      var pct = Math.max(2, Math.round((value / max) * 100));
      return '<div class="bar-row">'
        + '<div class="bar-label" title="' + esc(labelOf(item)) + '">' + labelOf(item) + '</div>'
        + '<div class="bar-track"><div class="bar-fill" data-pct="' + pct + '"></div></div>'
        + '<div class="bar-value">' + fmt(value) + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function applyBarWidths(root) {
    $$('.bar-fill', root).forEach(function (el) {
      el.style.width = (el.getAttribute('data-pct') || 0) + '%';
    });
  }

  // ---------- data --------------------------------------------------------

  function visibleApps() {
    if (!state.data) return [];
    if (!state.app) return state.data.apps;
    return state.data.apps.filter(function (a) { return a.app === state.app; });
  }

  function combinedSeries() {
    var apps = visibleApps();
    if (apps.length === 0) return [];
    var length = apps[0].series.length;
    var out = [];
    for (var i = 0; i < length; i++) {
      out.push(sum(apps.map(function (a) { return a.series[i] ? a.series[i].count : 0; })));
    }
    return out;
  }

  function allTop() {
    var merged = {};
    visibleApps().forEach(function (a) {
      a.buttons.forEach(function (b) {
        merged[b.dim1] = merged[b.dim1] || { dim1: b.dim1, count: 0 };
        merged[b.dim1].count += b.count;
      });
    });
    return Object.keys(merged).map(function (k) { return merged[k]; });
  }

  function currentAppName() {
    var match = state.apps.filter(function (a) { return a.app === state.app; })[0];
    return match ? match.name : state.app;
  }

  function eventCount(event) {
    return sum(visibleApps().map(function (a) {
      var hit = a.events.filter(function (e) { return e.event === event; })[0];
      return hit ? hit.count : 0;
    }));
  }

  function unregistered() {
    var out = [];
    visibleApps().forEach(function (a) {
      a.unregistered.forEach(function (u) { out.push({ app: a.app, event: u.event, dim1: u.dim1, count: u.count }); });
    });
    return out;
  }

  // ---------- rendering ---------------------------------------------------

  function renderOverview() {
    var root = document.getElementById('tab-overview');
    if (!state.data) { root.innerHTML = '<div class="skeleton"></div>'; return; }
    var apps = visibleApps();
    if (apps.length === 0) {
      root.innerHTML = '<div class="empty">'
        + '<div class="empty-title">No apps yet</div>'
        + '<div class="empty-sub">Create your first app with the CLI, then send an event:<br><code>mintly app add myapp</code> → <code>mintly</code> prints the key.</div>'
        + '</div>';
      return;
    }

    var total = sum(apps.map(function (a) { return a.total; }));
    var today = sum(apps.map(function (a) { return a.today; }));
    var clicks = eventCount('ui_click');
    var opens = eventCount('app_open') + eventCount('app_launch');
    var series = combinedSeries();
    var warn = unregistered();

    var kpis = '<div class="grid kpis">'
      + kpi('Events', fmt(total), lastDaysHint())
      + kpi('Clicks', fmt(clicks), 'event = ui_click')
      + kpi('App opens', fmt(opens), 'event = app_open')
      + kpi('Today', fmt(today), 'since midnight, your time')
      + '</div>';

    var warnHtml = warn.length === 0 ? '' : '<div class="banner"><div><strong>Unregistered buttons detected.</strong> '
      + 'These labels are not declared in the registry: '
      + warn.slice(0, 6).map(function (w) { return '<span class="chip">' + esc(w.app) + ' · ' + esc(w.dim1) + '</span>'; }).join(' ')
      + '. Add them with <code>mintly registry add</code> so typos stay visible.</div></div>';

    var sparkCard = '<div class="card card-pad-lg span-all"><div class="card-head">'
      + '<span class="card-title">Daily events</span><span class="card-sub">' + state.data.rangeDays + ' days</span></div>'
      + '<div class="spark">' + sparkline(series) + '</div></div>';

    var topCard = '<div class="card"><div class="card-head"><span class="card-title">Most clicked buttons</span>'
      + '<span class="card-sub">' + esc(currentAppName()) + '</span></div>'
      + barList(allTop(), function (t) { return t.count; }, function (t) {
        return '<span class="mono">' + esc(t.dim1) + '</span>';
      }, 10)
      + '</div>';

    var eventsCard = '<div class="card card-pad-lg span-all"><div class="card-head">'
      + '<span class="card-title">Events</span><span class="card-sub">' + esc(currentAppName()) + '</span></div>'
      + '<table class="table"><thead><tr><th>Event</th><th class="num">Count</th><th class="num">Share</th></tr></thead><tbody>'
      + (function () {
        var merged = {};
        visibleApps().forEach(function (a) {
          a.events.forEach(function (e) { merged[e.event] = (merged[e.event] || 0) + e.count; });
        });
        var rows = Object.keys(merged).map(function (event) { return { event: event, count: merged[event] }; })
          .sort(function (a, b) { return b.count - a.count; });
        if (rows.length === 0) return '<tr><td colspan="3" class="muted">No events in this range.</td></tr>';
        return rows.map(function (r) {
          return '<tr><td class="mono">' + esc(r.event) + '</td><td class="num">' + fmt(r.count) + '</td>'
            + '<td class="num muted">' + Math.round((r.count / Math.max(total, 1)) * 100) + '%</td></tr>';
        }).join('');
      })()
      + '</tbody></table></div>';

    root.innerHTML = kpis + warnHtml + '<div class="split">' + sparkCard + topCard + eventsCard + '</div>';
    applyBarWidths(root);
  }

  function kpi(label, value, hint) {
    return '<div class="card"><div class="kpi-label">' + esc(label) + '</div>'
      + '<div class="kpi-value">' + value + '</div>'
      + '<div class="kpi-hint">' + esc(hint) + '</div></div>';
  }

  function lastDaysHint() {
    if (!state.data) return '';
    return 'last ' + state.data.rangeDays + ' days';
  }

  function renderRegistry() {
    var root = document.getElementById('tab-registry');
    if (!state.app) {
      root.innerHTML = '<div class="empty"><div class="empty-title">Pick an app</div>'
        + '<div class="empty-sub">The registry lists the events and button ids Mintly knows about for one app. Choose an app in the header.</div></div>';
      return;
    }
    root.innerHTML = '<div class="skeleton"></div>';
    api('/v1/registry?app=' + encodeURIComponent(state.app)).then(function (payload) {
      state.registry = payload;
      var rows = payload.events || [];
      var html = '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">Registry · ' + esc(state.app) + '</span>'
        + '<span class="card-sub">' + rows.length + ' events</span></div>';
      if (rows.length === 0) {
        html += '<div class="empty"><div class="empty-title">Empty registry</div>'
          + '<div class="empty-sub">Declare events and their buttons so unknown labels are flagged:<br><code>mintly registry add ' + esc(state.app) + ' ui_click --dim1 home.red_button,home.blue_button</code></div></div>';
      } else {
        html += '<div class="registry-list">' + rows.map(function (row) {
          return '<div class="registry-item"><span class="registry-event mono">' + esc(row.event) + '</span>'
            + (row.dim1 || []).map(function (d) { return '<span class="chip">' + esc(d) + '</span>'; }).join('')
            + ((row.dim1 || []).length === 0 ? '<span class="muted">any dim1</span>' : '')
            + '</div>';
        }).join('') + '</div>';
      }
      html += '<p class="card-sub mt-14">Read-only here — the registry is edited with the CLI so it stays in version control.</p></div>';
      root.innerHTML = html;
      applyBarWidths(root);
    }).catch(function (err) {
      root.innerHTML = errorPanel('Could not load registry', err);
      bindRetry(root, renderRegistry);
    });
  }

  function renderSettings() {
    var root = document.getElementById('tab-settings');
    var origin = window.location.origin;
    var masked = state.token ? state.token.slice(0, 4) + '••••••••' + state.token.slice(-4) : '';
    var sep = String.fromCharCode(10);
    var curlEvent = ['curl -X POST ' + origin + '/v1/event',
      '  -H "Content-Type: application/json"',
      '  -H "X-App-Key: mk_your_app_key"',
      '  body: {"event":"ui_click","dim1":"home.red_button"}'].join(sep);
    var curlStats = ['curl ' + origin + '/v1/stats?days=7',
      '  -H "Authorization: Bearer $STATS_TOKEN"'].join(sep);
    var apps = state.apps;
    var appOptions = apps.map(function (a) {
      return '<option value="' + esc(a.app) + '"' + (a.app === state.app ? ' selected' : '') + '>' + esc(a.name) + '</option>';
    }).join('');
    root.innerHTML = '<div class="split">'
      + '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">Ingest endpoint</span><span class="card-sub">POST</span></div>'
      + '<div class="codeblock"><button class="copy-btn" data-copy="' + esc(curlEvent) + '">Copy</button><pre>' + esc(curlEvent) + '</pre></div>'
      + '<p class="card-sub mt-12">Send from servers, apps, or browsers. The local calendar day and app identity are assigned by Mintly.</p></div>'
      + '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">Read API</span><span class="card-sub">GET</span></div>'
      + '<div class="codeblock"><button class="copy-btn" data-copy="' + esc(curlStats) + '">Copy</button><pre>' + esc(curlStats) + '</pre></div>'
      + '</div>'
      + '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">Preferences</span><span class="card-sub">saved in this browser</span></div>'
      + '<div class="settings-row"><div class="kv"><dt>Default app</dt><dd>Selected automatically when you open the dashboard.</dd></div>'
      + '<select id="default-app" class="select" aria-label="Default app">' + appOptions + '</select></div>'
      + '</div>'
      + '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">Access</span><span class="card-sub">read-only token</span></div>'
      + '<div class="settings-row"><div class="kv"><dt>Stats token</dt><dd class="mono">' + esc(masked) + '</dd></div>'
      + '<button class="ghost-btn" id="copy-token">Copy token</button></div>'
      + '<div class="settings-row"><div class="kv"><dt>Deployment</dt><dd class="mono">' + esc(origin) + '</dd></div>'
      + '<button class="ghost-btn" id="copy-origin">Copy URL</button></div>'
      + '<div class="settings-row"><div class="kv"><dt>Privacy</dt><dd>Counts only — no cookies, no IPs, no user or device identifiers.</dd></div></div>'
      + '</div>'
      + '<div class="card card-pad-lg"><div class="card-head"><span class="card-title">CLI</span><span class="card-sub">admin actions</span></div>'
      + '<div class="codeblock"><pre>' + esc(['export MINTLY_URL=' + origin, 'export MINTLY_ADMIN_TOKEN=...', 'mintly app add myapp', 'mintly registry add myapp ui_click --dim1 home.red_button,home.blue_button'].join(String.fromCharCode(10))) + '</pre></div>'
      + '<p class="card-sub mt-12">Docs: README.md · AGENTS.md · GitHub.</p></div>'
      + '</div>';
    var copyToken = document.getElementById('copy-token');
    if (copyToken) copyToken.addEventListener('click', function () { copy(state.token); });
    var copyOrigin = document.getElementById('copy-origin');
    if (copyOrigin) copyOrigin.addEventListener('click', function () { copy(origin); });
    var defaultApp = document.getElementById('default-app');
    if (defaultApp) defaultApp.addEventListener('change', function (e) {
      state.app = e.target.value;
      try { localStorage.setItem(APP_KEY, state.app); } catch (err) {}
      document.getElementById('app-select').value = state.app;
      refresh();
    });
    $$('[data-copy]', root).forEach(function (btn) {
      btn.addEventListener('click', function () { copy(btn.getAttribute('data-copy')); });
    });
  }

  function copy(value) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).then(function () { toast('Copied'); });
    } else {
      toast('Clipboard unavailable in this browser', true);
    }
  }

  // ---------- navigation & loading ---------------------------------------

  function switchTab(tab) {
    state.tab = tab;
    $$('.nav-item').forEach(function (el) { el.classList.toggle('is-active', el.getAttribute('data-tab') === tab); });
    ['overview', 'registry', 'settings'].forEach(function (name) {
      document.getElementById('tab-' + name).hidden = name !== tab;
    });
    var titles = { overview: 'Overview', registry: 'Registry', settings: 'Settings' };
    var subs = {
      overview: 'Anonymous counts · no cookies · no identifiers',
      registry: 'Declared events and button ids · edited from the CLI',
      settings: 'Endpoints, access, and privacy'
    };
    document.getElementById('page-title').textContent = titles[tab];
    document.getElementById('page-sub').textContent = subs[tab];
    if (tab === 'overview') refresh();
    if (tab === 'registry') renderRegistry();
    if (tab === 'settings') renderSettings();
  }

  async function refresh() {
    if (state.tab !== 'overview') return;
    var root = document.getElementById('tab-overview');
    root.innerHTML = '<div class="skeleton"></div>';
    try {
      var query = '?days=' + state.days + '&tz=' + tzOffset() + (state.app ? '&app=' + encodeURIComponent(state.app) : '');
      var results = await Promise.all([api('/v1/stats' + query), api('/v1/apps')]);
      state.data = results[0];
      state.apps = results[1].apps;
      populateApps();
      renderOverview();
    } catch (err) {
      root.innerHTML = errorPanel('Could not load stats', err);
      bindRetry(root, refresh);
    }
  }

  function populateApps() {
    var select = document.getElementById('app-select');
    var apps = state.apps;
    // The API returns apps alphabetically; default to the first one.
    select.innerHTML = apps.map(function (a) {
      return '<option value="' + esc(a.app) + '">' + esc(a.name) + '</option>';
    }).join('');
    var known = apps.some(function (a) { return a.app === state.app; });
    if (!known) state.app = apps.length > 0 ? apps[0].app : '';
    if (state.app) {
      select.value = state.app;
      try { localStorage.setItem(APP_KEY, state.app); } catch (err) {}
    }
  }

  function bindUi() {
    $$('.nav-item').forEach(function (el) {
      el.addEventListener('click', function () { switchTab(el.getAttribute('data-tab')); });
    });
    $$('#range button').forEach(function (el) {
      el.addEventListener('click', function () {
        state.days = Number(el.getAttribute('data-days')) || 7;
        $$('#range button').forEach(function (b) { b.classList.toggle('is-active', b === el); });
        refresh();
      });
    });
    document.getElementById('app-select').addEventListener('change', function (e) {
      state.app = e.target.value;
      try { localStorage.setItem(APP_KEY, state.app); } catch (err) {}
      if (state.tab === 'overview') refresh();
      if (state.tab === 'registry') renderRegistry();
      if (state.tab === 'settings') renderSettings();
    });
    document.getElementById('refresh').addEventListener('click', function () { refresh(); });
    document.getElementById('logout').addEventListener('click', logout);
  }

  function bindLoginToggle() {
    var toggle = document.getElementById('token-toggle');
    var input = document.getElementById('token-input');
    if (!toggle || !input) return;
    toggle.addEventListener('click', function () {
      input.type = input.type === 'password' ? 'text' : 'password';
      var isText = input.type === 'text';
      var open = toggle.querySelector('.eye-open');
      var closed = toggle.querySelector('.eye-closed');
      if (open) open.hidden = isText;
      if (closed) closed.hidden = !isText;
      var label = isText ? 'Hide token' : 'Show token';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    });
  }

  function showApp() {
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    state.token = '';
    state.data = null;
    document.getElementById('app').hidden = true;
    document.getElementById('login').hidden = false;
    document.getElementById('token-input').value = '';
  }

  async function start() {
    if (!state.token) return;
    try {
      await api('/v1/apps');
      showApp();
      bindUi();
      await refresh();
    } catch (err) {
      logout();
      toast(loginMessage(err), true);
    }
  }

  document.getElementById('login-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var input = document.getElementById('token-input');
    var errorEl = document.getElementById('login-error');
    var button = document.getElementById('login-btn');
    errorEl.hidden = true;
    state.token = input.value.trim();
    if (!state.token) return;
    button.disabled = true;
    button.textContent = 'Checking...';
    try {
      await api('/v1/apps');
      sessionStorage.setItem(TOKEN_KEY, state.token);
      showApp();
      bindUi();
      await refresh();
      toast('Connected');
    } catch (err) {
      state.token = '';
      errorEl.textContent = loginMessage(err);
      errorEl.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = 'Open dashboard';
    }
  });

  bindLoginToggle();
  start();
})();`;
