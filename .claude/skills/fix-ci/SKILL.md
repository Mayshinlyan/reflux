---
name: fix-ci
description: Check a Reflux PR's CI, fix failing checks in a loop until they pass, and optionally merge the PR into main. Usage `/fix-ci [pr#] [merge]`. Use when the user says "check CI", "fix CI", "CI is failing", "make the PR green", or "fix and merge the PR". Without `merge` it never merges.
---

# Fix CI

Watch a PR's CI, fix what fails, repeat until green. Merge only if the user passed `merge`. GitHub auto-merge is unavailable here (private repo, free plan), so this skill does the merge itself after confirming every check is green.

Usage: `/fix-ci [pr#] [merge]`. With no number, use the PR for the current branch.

## Steps

1. **Resolve the PR.** `gh pr view [n] --json number,headRefName,baseRefName,state`. Stop if it is closed or merged.
2. **Isolate.** Work in a worktree on the PR's head branch (reuse one under `.claude/worktrees/` if it exists). Copy `app/.env` from the main checkout if the worktree has none.
3. **Wait for CI.** `gh pr checks <n> --watch --fail-fast` (run in the background or under Monitor so it doesn't block), then `gh pr checks <n> --json name,state,link`. `--fail-fast` stops at the first failure, so wait for the remaining checks to finish before judging the run. If all passed, go to step 6.
4. **Diagnose.** Find the failed run: `gh run list --branch <head> --workflow CI --commit <head sha> -L1`, then `gh run view <id> --log-failed`. Reproduce locally with the matching command from `.github/workflows/ci.yml`:
   - `api` job, from `api/`: `npm ci`, `npm audit --audit-level=high --omit=dev`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`
   - `app` job, from `app/`: `npm ci`, `npm run audit:check`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run db:check`, `npm test -- --ci`
   - `security` job: `gitleaks git --redact --no-banner`, and `semgrep scan --config p/javascript --config p/typescript --config p/nodejs --config p/secrets --error --metrics=off --quiet api/src app/src`
5. **Fix loop (max 3 rounds).**
   - **Pull main first, every round.** `git pull` the head branch, then `git fetch origin main && git merge origin/main`. Merge, never rebase, so no force push is needed. On conflicts, resolve them if the answer is clear, otherwise stop and report. The failure may already be fixed on `main`, so re-run the failing step locally before changing code.
   - Reproduce the failure, fix the root cause, then re-run that step and the ones after it locally until they pass.
   - For format and lint, use `npm run format` and `npm run lint -- --fix`. Run `npm audit fix` only if it doesn't bump a major version.
   - **Never weaken a check:** no skipping or deleting tests, no `eslint-disable`, no loosened tsconfig or CI, no gitleaks/semgrep ignores. If that is the only "fix", or the failure is a real leaked secret, stop and report.
   - Commit with a Conventional Commits message (`fix(ci): ...`). The commit hook needs a code-reviewer subagent PASS, then `~/.claude/hooks/mark-reviewed.sh`, then `git commit` as its own Bash call. Push normally, never force. Back to step 3.
   - Flaky or infrastructure failure (network error, or it passes locally with no change): `gh run rerun <id> --failed`, once.
   - Still red after 3 rounds: stop and report what is left.
6. **Merge (only if `merge` was passed).**
   - Refuse if the PR's base isn't `main` (stacked PR); tell the user to wait for the retarget.
   - If `main` moved since the last round, merge it in, push, and wait for CI again.
   - Confirm every check is `SUCCESS` on the PR's current head SHA and `mergeable` is `MERGEABLE`, then `gh pr merge <n> --merge`. Never use `--admin` or otherwise bypass protections.
   - Say that merging redeploys the API to Cloud Run (`deploy-api.yml`) when `api/` changed.
   - Without `merge`, end with: "CI green. Run `/fix-ci <n> merge` to merge."
7. **Report.** PR URL, each round's failure and fix, final check states, and whether it merged.

## Gotchas

- `gh pr checks` exits 8 while checks are pending. That is pending, not failed.
- CI uses `cancel-in-progress`, so `CANCELLED` checks on older SHAs are expected; judge only the current head SHA.
- Dependabot PRs: fixes go on the dependabot branch, but Dependabot may overwrite them on its next rebase. Say so.
- Never merge unasked. The default run stops at green.
