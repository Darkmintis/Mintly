# Security policy

Mintly is a self-hosted analytics tool. It stores **aggregate counters only**:
no cookies, no IP addresses, no user agents, no user or device identifiers.

## Reporting a vulnerability

Please report privately via GitHub Security Advisories on
https://github.com/Darkmintis/Mintly/security/advisories — do not open a public
issue for security problems.

Include: affected version/commit, impact, reproduction steps, and any suggested
fix. We aim to acknowledge within 7 days.

## Design properties (what the project promises)

- App keys are stored **hashed** (SHA-256); the plaintext key is returned once.
- Deployment tokens (`STATS_TOKEN`, `ADMIN_TOKEN`) live in Worker secrets, never
  in the repository or D1. They are compared in constant time.
- `STATS_TOKEN` is read-only. Only `ADMIN_TOKEN` can create apps or edit the
  registry.
- Ingest accepts only app-scoped event names, lowercase dimensions and integer
  counts; it never accepts timestamps or free-form text from clients.
- No third-party scripts, fonts, or analytics in the dashboard; the CSP is
  `default-src 'none'` with same-origin assets only.
- No telemetry or phone-home from Mintly itself.

## Out of scope

Mintly cannot protect against someone with your deployment tokens, a compromised
Cloudflare account, or data stored by the ad/analytics SDKs you choose to add
alongside it. D1 access should be limited to the Worker binding.
