# Self-hosting Mintly

Mintly runs entirely in **your** Cloudflare account: one Worker, one D1
database, one static dashboard. Nothing is hosted by Darkmintis.

## Requirements

- A Cloudflare account (Workers Free plan is enough).
- Node.js >= 20 locally (no npm dependencies to install).
- Wrangler once: `npx wrangler login`, **or** an API token with
  `Workers Scripts:Edit` + `D1:Edit` permissions exported as
  `CLOUDFLARE_API_TOKEN` (plus `CLOUDFLARE_ACCOUNT_ID` if the token can see
  multiple accounts).

## Automated setup

```bash
git clone https://github.com/Darkmintis/Mintly.git
cd Mintly
npx wrangler login          # skip if CLOUDFLARE_API_TOKEN is exported
npm run setup               # creates D1, applies migrations, sets secrets, deploys
```

`npm run setup` prints your dashboard URL and two tokens:

- `STATS_TOKEN` — read-only. Paste it into the dashboard; give it to
  read-only agents/dashboards.
- `ADMIN_TOKEN` — admin. CLI/MCP only; never ship it in an app or dashboard.

Tokens are also written to `.mintly-setup.json` (gitignored). Delete that file
after saving them somewhere safe.

Preview the exact deployment commands without running them:

```bash
npm run setup -- --dry-run
```

## Manual setup

```bash
npx wrangler d1 create mintly
# paste the printed database_id into wrangler.toml
npx wrangler d1 migrations apply mintly --remote
npx wrangler secret put STATS_TOKEN   # value: a random 64-char hex string
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

## First app

```bash
export MINTLY_URL=https://mintly.<you>.workers.dev
export MINTLY_STATS_TOKEN=...
export MINTLY_ADMIN_TOKEN=...
node cli/mintly.mjs app add myapp        # prints the app key once
node cli/mintly.mjs registry add myapp ui_click --dim1 home.red_button
```

Then paste `STATS_TOKEN` into `$MINTLY_URL/dashboard`.

## Custom domain

1. Cloudflare dashboard → Workers & Pages → `mintly` → Settings → Domains &
   Routes → Add custom domain (e.g. `mintly.darkmintis.dev`).
2. Workers on a custom domain are served over HTTPS automatically; no other
   change is required. Update `MINTLY_URL` wherever you set it.

## Local development

```bash
cp .dev.vars.example .dev.vars      # any values work locally
npm run db:migrate:local
npm run dev                          # http://localhost:8787
curl http://localhost:8787/health
```

## Updates

```bash
git pull
npx wrangler d1 migrations apply mintly --remote
npm run deploy
```

## Backups

D1 has point-in-time recovery (Time Travel). Keep it simple:

```bash
npx wrangler d1 export mintly --remote --output mintly-backup.sql
```

Your dashboard is read-only; a lost database only loses aggregate counts.

## Costs

- Workers Free: 100k requests/day.
- D1 Free: 5M rows read/day, **100k rows written/day**, 5 GB storage, 10 DBs.
- Ingest writes one row per event request. At 10 apps × 5k events/day you use
  about 5% of the free write allowance.

## Troubleshooting

| symptom | fix |
|---|---|
| `CLOUDFLARE_API_TOKEN is not set` | run `npx wrangler login` or export a scoped token |
| dashboard says "Unauthorized" | you pasted an app key or the admin token; use `STATS_TOKEN` |
| `No apps yet` | create one: `mintly app add <slug>` |
| events don't appear | wrong app key, or the request body failed validation (400) — check `wrangler tail` |
| all labels show as unregistered | declare them: `mintly registry add` |
| restore an old D1 | `wrangler d1 time-travel restore mintly --timestamp ...` |
