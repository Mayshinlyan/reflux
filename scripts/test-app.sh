#!/usr/bin/env bash
# Get the app ready to test, always from the same folder, so Expo never needs re-pointing.
#
# Keeps a throwaway worktree at <repo>/.claude/worktrees/test-app on a ref (default:
# origin/main), copies app/.env from the main checkout, installs dependencies when
# package-lock.json changed, stops any running Metro server, then starts a fresh one.
#
# Usage: scripts/test-app.sh [ref] [--prepare-only]
#   ref             branch, tag or commit to test (default: origin/main)
#   --prepare-only  set everything up but do not start Expo
#
# The test worktree is disposable: local edits in it are discarded on the next run.
# Do your real work in another worktree or branch.
set -euo pipefail

REF="origin/main"
START=1
for arg in "$@"; do
  case "$arg" in
    --prepare-only) START=0 ;;
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) REF="$arg" ;;
  esac
done

# The main checkout (first worktree), wherever this is run from.
COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$COMMON_DIR")"
TEST_DIR="$ROOT/.claude/worktrees/test-app"
PORT="${RCT_METRO_PORT:-8081}"

echo "→ Fetching origin…"
git -C "$ROOT" fetch --quiet --prune origin

# Accept "my-branch" as well as "origin/my-branch" / tags / SHAs; prefer the remote copy.
if git -C "$ROOT" rev-parse --verify --quiet "origin/$REF^{commit}" >/dev/null; then
  TARGET="origin/$REF"
elif git -C "$ROOT" rev-parse --verify --quiet "$REF^{commit}" >/dev/null; then
  TARGET="$REF"
else
  echo "✗ Can't find '$REF' locally or on origin." >&2
  exit 1
fi

if [ -d "$TEST_DIR/.git" ] || [ -f "$TEST_DIR/.git" ]; then
  echo "→ Updating test worktree to $TARGET"
  git -C "$TEST_DIR" checkout --quiet --detach --force "$TARGET"
  git -C "$TEST_DIR" clean --quiet -fd -e node_modules -e .env
else
  echo "→ Creating test worktree at $TEST_DIR on $TARGET"
  git -C "$ROOT" worktree add --quiet --detach "$TEST_DIR" "$TARGET"
fi
echo "  now at $(git -C "$TEST_DIR" log -1 --format='%h %s')"

APP="$TEST_DIR/app"

# .env is git-ignored, so every worktree needs its own copy. Without it the app fails with a
# misleading AUTH_FAILED ("We couldn't connect").
if [ -f "$ROOT/app/.env" ]; then
  cp "$ROOT/app/.env" "$APP/.env"
else
  echo "! $ROOT/app/.env is missing: the app will not be able to reach the relay." >&2
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
  echo "✓ Ready. Start it with: cd $APP && npx expo start --clear"
  exit 0
fi

# Stop a Metro/Expo dev server already on the port so the phone connects to this one. Anything
# else holding the port is left alone.
for pid in $(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if echo "$cmd" | grep -qiE 'expo|metro|react-native'; then
    echo "→ Stopping the dev server already on port $PORT (pid $pid)"
    kill "$pid" 2>/dev/null || true
    sleep 1
  else
    echo "✗ Port $PORT is in use by something that isn't Expo/Metro (pid $pid: $cmd)." >&2
    echo "  Free it, or pick another port: RCT_METRO_PORT=8082 scripts/test-app.sh" >&2
    exit 1
  fi
done

echo "✓ Starting Expo from $APP"
cd "$APP"
exec npx expo start --clear --port "$PORT"
