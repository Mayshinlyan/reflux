---
name: test-app
description: Get the Reflux app ready to test on a phone. Runs the one shared Expo dev server (port 8081) from the worktree you're working in, replacing the server any other worktree had running, so the phone always connects to the same place. Use when the user wants to test, run, try, preview or start the app or the Expo/dev server, or says things like "get the app ready", "start the server", "I want to test this".
---

# Test the app

All worktrees share one dev server on port 8081, so the phone always connects to the same address. `scripts/test-app.sh` starts it from the worktree it is run in, and whatever that worktree has checked out is what the phone shows.

What the script does, each run:

1. Copies `app/.env` from the main checkout if this worktree has none. The file is git-ignored, and without it the app fails with a misleading `AUTH_FAILED`.
2. Runs `npm ci` only if `package-lock.json` changed since the last install in this worktree.
3. Stops the Expo/Metro server already on port 8081, whichever worktree it was serving. Anything else on that port makes the script stop with a message instead.
4. Starts `npx expo start --clear --port 8081` from this worktree's `app/`.

## How to use it

- **This worktree:** `scripts/test-app.sh`, run from the worktree whose code should be on the phone.
- **Another branch:** run it from a worktree on that branch.
- **Set up only, don't start Expo:** add `--prepare-only`.

When invoked as a skill:

1. Run `scripts/test-app.sh` with Bash `run_in_background`, from the worktree being worked in. Use a plain command with the worktree's own path, e.g. `cd <worktree> && scripts/test-app.sh`.
2. After a few seconds, read its output and report which branch and commit it serves (`on <branch> at <sha> <subject>`), and that the server is running on 8081. Tell them to reload the app on the phone (shake, or reopen it in Expo Go). A QR code can't be shown from a background run; if they need one, give them the terminal command: `! scripts/test-app.sh`.
3. `--prepare-only` does the setup without stopping a running server or starting one. Use it only to check the setup.

If the user names a PR or feature, find its branch (`gh pr view <n> --json headRefName`) and run the script from a worktree on that branch.

## Gotchas

- Starting it replaces the server another worktree or session had running on 8081, without asking. That is the point, but mention it if another session may be using it.
- `app/.env` is only copied when a worktree has none. To pick up a changed `.env`, delete the worktree's `app/.env` and run it again.
- Switching branches in the served worktree changes what the phone shows, because Metro reloads the files on disk.
- The phone needs a network path to the computer. `npm run start:tunnel` (from `app/`) works when it's on a different network.
- A native-module change needs a new dev build, not just a reload (see `app/AGENTS.md`).
