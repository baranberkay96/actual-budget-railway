# NOTICE: Actual Budget template

This is a community template. It is not made, endorsed or supported by the Actual Budget project or Railway.

## Components

| Component | Source | License | How it is used |
|---|---|---|---|
| Actual sync server 26.11.0 (`actualbudget/actual-server:26.11.0@sha256:06cf186569cf58d93e12659ff1a517b65b5b0ebee7050a3991d4bd8a1d398da6`) | https://github.com/actualbudget/actual | MIT (Copyright James Long) | Official image, unmodified, used as the base image |

## Files written for this template

`services/actual/Dockerfile`, `services/actual/railway-start.sh`, `services/actual/railway-password.mjs` and the documentation were written for this template and are offered under the MIT License. `railway-password.mjs` loads the `argon2` and `better-sqlite3` modules that ship inside the official image and uses the same Argon2id parameters and `auth`/`sessions` tables as Actual's `src/accounts/password.js`.

## Upstream files checked (tag v26.11.0)

- `packages/sync-server/docker/ubuntu.Dockerfile`, `docker-compose.yml` (volume `/data`, port 5006)
- `packages/sync-server/app.ts`, `src/app.ts` (`/health`, migrations before listen), `src/app-account.js` (`/account/needs-bootstrap`, `/account/bootstrap`)
- `src/account-db.js`, `src/accounts/password.js` (bootstrap, Argon2id hashing, password change), `src/load-config.js` (environment variable names and defaults)

## Market templates

The Railway marketplace templates `AaOh7O` (Actual Budget), `actual-budget` and `actual-personal-finance` were reviewed for features only. No files or text were copied.
