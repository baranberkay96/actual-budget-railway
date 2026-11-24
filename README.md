# Deploy and Host Actual Budget with Railway

Actual Budget is an open-source, local-first personal finance app built around envelope (zero-based) budgeting. This template runs the official Actual sync server on Railway: it serves the web app, keeps your budgets in sync across browsers and devices, and is protected by a server password that is set before the server goes online.

## About Hosting Actual Budget

Actual keeps a full copy of each budget in the browser and uses the sync server to store files and exchange changes between devices. Hosting it means one small Node.js service, a persistent volume for the SQLite files, HTTPS (browsers need a secure context for the app's storage) and a server password. A fresh Actual server asks the first visitor to choose that password, so an unprotected deploy can be claimed by anyone who finds the URL. This community template pins the official 26.11.0 image, mounts a Railway volume at `/data`, and sets the server password from a generated variable on a private loopback port before the public port opens. Login is limited to the password (or OpenID, if you configure it); header-based auth is turned off.

## Common Use Cases

- Zero-based / envelope budgeting as a self-hosted YNAB alternative
- One budget shared across laptop, phone browser and the desktop app, kept in sync
- Importing bank statements (OFX, QFX, QIF, CSV, CAMT) and tracking spending with rules and reports
- Optional bank sync (GoCardless, SimpleFIN, Enable Banking, Pluggy.ai) configured in the app
- End-to-end encrypted budgets so the server stores data it cannot read

## Dependencies for Actual Budget Hosting

- One service built from the official `actualbudget/actual-server` image (no external database)
- A Railway volume at `/data` for server and budget files (SQLite)

### Deployment Dependencies

- [Actual Budget documentation](https://actualbudget.org/docs/)
- [Server configuration reference](https://actualbudget.org/docs/config/)
- [Actual on GitHub](https://github.com/actualbudget/actual)
- [Release notes](https://actualbudget.org/docs/releases)

### Implementation Details

| Service | What runs inside | Volume | Port |
|---|---|---|---|
| Actual | Actual sync server 26.11.0 (serves the web app) | `/data` (account database, budget files) | 5006, public domain |

**First login**

1. Open `https://{your-domain}`.
2. Enter the server password from the `ACTUAL_PASSWORD` variable (generated at deploy; see the service's Variables tab).
3. Create a new budget, or import one from YNAB 4, nYNAB or an Actual export.

**Password handling.** `ACTUAL_PASSWORD` is the source of truth and is checked at every start. If it differs from the stored password, the stored one is replaced and devices logged in with the old password must log in again; if it matches, nothing changes. A password changed only inside the app is reset to the variable on the next redeploy, so change the variable instead. A value shorter than 8 characters is ignored with a warning in the deploy log: an existing password stays, and a brand-new server is locked with a random password until you set a valid one.

**Bank sync and encryption.** Bank sync providers are configured in the app under Settings and need accounts with those providers. You can turn on end-to-end encryption per budget in the app; keep that key safe, the server cannot recover it.

**OpenID.** To log in through an OpenID provider instead of the password, set `ACTUAL_OPENID_DISCOVERY_URL`, `ACTUAL_OPENID_CLIENT_ID`, `ACTUAL_OPENID_CLIENT_SECRET` and `ACTUAL_OPENID_SERVER_HOSTNAME` (`https://{your-domain}`) on the service, or enable it in the app's settings. See the Actual docs on OpenID before switching an existing server.

**Limits.** Budget uploads are capped by `ACTUAL_UPLOAD_FILE_SYNC_SIZE_LIMIT_MB` (20) and `ACTUAL_UPLOAD_SYNC_ENCRYPTED_FILE_SYNC_SIZE_LIMIT_MB` (50); raise them for very large budgets.

**Backups.** The app can export a budget as a ZIP (Settings, Export). Railway volume backups cover the whole `/data` directory.

**Scaling and upgrades.** Actual is a single-instance server with SQLite on a volume: keep one replica. It idled at 0.2–0.3 GB RAM in our tests and fits the Trial plan. To upgrade, eject the repo and change the image tag and digest in `services/actual/Dockerfile` to a newer `actualbudget/actual-server` release, then redeploy; database migrations run on start. Read the release notes first, and export your budgets before major upgrades.

### Why Deploy Actual Budget on Railway?

Railway runs the sync server with HTTPS, a persistent volume and automatic restarts, so your budget is reachable from every device without managing a server. This template adds a pinned image, a healthcheck and a server password that is set before anyone can reach the setup page.
