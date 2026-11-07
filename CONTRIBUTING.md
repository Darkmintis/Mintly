# Contributing to Mintly

Mintly is a privacy-first, dependency-free tool. Contributions should keep it
small and predictable.

## Ground rules

- **No runtime dependencies.** The Worker, CLI, SDK and dashboard must run on
  platform APIs only (Node >= 20, workerd). Do not add npm packages.
- **No personal data, ever.** Events are `app + event + dim1 + dim2 + count` and
  nothing else. Do not add IP, UA, cookies, user ids, or free-form properties.
- **SQL lives in `src/db.js`.** Handlers never build SQL strings.
- **Validation lives in `src/validate.js`.** All API input goes through it.
- **Responses use `src/http.js` helpers** so headers and error shapes stay
  consistent.
- **Dashboard stays static and same-origin.** No CDNs, no third-party JS, no
  inline styles/scripts (the CSP forbids them).

## Local development

```bash
npm test                 # node:test, no install needed
npm run dev              # wrangler dev + local D1
npm run db:migrate:local # apply migrations to the local D1
```

For local secrets, copy `.dev.vars.example` to `.dev.vars` and use any values.

## Pull requests

1. One concern per PR; keep diffs reviewable.
2. Tests must pass (`npm test`), and new API/schema behaviour needs a test.
3. If you change the API or schema, update `README.md`, `docs/api.md`, and add a
   migration (never edit an existing migration).
4. Data shape changes must stay backward compatible with the ingest contract.
5. Write commit messages as `type(scope): summary` (feat, fix, docs, test,
   refactor, chore).

## Adding an endpoint

1. Add the route in `src/index.js` behind the right token scope.
2. Put validation in `src/validate.js`, SQL in `src/db.js`.
3. Return data through `src/http.js` helpers.
4. Add a test in `tests/api.test.js` (see `tests/helpers/fake-d1.js`).
5. Document it in `docs/api.md`.

## Release

- Tag `v0.x.y`; the SDK under `sdk/js` is published separately
  (`@darkmintis/mintly`) once it stabilises.
- Migrations are applied with `wrangler d1 migrations apply mintly --remote`.
