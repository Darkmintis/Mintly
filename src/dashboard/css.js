/**
 * Mintly dashboard stylesheet. Self-contained: no fonts, images, or scripts are
 * loaded from anywhere except this deployment.
 */
export const DASHBOARD_CSS = `/* ==========================================================================
   Mintly — mint-on-charcoal dashboard
   ========================================================================== */

:root {
  --bg: #070b0a;
  --bg-soft: #0a100e;
  --surface: #0e1614;
  --surface-2: #111c19;
  --surface-3: #16231f;
  --border: rgba(94, 234, 212, 0.13);
  --border-soft: rgba(255, 255, 255, 0.06);
  --text: #e8f5f1;
  --muted: #8aa39d;
  --faint: #5d736e;
  --accent: #5eead4;
  --accent-2: #34d399;
  --accent-ink: #04231d;
  --accent-soft: rgba(94, 234, 212, 0.1);
  --warn: #fbbf24;
  --warn-soft: rgba(251, 191, 36, 0.12);
  --danger: #fb7185;
  --radius-lg: 20px;
  --radius: 14px;
  --radius-sm: 10px;
  --shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.75);
  --font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}

* { box-sizing: border-box; }

html { color-scheme: dark; }

body {
  margin: 0;
  min-height: 100vh;
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(900px 520px at 8% -8%, rgba(94, 234, 212, 0.16), transparent 60%),
    radial-gradient(760px 460px at 96% -4%, rgba(52, 211, 153, 0.1), transparent 55%),
    radial-gradient(900px 700px at 62% 112%, rgba(45, 212, 191, 0.07), transparent 60%),
    var(--bg);
}

::selection { background: rgba(94, 234, 212, 0.28); color: #f4fffc; }

h1, h2, h3, p { margin: 0; }

code, pre { font-family: var(--mono); font-size: 12.5px; }

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

button, input, select { font: inherit; color: inherit; }

:focus-visible {
  outline: 2px solid rgba(94, 234, 212, 0.6);
  outline-offset: 2px;
}

.muted { color: var(--muted); }
.hidden, [hidden] { display: none !important; }

/* ---------- Brand -------------------------------------------------------- */

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
}

.brand-mark { display: inline-flex; filter: drop-shadow(0 4px 14px rgba(94, 234, 212, 0.28)); }

.brand-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-lg { padding: 0; gap: 12px; }
.brand-lg .brand-name { font-size: 22px; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* ---------- Login -------------------------------------------------------- */

.login-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px;
}

.login-card {
  width: 100%;
  max-width: 430px;
  padding: 34px 32px 28px;
  border-radius: 24px;
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
    var(--surface);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}

.login-title {
  margin-top: 22px;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.login-sub {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13.5px;
}

.login-sub code {
  padding: 1px 5px;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--accent);
}

#login-form { margin-top: 22px; }

.field-label {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.field {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--bg-soft);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field:hover { border-color: var(--border); }
.field:focus { border-color: rgba(94, 234, 212, 0.45); box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.09); outline: none; }

.login-error {
  margin-top: 12px;
  color: var(--danger);
  font-size: 13px;
}

.login-foot {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
  color: var(--faint);
  font-size: 12px;
}

/* ---------- Buttons ------------------------------------------------------ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.btn:active { transform: translateY(1px); }

.btn-primary {
  width: 100%;
  margin-top: 14px;
  background: linear-gradient(180deg, #6ef0dc, #34d399);
  color: var(--accent-ink);
  box-shadow: 0 10px 26px -10px rgba(52, 211, 153, 0.65);
}

.btn-primary:hover { filter: brightness(1.05); }
.btn-primary:disabled { opacity: 0.6; cursor: progress; }

.ghost-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.ghost-btn:hover { border-color: var(--border); color: var(--text); }

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--border-soft);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.2s ease;
}

.icon-btn:hover { color: var(--accent); border-color: var(--border); }
.icon-btn:active svg { transform: rotate(90deg); }
.icon-btn svg { transition: transform 0.25s ease; }

/* ---------- Layout ------------------------------------------------------- */

.app {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px 16px 18px;
  border-right: 1px solid var(--border-soft);
  background: rgba(10, 16, 14, 0.72);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  height: 100vh;
}

.nav { display: flex; flex-direction: column; gap: 4px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.nav-item:hover { color: var(--text); background: rgba(255, 255, 255, 0.03); }

.nav-item.is-active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(94, 234, 212, 0.18);
}

.nav-item.is-active svg { color: var(--accent); }

.sidebar-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
  font-size: 12px;
}

.main { min-width: 0; display: flex; flex-direction: column; }

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border-soft);
  background: rgba(7, 11, 10, 0.72);
  backdrop-filter: blur(14px);
}

.topbar-title h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.topbar-title p { margin-top: 2px; font-size: 12.5px; }

.controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.select {
  height: 34px;
  padding: 0 30px 0 11px;
  border-radius: 9px;
  border: 1px solid var(--border-soft);
  background: var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238aa39d' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 11px center;
  appearance: none;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}

.select:hover { border-color: var(--border); }

.segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: var(--bg-soft);
}

.segmented button {
  height: 27px;
  min-width: 42px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.segmented button:hover { color: var(--text); }

.segmented button.is-active {
  color: var(--accent);
  background: rgba(94, 234, 212, 0.12);
}

.content { padding: 26px 28px 64px; }

/* ---------- Cards & KPIs ------------------------------------------------- */

.grid { display: grid; gap: 16px; }

.kpis {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
}

.card {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.008)),
    var(--surface);
  padding: 18px 20px;
  min-width: 0;
}

.card-pad-lg { padding: 22px 24px; }

.kpi-label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.kpi-value {
  margin-top: 10px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}

.kpi-hint { margin-top: 3px; color: var(--faint); font-size: 12px; }

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-title {
  font-size: 14.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.card-sub { color: var(--faint); font-size: 12px; }

.spark { margin-top: 4px; }
.spark svg { display: block; width: 100%; height: 92px; overflow: visible; }

/* ---------- Tables ------------------------------------------------------- */

.table { width: 100%; border-collapse: collapse; }

.table th {
  padding: 8px 10px;
  text-align: left;
  color: var(--faint);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-soft);
}

.table td {
  padding: 11px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}

.table tbody tr:last-child td { border-bottom: 0; }

.table tbody tr { transition: background 0.12s ease; }
.table tbody tr:hover { background: rgba(94, 234, 212, 0.035); }

.num { text-align: right; }

.app-cell { display: flex; align-items: center; gap: 10px; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--accent-2);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.7);
  flex: none;
}

.mono { font-family: var(--mono); font-size: 12.5px; }

/* ---------- Bars --------------------------------------------------------- */

.bars { display: flex; flex-direction: column; gap: 13px; }

.bar-row { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr) 62px; align-items: center; gap: 14px; }

.bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 13px;
}

.bar-label .mono { color: var(--muted); }
.bar-label b { font-weight: 600; }

.bar-track {
  height: 9px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.055);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, rgba(94, 234, 212, 0.55), rgba(52, 211, 153, 0.95));
  box-shadow: 0 0 18px rgba(94, 234, 212, 0.25);
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.bar-fill.alt {
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.45), rgba(251, 191, 36, 0.85));
  box-shadow: 0 0 18px rgba(251, 191, 36, 0.18);
}

.bar-value { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12.5px; }

/* ---------- Misc content ------------------------------------------------- */

.split { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; align-items: start; }

/* Layout helpers (CSP forbids inline style attributes). */
.span-all { grid-column: 1 / -1; }
.mt-12 { margin-top: 12px; }
.mt-14 { margin-top: 14px; }

.banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 16px;
  margin-bottom: 16px;
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: var(--radius);
  background: var(--warn-soft);
  color: #fde68a;
  font-size: 13px;
}

.banner strong { color: #fef3c7; }

.empty {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 58px 24px;
  border: 1px dashed var(--border-soft);
  border-radius: var(--radius);
  text-align: center;
}

.empty-title { font-size: 15px; font-weight: 650; }
.empty-sub { max-width: 420px; color: var(--muted); font-size: 13px; }

.empty code, .settings-code {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--accent);
}

.codeblock {
  position: relative;
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: #060a09;
  color: #c7e7df;
  overflow-x: auto;
}

.codeblock pre { margin: 0; white-space: pre; }

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  height: 26px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.copy-btn:hover { color: var(--accent); border-color: var(--border); }

.registry-list { display: flex; flex-direction: column; gap: 10px; }

.registry-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
}

.registry-event { font-weight: 650; font-size: 13px; }

.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11.5px;
}

.defs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }

.kv { display: grid; gap: 6px; }

.kv dt { color: var(--faint); font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.kv dd { margin: 0; font-size: 13.5px; word-break: break-all; }

.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.settings-row:last-child { border-bottom: 0; }

/* ---------- Skeleton & toast -------------------------------------------- */

.skeleton {
  height: 86px;
  border-radius: var(--radius);
  border: 1px solid var(--border-soft);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.toast {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 60;
  max-width: 380px;
  padding: 12px 15px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-2);
  box-shadow: var(--shadow);
  font-size: 13px;
  animation: toast-in 0.2s ease;
}

.toast.is-error { border-color: rgba(251, 113, 133, 0.4); color: #fecdd3; }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---------- Responsive --------------------------------------------------- */

@media (max-width: 1080px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .split { grid-template-columns: minmax(0, 1fr); }
  .defs { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 820px) {
  .app { grid-template-columns: minmax(0, 1fr); }
  .sidebar {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-right: 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .nav { flex-direction: row; flex: 1; justify-content: flex-end; }
  .nav-item { width: auto; padding: 7px 10px; }
  .nav-item span { display: none; }
  .sidebar-foot { display: none; }
  .topbar { flex-direction: column; align-items: flex-start; padding: 14px 16px; }
  .content { padding: 18px 16px 48px; }
  .bar-row { grid-template-columns: minmax(0, 1fr) 56px; }
  .bar-track { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
