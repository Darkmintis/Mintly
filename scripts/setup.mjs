#!/usr/bin/env node
/**
 * One-command self-hosting for Mintly on Cloudflare.
 *
 *   npx wrangler login          # once, or export CLOUDFLARE_API_TOKEN
 *   npm run setup               # creates D1, migrations, secrets, deploys
 *
 * Agent-friendly: no interactive questions; all auth comes from the
 * CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID environment variables.
 * Use --dry-run to print the exact commands without executing them.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_DEPLOY = args.has('--skip-deploy');
const DB_NAME = 'mintly';
const DB_ID_PLACEHOLDER = 'REPLACE_WITH_YOUR_D1_ID';

const token = () => randomBytes(32).toString('hex');
const STATS_TOKEN = token();
const ADMIN_TOKEN = token();

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(label, command, commandArgs, input) {
  if (DRY_RUN) {
    log(`[dry-run] ${command} ${commandArgs.join(' ')}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  log(`\n→ ${label}`);
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    input: input ?? undefined,
    env: { ...process.env, CI: 'true' },
    shell: process.platform === 'win32',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    log(`\n✗ ${label} failed (exit ${result.status}).`);
    log('  If this is an auth error, run `npx wrangler login` or set CLOUDFLARE_API_TOKEN.');
    process.exit(1);
  }
  return result;
}

function patchWranglerToml(databaseId) {
  const file = new URL('../wrangler.toml', import.meta.url);
  const source = readFileSync(file, 'utf8');
  if (source.includes(DB_ID_PLACEHOLDER)) {
    writeFileSync(file, source.replace(DB_ID_PLACEHOLDER, databaseId), 'utf8');
    log(`  wrote database_id to wrangler.toml`);
  } else {
    log('  wrangler.toml already has a database_id — leaving it as is');
  }
}

function detectDeployUrl(stdout) {
  const match = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i.exec(stdout);
  return match ? match[0] : '';
}

function main() {
  log('Mintly setup — one Worker + one D1 database, all apps inside.');
  if (!DRY_RUN && !process.env.CLOUDFLARE_API_TOKEN) {
    log('\nCLOUDFLARE_API_TOKEN is not set.');
    log('Run `npx wrangler login` once, or create a scoped API token (Workers Scripts:Edit, D1:Edit)');
    log('and export it: export CLOUDFLARE_API_TOKEN=...');
    process.exit(1);
  }

  const wrangler = ['wrangler'];
  let stdout = '';

  const create = run('create D1 database', 'npx', [...wrangler, 'd1', 'create', DB_NAME]);
  stdout += create.stdout ?? '';
  const idMatch = /database_id"?\s*[=:]\s*"([0-9a-f-]{36})"/i.exec(stdout);
  if (!DRY_RUN) {
    if (!idMatch) {
      log('\n✗ Could not read the D1 database id from wrangler output.');
      log('  If the database already exists, paste its id into wrangler.toml manually.');
      process.exit(1);
    }
    patchWranglerToml(idMatch[1]);
  }

  run('apply migrations', 'npx', [...wrangler, 'd1', 'migrations', 'apply', DB_NAME, '--remote'], 'y\n');

  run('set STATS_TOKEN (read-only dashboards)', 'npx', [...wrangler, 'secret', 'put', 'STATS_TOKEN'], `${STATS_TOKEN}\n`);
  run('set ADMIN_TOKEN (CLI admin actions)', 'npx', [...wrangler, 'secret', 'put', 'ADMIN_TOKEN'], `${ADMIN_TOKEN}\n`);

  if (!SKIP_DEPLOY) {
    const deploy = run('deploy Worker', 'npx', [...wrangler, 'deploy']);
    stdout += deploy.stdout ?? '';
  }

  const url = detectDeployUrl(stdout);

  if (DRY_RUN) {
    log('\n────────────────────────────────────────────────────────────');
    log('Dry run complete — no resources were created and no tokens were printed.');
    log('Run `npm run setup` (without --dry-run) to deploy for real.');
    log('────────────────────────────────────────────────────────────');
    return;
  }

  const summary = {
    url: url || '(check the deploy output above)',
    dashboard: url ? `${url}/dashboard` : '(url)/dashboard',
    statsToken: STATS_TOKEN,
    adminToken: ADMIN_TOKEN,
    createdAt: new Date().toISOString(),
  };

  if (!DRY_RUN) {
    writeFileSync(new URL('../.mintly-setup.json', import.meta.url), JSON.stringify(summary, null, 2), 'utf8');
  }

  log('\n────────────────────────────────────────────────────────────');
  log('Mintly is deployed.');
  log(`  Dashboard : ${summary.dashboard}`);
  log(`  Stats token (read-only, paste into the dashboard):`);
  log(`    ${STATS_TOKEN}`);
  log(`  Admin token (CLI only — keep it out of dashboards and apps):`);
  log(`    ${ADMIN_TOKEN}`);
  log('');
  log('  Next:');
  log('    export MINTLY_URL=' + (url || 'https://your-worker.workers.dev'));
  log('    export MINTLY_STATS_TOKEN=' + STATS_TOKEN);
  log('    export MINTLY_ADMIN_TOKEN=' + ADMIN_TOKEN);
  log('    node cli/mintly.mjs app add myapp');
  log('');
  log('  Tokens were also written to .mintly-setup.json (gitignored). Delete it after saving them.');
  log('────────────────────────────────────────────────────────────');

  if (!existsSync(new URL('../.dev.vars', import.meta.url))) {
    log('\nLocal dev: copy .dev.vars.example to .dev.vars and run `npm run dev`.');
  }
}

main();
