/**
 * Dashboard shell. Served as plain HTML with a strict CSP; the only external
 * resources are this deployment's own JS and CSS.
 */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mintly — privacy-first analytics</title>
<meta name="description" content="Anonymous, cookie-free product analytics. Clicks, app opens, counts. Self-hosted on Cloudflare.">
<meta name="theme-color" content="#070b0a">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%235eead4'/%3E%3Cpath d='M9 22V9l7 7 7-7v13' stroke='%2304231d' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>

<div id="login" class="login-wrap">
  <div class="login-card">
    <div class="brand brand-lg">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="34" height="34"><rect width="32" height="32" rx="9" fill="#5eead4"/><path d="M9 22V9l7 7 7-7v13" stroke="#04231d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="brand-name">Mintly</span>
    </div>
    <h1 class="login-title">Anonymous analytics, self-hosted.</h1>
    <p class="login-sub">Counts only. No cookies, no user IDs, no third parties. Paste the
      <code>STATS_TOKEN</code> printed by <code>npm run setup</code>.</p>
    <form id="login-form" autocomplete="off">
      <label class="field-label" for="token-input">Stats token</label>
      <div class="field-wrap">
        <input id="token-input" class="field" type="password" placeholder="paste STATS_TOKEN" spellcheck="false" autocomplete="off">
        <button id="token-toggle" class="field-toggle" type="button" aria-label="Show token" title="Show token">
          <svg class="eye-open" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M1.8 10S4.8 5 10 5s8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
          <svg class="eye-closed" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" hidden><path d="M1.8 10S4.8 5 10 5s8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3.4 3.4l13.2 13.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <button id="login-btn" class="btn btn-primary" type="submit">Open dashboard</button>
      <p id="login-error" class="login-error" hidden></p>
    </form>
    <p class="login-foot">Read-only access. Create apps and edit the registry with the mintly CLI.</p>
  </div>
</div>

<div id="app" class="app" hidden>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="9" fill="#5eead4"/><path d="M9 22V9l7 7 7-7v13" stroke="#04231d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="brand-name">Mintly</span>
    </div>
    <nav class="nav" id="nav">
      <button class="nav-item is-active" data-tab="overview">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M3 11h3v6H3zM8.5 6h3v11h-3zM14 9h3v8h-3z" fill="currentColor"/></svg>
        <span>Overview</span>
      </button>
      <button class="nav-item" data-tab="registry">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M4 3h12v3H4zM4 8.5h12v3H4zM4 14h7v3H4z" fill="currentColor"/></svg>
        <span>Registry</span>
      </button>
      <button class="nav-item" data-tab="settings">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M2.8 6.5h6.6M14 6.5h3.2M2.8 13.5h2M8.9 13.5h8.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="11.7" cy="6.5" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6.9" cy="13.5" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        <span>Settings</span>
      </button>
    </nav>
    <div class="sidebar-foot">
      <span class="pill">MIT</span>
      <span class="muted">v0.1.0</span>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div class="topbar-title">
        <h1 id="page-title">Overview</h1>
        <p id="page-sub" class="muted">Anonymous counts · no cookies · no identifiers</p>
      </div>
      <div class="controls">
        <select id="app-select" class="select" aria-label="App"></select>
        <div class="segmented" id="range" role="group" aria-label="Range">
          <button data-days="7" class="is-active">7d</button>
          <button data-days="30">30d</button>
          <button data-days="90">90d</button>
        </div>
        <button id="refresh" class="icon-btn" title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M15.5 8.2A6 6 0 1 0 16 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 4v4h-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button id="logout" class="ghost-btn">Sign out</button>
      </div>
    </header>

    <section id="tab-overview" class="content"></section>
    <section id="tab-registry" class="content" hidden></section>
    <section id="tab-settings" class="content" hidden></section>
  </main>
</div>

<div id="toast" class="toast" hidden></div>
<script src="/assets/app.js" defer></script>
</body>
</html>`;
