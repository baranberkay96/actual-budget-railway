#!/bin/bash
# Start the Actual Budget sync server on Railway.
#
# 1. Check the variables. A bad value never stops the deploy: PORT falls back
#    to 5006, and an empty or too short ACTUAL_PASSWORD locks the server with a
#    random password instead of leaving it open (STANDARD 8.29).
# 2. Set the server password from ACTUAL_PASSWORD before the public port
#    opens (railway-password.mjs). A fresh volume is bootstrapped through a
#    temporary server on 127.0.0.1; an existing one gets the password updated
#    only when it differs from the stored one.
# 3. exec the server on [::]:$PORT.
set -euo pipefail

DEFAULT_PORT=5006
MIN_PASSWORD=8
MAX_PASSWORD=128

log() { printf '%s railway-start: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

port=${PORT:-$DEFAULT_PORT}
if ! [[ $port =~ ^[0-9]{1,5}$ ]] || ((port < 1 || port > 65535)); then
  log "PORT='$port' is not a valid port; using $DEFAULT_PORT"
  port=$DEFAULT_PORT
fi
export ACTUAL_PORT=$port
export ACTUAL_HOSTNAME=${ACTUAL_HOSTNAME:-::}
export ACTUAL_DATA_DIR=${ACTUAL_DATA_DIR:-/data}
mkdir -p "$ACTUAL_DATA_DIR/server-files" "$ACTUAL_DATA_DIR/user-files"

password=${ACTUAL_PASSWORD:-}
if ((${#password} < MIN_PASSWORD || ${#password} > MAX_PASSWORD)); then
  log "WARNING: ACTUAL_PASSWORD must be $MIN_PASSWORD-$MAX_PASSWORD characters (has ${#password})." \
      "The stored password is kept; a fresh server gets a random password nobody knows." \
      "Set a valid ACTUAL_PASSWORD on the service and redeploy to log in."
  export RAILWAY_PASSWORD_MODE=lock
else
  export RAILWAY_PASSWORD_MODE=set
fi
export RAILWAY_ACTUAL_PASSWORD=$password
unset ACTUAL_PASSWORD password

# The password step must succeed: an unbootstrapped server would let the
# first visitor choose the password. Retry a few times before giving up.
for attempt in 1 2 3; do
  if node /railway/railway-password.mjs; then
    break
  fi
  if ((attempt == 3)); then
    log "ERROR: could not set the server password; not starting the public server."
    exit 1
  fi
  log "Password step failed (attempt $attempt); retrying in 5 s"
  sleep 5
done
unset RAILWAY_ACTUAL_PASSWORD RAILWAY_PASSWORD_MODE

log "Starting Actual sync server on [$ACTUAL_HOSTNAME]:$ACTUAL_PORT (data in $ACTUAL_DATA_DIR)"
exec node /app/app.js
