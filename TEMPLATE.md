# TEMPLATE: Actual Budget 26.11 (Personal Finance, Sync Server)

Composer spec. `template.json` is the machine-readable copy.

## Service

| Field | Value |
|---|---|
| Name | Actual |
| Source | repo `baranberkay96/actual-budget-railway`, root `/services/actual` |
| Base | `actualbudget/actual-server:26.11.0@sha256:06cf1865…` (Debian bookworm-slim, Node 24; pushed 2026-11-02, latest release on 2026-11-24) |
| Public domain | yes, target port 5006 |
| Healthcheck | `/health`, 300 s |
| Restart | ALWAYS |
| Volume | `/data` (`server-files/account.sqlite`, `user-files/*`) |

Variables: `ACTUAL_PASSWORD` (secret 24), `PORT` (5006), `ACTUAL_UPLOAD_FILE_SYNC_SIZE_LIMIT_MB` (20), `ACTUAL_UPLOAD_SYNC_ENCRYPTED_FILE_SYNC_SIZE_LIMIT_MB` (50), `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (10). Image ENV: `ACTUAL_DATA_DIR=/data`, `ACTUAL_LOGIN_METHOD=password`, `ACTUAL_ALLOWED_LOGIN_METHODS=password,openid`. No required inputs.

## Design

- `railway-start.sh` (bash): validates PORT (bad → 5006), password length 8–128 (bad → "lock" mode), creates the data folders, runs `railway-password.mjs` (3 attempts; if it cannot set a password the public server is not started, fail closed), then `exec node /app/app.js` on `[::]:$PORT`.
- `railway-password.mjs` (STANDARD 8.37): fresh volume → spawns the server on `127.0.0.1:5099`, waits for `/account/needs-bootstrap`, POSTs `/account/bootstrap {password}`, stops it. Existing volume → `argon2.verify` against the stored hash; update hash + delete password sessions only if different. Lock mode never changes an existing password and bootstraps a fresh server with a random one (8.29).
- Upstream's `/health` returns `{"status":"UP"}` without auth.

## Improvements over market templates

- Market templates (`AaOh7O` 141 deploys, `actual-personal-finance`, `actual-budget`) use unpinned `latest` images, have no healthcheck, and leave the "set server password" page open to the first visitor. This one pins 26.11.0 by digest, sets the password from a generated variable before the port opens, limits login methods to password/OpenID, sets a healthcheck and a drain time for SQLite.

## Resources

| Service | Idle RAM | Typical RAM | CPU |
|---|---|---|---|
| Actual | 0.20–0.30 GB measured (Railway graph, incl. page cache) | 0.3–0.5 GB during password hashing and large syncs | ≈0 idle |

Estimated cost: ≈$1–3/month + volume ($0.15/GB-month). Minimum plan: Trial.

## Verification checklist

- `/health` 200; `/account/needs-bootstrap` shows `bootstrapped: true` right after the first deploy.
- `/account/login` with `ACTUAL_PASSWORD` returns a token; a wrong password is refused.
- Create a budget file via the UI or sync API; it survives a redeploy.
- `ACTUAL_PASSWORD=abc` → deploy SUCCESS, warning in log, old password still works.
- Changing `ACTUAL_PASSWORD` to a new valid value → new password works after redeploy.

## Open questions

- If the owner switches to OpenID in the app, `ACTUAL_PASSWORD` is no longer applied (logged). Mixed password/OpenID setups were not tested.
