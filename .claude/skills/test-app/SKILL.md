---
name: test-app
description: Get the Reflux app ready to test on a phone. Runs the Expo dev server from one fixed folder on the latest main (or a branch you name), so the path never needs changing by hand. Use when the user wants to test, run, try, preview or start the app or the Expo/dev server, or says things like "get the app ready", "I want to test main", "run the latest".
---

# Test the app

The Expo server is easy to start from the wrong folder (a stale branch or worktree), which shows old screens. `scripts/test-app.sh` avoids that by always running from one throwaway worktree, `.claude/worktrees/test-app`, pointed at the ref to test.

What the script does, each run:

1. Fetches `origin`, then sets the test worktree to the ref (default `origin/main`; creates it the first time).
2. Copies `app/.env` from the main checkout (it is git-ignored, and without it the app fails with a misleading `AUTH_FAILED`).
3. Runs `npm ci` only if `package-lock.json` changed since the last install there.
4. Stops an Expo/Metro server already listening on port 8081 (anything else on that port makes the script stop with a message instead).
5. Starts `npx expo start --clear` from the test worktree.

Step 4 only happens when it is about to start Expo.

## How to use it

- **Latest main** (the usual case): `scripts/test-app.sh`
- **A branch or PR's branch:** `scripts/test-app.sh feat/some-branch`
- **Set up only, don't start Expo:** add `--prepare-only`

When invoked as a skill:

1. Run `scripts/test-app.sh [ref]` with Bash `run_in_background` (from any worktree of the repo). It does all the setup and then keeps Expo running.
2. After a few seconds, read its output and report the commit it landed on (`now at <sha> <subject>`), so the user knows what they will see, and that the server is running. Tell them to reload the app on the phone (shake, or open Expo Go / the dev client and connect). A QR code can't be shown from a background run; if they need one, give them the terminal command: `! scripts/test-app.sh`.
3. `--prepare-only` does the setup without stopping a running server or starting one; use it only to check the setup.
4. Never edit code in the test worktree: it is reset on every run. Make changes on a branch in a different worktree.

If the user names a PR or feature, find its branch (`gh pr view <n> --json headRefName`) and pass it as the ref.

## Gotchas

- The script stops an existing Expo/Metro server on port 8081 without asking. That is the point, but mention it if the user might have another Expo running on purpose.
- The phone needs a network path to the computer. `npm run start:tunnel` (from `app/`) works when it's on a different network.
- A native-module change needs a new dev build, not just a reload (see `app/AGENTS.md`).
