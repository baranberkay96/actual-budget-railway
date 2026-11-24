// Set the Actual server password before the public port opens.
//
// Fresh volume: start the server on 127.0.0.1 (not reachable from outside),
// call its own /account/bootstrap endpoint with the password, stop it.
// Existing volume: compare ACTUAL_PASSWORD with the stored hash and update
// it (and end the old password sessions) only when it differs, so a redeploy
// does not log devices out.
//
// Mode "lock" (ACTUAL_PASSWORD empty or too short): never touch an existing
// password; bootstrap a fresh server with a random password nobody knows.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire('/app/package.json');
const argon2 = require('argon2');
const Database = require('better-sqlite3');

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 47104, timeCost: 1, parallelism: 1 };
const TEMP_PORT = 5099;
const dataDir = process.env.ACTUAL_DATA_DIR || '/data';
const serverFiles = process.env.ACTUAL_SERVER_FILES || join(dataDir, 'server-files');
const dbPath = join(serverFiles, 'account.sqlite');
const mode = process.env.RAILWAY_PASSWORD_MODE;
const password = mode === 'set' ? process.env.RAILWAY_ACTUAL_PASSWORD : randomBytes(24).toString('base64url');

const log = msg => console.log(`${new Date().toISOString()} railway-password: ${msg}`);

function storedHash() {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const hasAuth = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth'").get();
    if (!hasAuth) return null;
    const rows = db.prepare('SELECT method, extra_data FROM auth').all();
    if (rows.length === 0) return null;
    const row = rows.find(r => r.method === 'password');
    return { hash: row ? row.extra_data : '', methods: rows.map(r => r.method) };
  } finally {
    db.close();
  }
}

async function matches(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('$argon2')) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

async function updatePassword() {
  const hash = await argon2.hash(password, ARGON2_OPTIONS);
  const db = new Database(dbPath, { fileMustExist: true });
  try {
    db.transaction(() => {
      const changed = db.prepare("UPDATE auth SET extra_data = ? WHERE method = 'password'").run(hash).changes;
      if (changed === 0) throw new Error('no password login method in auth table');
      db.prepare("DELETE FROM sessions WHERE auth_method = 'password'").run();
    })();
  } finally {
    db.close();
  }
}

async function bootstrapFresh() {
  const env = { ...process.env, ACTUAL_HOSTNAME: '127.0.0.1', ACTUAL_PORT: String(TEMP_PORT), PORT: String(TEMP_PORT) };
  delete env.RAILWAY_ACTUAL_PASSWORD;
  const child = spawn('node', ['/app/app.js'], { cwd: '/app', env, stdio: ['ignore', 'ignore', 'inherit'] });
  const exited = new Promise(resolve => child.once('exit', resolve));
  const base = `http://127.0.0.1:${TEMP_PORT}`;
  try {
    let state = null;
    for (let i = 0; i < 120 && state === null; i++) {
      await sleep(1000);
      if (child.exitCode !== null) throw new Error(`temporary server exited with ${child.exitCode}`);
      try {
        const res = await fetch(`${base}/account/needs-bootstrap`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) state = (await res.json()).data;
      } catch {
        // not listening yet
      }
    }
    if (state === null) throw new Error('temporary server did not answer within 120 s');
    if (state.bootstrapped) {
      log('server already has a login method; nothing to bootstrap');
      return;
    }
    const res = await fetch(`${base}/account/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status !== 'ok') throw new Error(`bootstrap failed: HTTP ${res.status} ${body.reason || ''}`);
    log(mode === 'set'
      ? 'server password set from ACTUAL_PASSWORD'
      : 'server locked with a random password; set ACTUAL_PASSWORD (8-128 characters) and redeploy to log in');
  } finally {
    // The temporary server keeps fetch's keep-alive socket open on SIGTERM;
    // the bootstrap is committed to SQLite already, so wait briefly only.
    child.kill('SIGTERM');
    await Promise.race([exited, sleep(3000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

async function main() {
  const stored = storedHash();
  if (stored === null) {
    await bootstrapFresh();
    return;
  }
  if (mode !== 'set') {
    log('ACTUAL_PASSWORD is not valid; the stored password was NOT changed');
    return;
  }
  if (!stored.methods.includes('password')) {
    log(`login method is ${stored.methods.join(', ')} (not password); ACTUAL_PASSWORD is not applied`);
    return;
  }
  if (await matches(stored.hash)) {
    log('server password matches ACTUAL_PASSWORD');
    return;
  }
  await updatePassword();
  log('server password changed to ACTUAL_PASSWORD (devices logged in with the old password must log in again)');
}

main().catch(err => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
