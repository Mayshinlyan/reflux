#!/usr/bin/env bash
# Run the app's dev server from the worktree you're in, as the one shared server.
#
# Every worktree uses the same port (8081), so the phone always connects to the same place: starting
# it here stops the Expo/Metro server another worktree had running there. Before starting, it copies
# app/.env from the main checkout if this worktree has none, and installs dependencies when
# package-lock.json changed since the last install here.
#
# Usage: scripts/test-app.sh [--prepare-only]
#   --prepare-only  set everything up but do not start Expo
#
# To test another branch, run it from a worktree on that branch.
set -euo pipefail

START=1
for arg in "$@"; do
  case "$arg" in
    --prepare-only) START=0 ;;
    -h | --help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "✗ Unknown argument '$arg'. Run it from the worktree you want to serve." >&2
      exit 1
      ;;
  esac
done

# The worktree this copy of the script lives in, and the main checkout (first worktree).
HERE="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
COMMON_DIR="$(git -C "$HERE" rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$COMMON_DIR")"
APP="$HERE/app"
PORT=8081

BRANCH="$(git -C "$HERE" branch --show-current || true)"
echo "→ Serving $HERE"
echo "  on ${BRANCH:-detached HEAD} at $(git -C "$HERE" log -1 --format='%h %s')"

# .env is git-ignored, so every worktree needs its own copy. Without it the app fails with a
# misleading AUTH_FAILED ("We couldn't connect").
if [ ! -f "$APP/.env" ]; then
  if [ -f "$ROOT/app/.env" ]; then
    echo "→ Copying app/.env from the main checkout"
    cp "$ROOT/app/.env" "$APP/.env"
  else
    echo "! No app/.env here or in $ROOT/app: the app will not be able to reach the relay." >&2
  fi
fi

# Reinstall only when the lockfile changed since the last install here.
LOCK_HASH="$(shasum "$APP/package-lock.json" | cut -d' ' -f1)"
STAMP="$APP/node_modules/.lock-hash"
if [ ! -d "$APP/node_modules" ] || [ "$(cat "$STAMP" 2>/dev/null || true)" != "$LOCK_HASH" ]; then
  echo "→ Installing dependencies (npm ci)…"
  (cd "$APP" && npm ci --no-audit --no-fund --loglevel=error)
  echo "$LOCK_HASH" >"$STAMP"
else
  echo "→ Dependencies up to date"
fi

if [ "$START" -eq 0 ]; then
  echo "✓ Ready. Start it with: $HERE/scripts/test-app.sh"
  exit 0
fi

# One shared server: stop the Metro/Expo dev server already on the port, whichever worktree it
# serves, so the phone connects to this one. Anything else holding the port is left alone.
for pid in $(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if echo "$cmd" | grep -qiE 'expo|metro|react-native'; then
    echo "→ Stopping the dev server already on port $PORT (pid $pid)"
    kill "$pid" 2>/dev/null || true
  else
    echo "✗ Port $PORT is in use by something that isn't Expo/Metro (pid $pid: $cmd)." >&2
    exit 1
  fi
done

# Wait for the old server to let go of the port; in a background run nobody can answer Expo's
# "use another port?" prompt.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
  sleep 1
done
if lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Port $PORT is still in use after stopping the old server. Try again in a moment." >&2
  exit 1
fi

echo "✓ Starting Expo from $APP on port $PORT"
cd "$APP"
exec npx expo start --clear --port "$PORT"
