# AGENTS.md — working on Mintly

This file is for coding agents (and humans acting like one). Read it before
changing the repository. It describes the invariants, the commands, and the
workflows you are expected to follow.

## What Mintly is

Privacy-first, anonymous analytics that a user self-hosts on **Cloudflare
Workers + D1**. One deployment = one Worker + one D1 database + many apps. It
counts events (`app, day, event, dim1, dim2, count`) and renders a small
same-origin dashboard. There is no account system, no third-party service, and
no telemetry.

## Golden rules (do not break)

1. **No runtime dependencies.** Only platform APIs: Node >= 20 for CLI/tests,
   workerd/Web APIs for the Worker. Do not add npm packages.
2. **No personal data.** Never add IPs, user agents, cookies, user/device IDs,
   free-form properties, file names, or URLs to events. Event grammar is
   lowercase identifiers only.
3. **SQL only in `src/db.js`.** Handlers never build SQL.
4. **Validation only in `src/validate.js`.** Every API input passes through it.
5. **Responses via `src/http.js`.** Keeps headers and error shapes consistent.
6. **Dashboard is static and same-origin.** No CDNs, fonts, third-party JS, or
   inline `style=`/`onclick=` attributes (the CSP forbids them). Bar widths are
   set through `element.style` in JS.
7. **Secrets never enter the repo.** `STATS_TOKEN`/`ADMIN_TOKEN` are Worker
   secrets; app keys are stored hashed. `.dev.vars` and `.mintly-setup.json`
   are gitignored.

## Repo map

| path | purpose |
|---|---|
| `src/index.js` | router; `/v1/*`, `/health`, dashboard + assets |
| `src/routes/events.js` | public ingest `POST /v1/event` |
| `src/routes/stats.js` | read API: apps, registry, stats, CSV export |
| `src/routes/admin.js` | admin API: create app, edit registry |
| `src/db.js` | every SQL statement |
| `src/validate.js` | input grammars and validation |
| `src/auth.js` | token scopes, app-key hashing, constant-time compare |
| `src/aggregate.js` | pure rows → dashboard payload |
| `src/dashboard/*.js` | dashboard HTML/CSS/JS as string modules |
| `cli/mintly.mjs` | agent-friendly CLI (`--json`, stable exit codes) |
| `mcp/server.mjs` | MCP stdio tools |
| `scripts/setup.mjs` | one-command deploy (`--dry-run` supported) |
| `scripts/preview.mjs` | local dashboard preview with seeded demo data (in-memory D1) |
| `migrations/` | D1 schema; never edit an applied migration |
| `sdk/js/` | optional zero-dep JS SDK (`@darkmintis/mintly`) |
| `examples/` | Flutter, React Native, web helpers |
| `tests/` | `node --test`; fake D1 in `tests/helpers/fake-d1.js` |

## Commands

```bash
node --test tests/            # tests (no install, no network)
node scripts/setup.mjs --dry-run --skip-deploy   # print deploy commands
npm run preview               # local dashboard: http://127.0.0.1:8787/dashboard
npm run dev                   # wrangler dev (needs .dev.vars)
npm run deploy                # wrangler deploy
node cli/mintly.mjs help      # CLI
node mcp/server.mjs           # MCP server on stdio
```

Environment for CLI/MCP/setup:

| variable | scope | used by |
|---|---|---|
| `MINTLY_URL` | deployment origin | CLI, MCP, setup output |
| `MINTLY_STATS_TOKEN` | read-only | CLI stats/export, dashboard login |
| `MINTLY_ADMIN_TOKEN` | admin | CLI app/registry writes, MCP writes |
| `CLOUDFLARE_API_TOKEN` | deploy | `scripts/setup.mjs` |
| `CLOUDFLARE_ACCOUNT_ID` | deploy | optional, for multi-account |

Exit codes (CLI): `0` ok, `1` usage, `2` network/auth, `3` validation.

## Workflow: instrument an app

1. Ensure a deployment exists (`MINTLY_URL` reachable, `GET /health` → ok).
2. Create the app and capture the key **without printing it into committed
   files**:
   ```bash
   node cli/mintly.mjs app add myapp --json
   ```
3. Declare the events/buttons you are about to use:
   ```bash
   node cli/mintly.mjs registry add myapp ui_click --dim1 home.red_button,home.blue_button
   node cli/mintly.mjs registry add myapp app_open
   ```
4. Add tracking calls to the app. Copy the matching helper from `examples/`
   (Flutter, React Native, web) or the SDK in `sdk/js`. Configure URL + public
   key through build-time env / `--dart-define`, not hard-coded strings.
5. Verify with real traffic, then read back:
   ```bash
   node cli/mintly.mjs stats --app myapp --days 1 --group dim1 --json
   ```

## Workflow: answer an analytics question

Use `stats --json` and compute from the payload instead of guessing:

- Which button wins? group by `dim1` where `event === "ui_click"`.
- Click-through proxy: `ui_click / screen_view` (counts only, no sessions).
- Day buckets are local-calendar buckets. Ingest accepts `X-Mintly-Tz`
  (minutes, east positive); the CLI/stats API send `tz` automatically. The
  offset is never stored.
- Forgotten labels show up in each app's `unregistered` array.

## Workflow: change the API or schema

1. Schema: add a **new** file under `migrations/`; never edit `0001_init.sql`.
2. SQL: add functions in `src/db.js`; update `tests/helpers/fake-d1.js` to
   support the new statements.
3. Validation: add grammar/limits in `src/validate.js`.
4. Route: wire it in `src/index.js` behind the correct scope (`stats` for reads,
   `admin` for writes, app key for ingest).
5. Tests: extend `tests/api.test.js` (integration through `worker.fetch`).
6. Docs: update `docs/api.md` and `README.md` if the public surface changed.

## Definition of done

- `node --test tests/` passes.
- No new dependencies, no PII fields, no inline scripts/styles in dashboard HTML.
- Public API/schema changes are documented.
- Secrets are not written to tracked files; `.mintly-setup.json` stays ignored.

## Safety notes for agents

- Never print `STATS_TOKEN`, `ADMIN_TOKEN`, or app keys into logs that are
  committed or shared. Use `--json` and pass values through env vars.
- Never `git push` or deploy unless the human asked. Deploy requires
  `CLOUDFLARE_API_TOKEN`.
- Do not widen scopes: dashboards get `STATS_TOKEN` only.
- Do not invent dimensions such as emails, user ids, or free text; the server
  rejects them anyway.
