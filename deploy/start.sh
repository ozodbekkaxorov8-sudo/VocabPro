#!/bin/bash
set -eu

if [[ -n "${DATABASE_CA_CERTIFICATE:-}" ]]; then
    PGSSLROOTCERT=$(mktemp)
    printf '%s\n' "$DATABASE_CA_CERTIFICATE" > "$PGSSLROOTCERT"
    export PGSSLROOTCERT
fi

uvicorn vocabpro.main:app --host 127.0.0.1 --port 8001 &
api_pid=$!
HOSTNAME=0.0.0.0 node /app/frontend/server.js &
web_pid=$!

shutdown() {
    kill -TERM "$api_pid" "$web_pid" 2>/dev/null || true
    wait "$api_pid" "$web_pid" 2>/dev/null || true
}

trap shutdown EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

wait -n "$api_pid" "$web_pid"
exit 1
