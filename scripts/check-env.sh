#!/usr/bin/env bash
# Check that app/.env is well formed and has every variable the app needs.
#
# It looks at variable NAMES only and never prints a value, so it is safe to run anywhere. It catches the
# mistakes that make the app fail with a misleading "No signal" or AUTH_FAILED:
#   - a line that is not NAME=value (a stray character in front of a name, a missing "=")
#   - a name that is a typo of a required one (":EXPO_PUBLIC_RELAY_URL")
#   - a required name that is missing or has an empty value
#
# The required names are the ones app/src/lib/config.ts asks for with required('EXPO_PUBLIC_...'), so this check
# stays in step with the code.
#
# Usage: scripts/check-env.sh [path/to/.env]     (default: app/.env in this checkout)
# Exit status: 0 when the file is fine, 1 when something is wrong, 2 when it cannot be checked.
set -uo pipefail

HERE="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
FILE="${1:-$HERE/app/.env}"
CONFIG="$HERE/app/src/lib/config.ts"

if [ ! -f "$FILE" ]; then
  echo "✗ No env file at $FILE. Copy it from the main checkout, or from app/.env.example." >&2
  exit 2
fi
if [ ! -f "$CONFIG" ]; then
  echo "✗ Cannot find $CONFIG to read the required names from." >&2
  exit 2
fi

REQUIRED="$(grep -oE "required\('EXPO_PUBLIC_[A-Z0-9_]+'" "$CONFIG" | sed -E "s/required\('//; s/'\$//" | sort -u)"
if [ -z "$REQUIRED" ]; then
  echo "✗ Found no required('EXPO_PUBLIC_…') names in $CONFIG, so there is nothing to check against." >&2
  exit 2
fi

problems=0
defined=""
count=0
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  line="${line%$'\r'}"
  # Blank lines and comments are fine.
  trimmed="${line#"${line%%[![:space:]]*}"}"
  [ -z "$trimmed" ] && continue
  case "$trimmed" in '#'*) continue ;; esac

  # Spaces around "=" are accepted, as the dotenv loader does.
  if [[ "$line" =~ ^(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
    name="${BASH_REMATCH[2]}"
    value="${BASH_REMATCH[3]}"
    count=$((count + 1))
    stripped="${value//[[:space:]]/}"
    if [ -n "$stripped" ] && [ "$stripped" != '""' ] && [ "$stripped" != "''" ]; then
      defined="$defined $name"
    fi
    continue
  fi

  # Not NAME=value. Say what the name part looks like, never the value.
  problems=$((problems + 1))
  if [[ "$line" == *=* ]]; then
    bad="${line%%=*}"
    guess="$(printf '%s' "$bad" | tr -cd 'A-Za-z0-9_' | tr '[:lower:]' '[:upper:]')"
    hint=""
    if echo "$REQUIRED" | grep -qx "$guess"; then hint=" (looks like a typo of $guess)"; fi
    echo "✗ line $lineno: the name '$bad' is not a valid variable name$hint" >&2
  else
    echo "✗ line $lineno: not NAME=value (no '=' on this line)" >&2
  fi
done <"$FILE"

for name in $REQUIRED; do
  if ! echo " $defined " | grep -q " $name "; then
    problems=$((problems + 1))
    echo "✗ $name is missing or has no value" >&2
  fi
done

if [ "$problems" -gt 0 ]; then
  echo "✗ $FILE has $problems problem(s). Fix them, then run: scripts/check-env.sh" >&2
  exit 1
fi
echo "✓ $FILE looks fine ($count variables; every required name is set)"
