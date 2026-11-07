# Mintly

**Privacy-first, anonymous product analytics for Cloudflare Workers.**

Self-host in a few minutes: **one Worker + one D1 database**. Count the things
that matter — clicks, app opens, button taps, feature use — without cookies,
consent banners, user IDs, device IDs, IPs, or third-party scripts.

> Status: **v0.1 alpha**, Cloudflare-only. MIT licensed. Agent-first by design.
> Runs on **Node 24** (see `.nvmrc`); the CLI and tests also work on Node 20+.

## Why Mintly

- **Answers the useful question:** "Which button/screen/feature do people
  actually use?" with daily counters and top-button rankings.
- **No surveillance by construction.** Events are `app + event + dim1 + dim2 +
  count`. There is nothing personal to leak, sell, or misuse.
- **Boring to run.** One Worker, one D1, static dashboard, no build step for
  deployment, free-tier friendly (D1 Free: 100k row writes/day).
- **Agent-first.** The CLI is a stable, `--json` interface, and an MCP server
  lets coding agents set up and query Mintly without manual dashboard clicks.
- **Not tied to one platform.** HTTP API plus copy-paste helpers for Flutter,
  React Native, and the web; the optional JS SDK is 0 dependencies.
- **Deliberately not** a session/retention/heatmap/replay tool. Those need
  identifiers; Mintly refuses them.

## Quick start (self-host)

1. Deploy (creates the Worker, D1, migrations and secrets):

   ```bash
   npx wrangler login            # or: export CLOUDFLARE_API_TOKEN=...
   npm run setup                 # prints your dashboard URL and tokens
   ```

2. Create an app and copy its key (shown once):

   ```bash
   export MINTLY_URL=https://mintly.<you>.workers.dev
   export MINTLY_STATS_TOKEN=...   # from setup
   export MINTLY_ADMIN_TOKEN=...   # from setup
   node cli/mintly.mjs app add myapp
   ```

3. Optionally declare events and button ids (used to flag unknown labels):

   ```bash
   node cli/mintly.mjs registry add myapp ui_click \
     --dim1 home.red_button,home.blue_button
   ```

4. Send events from anywhere:

   ```bash
   curl -X POST "$MINTLY_URL/v1/event" \
     -H "Content-Type: application/json" \
     -H "X-App-Key: mk_your_key" \
     -d '{"event":"ui_click","dim1":"home.red_button","dim2":"android"}'
   ```

5. Open `https://<your-worker>/dashboard` and paste `STATS_TOKEN`.

Integrations live in [`examples/`](examples): Flutter, React Native, web, plus
the zero-dependency JS SDK in [`sdk/js`](sdk/js).

## How it works

```
app / web / backend ──POST /v1/event (X-App-Key)──► Mintly Worker
                                                       │
dashboard ◄──GET /v1/stats (Bearer STATS_TOKEN)──► D1 (events_daily counters)
```

- App keys are stored **hashed**. The plaintext key is returned once.
- The **Worker assigns the UTC day**; clients never send timestamps.
- `STATS_TOKEN` is **read-only**; `ADMIN_TOKEN` creates apps and edits the
  registry. Dashboard sessions only ever hold the read-only token.
- Each ingest request increments one daily aggregate row.

Data model (see [`migrations/0001_init.sql`](migrations/0001_init.sql)):

| table | holds |
|---|---|
| `apps` | app slug, display name, hashed key |
| `registry` | declared events + allowed button ids |
| `events_daily` | `app, day, event, dim1, dim2, count` |

## Dashboard

Served by the same Worker, same origin, strict CSP (`default-src 'none'`), no
cookies, no external assets:

- **Overview** — totals, daily chart, per-app counts, top buttons.
- **App view** — top buttons with bars, event breakdown, approximate CTR
  (`ui_click ÷ screen_view`), unregistered-label warnings.
- **Registry** — read-only list of declared events/buttons (CLI manages it).
- **Settings** — default app (saved in the browser), local timezone, token
  (masked), endpoints, curl snippets, CLI examples.

There is no "all apps" view: the dashboard opens the alphabetically first app
and remembers your choice. Day buckets follow the local calendar of whoever
sends the event; the dashboard displays your local time.

Preview it locally with seeded demo data (no Cloudflare account, no network):

```bash
npm run preview   # http://127.0.0.1:8787/dashboard · token: preview-local-token
```

The preview runs the real Worker code against an in-memory D1 stand-in with two
weeks of demo data for four apps (Blink, Flare, NeverEnd, LinkMesh).

## Agent usage

```bash
node cli/mintly.mjs app add blink --json          # { app, key }
node cli/mintly.mjs registry add blink ui_click --dim1 home.red_button
node cli/mintly.mjs stats --app blink --days 7 --group dim1 --json
node cli/mintly.mjs mcp                           # MCP stdio server
```

MCP tools: `mintly_list_apps`, `mintly_query_stats`, `mintly_add_app`,
`mintly_add_event`. Point agents at [`AGENTS.md`](AGENTS.md) for repo rules and
end-to-end workflows.

## Privacy

Mintly stores **aggregate counts only**. No IP addresses, user agents, cookies,
user IDs, device IDs, referrers, or file contents. Day buckets follow the
sender's local calendar date; the timezone offset itself is never stored. No
telemetry inside Mintly itself. Nothing is sent to a third party — you own the
Worker, the database and the dashboard. See [`SECURITY.md`](SECURITY.md).

## Cloudflare-only (for now)

Mintly targets Cloudflare Workers + D1 because it makes self-hosting a five
minute, free-tier operation. The storage layer is isolated in `src/db.js` so a
second backend can be added without touching handlers.

## Docs

- [API reference](docs/api.md)
- [Self-hosting guide](docs/self-hosting.md)
- [Agent guide](AGENTS.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT — see [LICENSE](LICENSE).
