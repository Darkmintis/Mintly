# Mintly API

Base URL: your deployment origin, e.g. `https://mintly.<you>.workers.dev`.
All bodies are JSON. Errors are `{"error": "message"}` with a non-2xx status.

Authentication has two layers:

| credential | header | scope |
|---|---|---|
| app key (`mk_...`) | `X-App-Key` | ingest only, one app |
| `STATS_TOKEN` | `Authorization: Bearer ...` | read-only |
| `ADMIN_TOKEN` | `Authorization: Bearer ...` | read + create app + edit registry |

---

## `POST /v1/event` — ingest (public, app key)

```bash
curl -X POST "$MINTLY_URL/v1/event" \
  -H "Content-Type: application/json" \
  -H "X-App-Key: mk_..." \
  -d '{"event":"ui_click","dim1":"home.red_button","dim2":"android"}'
```

| field | type | notes |
|---|---|---|
| `event` | string | `^[a-z][a-z0-9_]{1,39}$` — required |
| `dim1` | string | button/screen label, `^[a-z0-9][a-z0-9_.:-]{0,63}$` |
| `dim2` | string | optional second dimension (platform, version…) |
| `count` | integer | 1–100, default 1 |

Optional header `X-Mintly-Tz`: the sender's timezone offset in minutes (east
positive, `-840`…`840`). It is used only to pick the local calendar day and is
**never stored** — the row keeps a date, not a timezone.

The app identity and the local calendar day are assigned by the server. Clients
cannot send timestamps or app names.

Responses: `202` accepted · `400` invalid body · `401` bad app key ·
`429` rate limited (240 requests/minute per app + IP, per isolate) · `405`.

---

## `GET /v1/apps` — list apps

`Authorization: Bearer $STATS_TOKEN`

```json
{ "apps": [ { "app": "blink", "name": "Blink", "created_at": 1762390000000 } ] }
```

## `POST /v1/apps` — create an app (admin)

```bash
curl -X POST "$MINTLY_URL/v1/apps" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"app":"blink","name":"Blink"}'
```

`201` response — **the key is shown once and stored hashed**:

```json
{ "app": "blink", "name": "Blink", "key": "mk_...", "createdAt": 1762390000000 }
```

Errors: `409` already exists, `400` invalid slug.

---

## `GET /v1/registry?app=slug` — declared events

`Authorization: Bearer $STATS_TOKEN`

```json
{
  "app": "blink",
  "events": [
    { "event": "ui_click", "dim1": ["home.red_button", "home.blue_button"], "dim2": [] }
  ]
}
```

## `POST /v1/registry` — declare an event (admin)

```bash
curl -X POST "$MINTLY_URL/v1/registry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"app":"blink","event":"ui_click","dim1":["home.red_button","home.blue_button"]}'
```

The registry is used to flag unknown labels in the dashboard and to generate
typed constants for SDKs (optional). Setting `REGISTRY_ENFORCE=1` rejects
events whose `dim1` is not listed for that event.

---

## `GET /v1/stats?days=7&app=blink` — aggregates

`Authorization: Bearer $STATS_TOKEN` — `days` is 1–365 (default
`DEFAULT_RANGE_DAYS`), `app` is optional, and `tz` is the viewer's timezone
offset in minutes (east positive, optional) so day buckets match local time.

```json
{
  "generatedAt": "2026-11-07T10:00:00.000Z",
  "rangeDays": 7,
  "timezoneOffsetMinutes": 345,
  "days": ["2026-11-01", "…", "2026-11-07"],
  "total": 1234,
  "apps": [
    {
      "app": "blink",
      "name": "Blink",
      "total": 1234,
      "today": 87,
      "series": [{ "day": "2026-11-01", "count": 121 }],
      "events": [{ "event": "ui_click", "count": 900 }],
      "buttons": [{ "dim1": "home.red_button", "count": 620 }],
      "top": [{ "event": "ui_click", "dim1": "home.red_button", "count": 620 }],
      "unregistered": []
    }
  ]
}
```

`top` is every dimension across events; `buttons` is the same list filtered to
`ui_click` targets — use `buttons` for "which button is clicked most".

`unregistered` lists labels not declared in the registry (typos are visible).
Because only counts exist, a click-through proxy is `ui_click ÷ screen_view`;
there are no per-user funnels by design.

---

## `GET /v1/export.csv?app=blink&days=30` — raw counters as CSV

`Authorization: Bearer $STATS_TOKEN`

```csv
app,day,event,dim1,dim2,count
"blink","2026-11-07","ui_click","home.red_button","android",3
```

---

## `GET /health`

```json
{ "ok": true, "name": "mintly", "version": "0.1.0", "registryEnforced": false }
```

---

## Limits

- Ingest: 240 requests/minute per app + IP per Worker isolate (in-memory).
- Reads: 240 requests/minute per IP per isolate.
- `count`: 1–100; one row written per ingest for the day bucket.
- D1 Free: 100k row writes/day, 5M reads/day — plenty for indie-scale apps.
