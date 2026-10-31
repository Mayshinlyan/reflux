# Handoff: continuing Reflux in the cloud

Repo: https://github.com/Mayshinlyan/reflux (private). Work on branch `feat/step4-medications` (pushed; the WIP commit
is `6ba344b`). It is built on `feat/symptom-picker` → `feat/step3-symptoms` → `feat/step2-database` → step 1; there is no
`main` history yet. Never push to main/master, never force-push. End every commit message with:
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

Read first: `docs/BUILD_PLAN.md` (architecture, design system, data model, relay API, Claude integration, security,
CI/CD, build order), `docs/PRD.md` (product rules; keep in sync), `docs/design/mockups.html` and
`docs/design/style-guide.html` (visual source of truth), `app/AGENTS.md` (Expo SDK 58: check docs.expo.dev, use
`npx expo install`). Layout: `app/` is the Expo client (routes in `app/src/app`, code in
`app/src/{db,lib,components,constants,theme}`); `api/` is the stateless Express relay skeleton. Node 22.

## Part 1: finish and verify Step 4 (medications + settings), then commit

The last commit was made in a hurry: only a quick review, and its **new tests have never been run**. In `app/` run
`npm ci`, `npx tsc --noEmit`, `npx expo lint`, `npx jest --ci`, `npx prettier --check .`, `npx drizzle-kit check`, and
`npx expo export --platform ios --output-dir /tmp/x`. Fix everything that fails (fix the code or the test as
appropriate; never weaken a test to make it pass — if a test exposes a real bug, fix the bug).

Files to verify:

- `app/src/app/log/medication.tsx`: one-tap log with a snapshot of name/type/dose, a 2.5 s "Logged ✓" flash that
  ignores double-taps, a "Taken today · time (N×)" line, add / edit / "Remove from my list" (archive, with an Alert
  confirm; past logs stay), back closes the form before leaving.
- `app/src/app/settings.tsx`: Bedtime list 8:00 PM–2:00 AM in 30-minute steps stored as "HH:MM" (default 22:30);
  "My pet" rename sheet (trimmed, 1–24 characters); "My medications" row.
- `app/src/lib/clock.ts`, `app/src/components/{TextField,BottomSheet,TagChip}.tsx`.
- Tests: `app/src/__tests__/screens/{medication,settings}.test.tsx`, `app/src/lib/__tests__/clock.test.ts`.

Screen tests here run against a real better-sqlite3 database (`app/src/db/__tests__/testDb.ts`) with `expo-router`,
haptics and Toast mocked. RNTL v14's `render` and `fireEvent` are async (`await render(...)`).

Then self-review the step 4 diff (`git diff feat/symptom-picker...HEAD -- app docs/design docs/PRD.md`) for real bugs
(hook order, stale state, data loss, accessibility, privacy). **No health data (food, symptoms, medications, notes)
may ever reach logger or Sentry calls**; log only operation names and error codes. Update `docs/PRD.md` (Settings now
has Bedtime and My pet; medications management). Commit and push to `feat/step4-medications`.

## Part 2: Step 5, the AI relay (code and tests only; no cloud deployment)

Only after Part 1 is green and pushed. Create `feat/step5-relay` from `feat/step4-medications`. Implement in `api/`
per BUILD_PLAN.md ("Relay API", "Claude Integration & Ruleset", "Security", "Error Logging", Build Order step 5)
everything that can be built and tested **without credentials or GCP access**:

- `api/src/config/refluxRuleset.json` (versioned; categories acidic, caffeine, mint, alcohol, carbonation, high_fat,
  spicy, chocolate, raw_garlic_onion, large_portion; each with description, example keywords and cited sources, plus a `conditions` section (which categories to weigh more strictly for acid reflux, LPR and gastritis) —
  cite only sources you are confident exist, and mark the file as needing clinician review),
  `api/src/prompts/foodAnalysisPrompt.ts` and `schemas.ts` (zod, strict, unknown fields rejected, enums restricted to
  the ruleset, length caps from the plan; keep consistent with the app type `app/src/types/analysis.ts`).
- `POST /v1/analyze-food` (JSON `{text}` 1–200 chars with control characters stripped and wrapped in delimiters in the
  prompt as data, or multipart `photo`, 5 MB, memory only). Middleware order: auth → rate limit → upload → validate →
  handler → strict output validation. Use the existing error contract in `api/src/errors.ts`. Kill switch
  `ANALYSIS_ENABLED=false` → SERVICE_BUSY immediately with no Claude call. Per-user daily limit (default 30) plus a
  global daily circuit breaker (default 300) behind a `RateLimitStore` interface: in-memory for tests, plus a Firestore
  implementation (documents keyed uid+date with a 48 h TTL field) unit-tested with a fake; do not require the emulator.
- Auth: verify Firebase anonymous ID tokens with `firebase-admin` behind a `TokenVerifier` interface so tests inject
  a fake; 401 AUTH_FAILED without or with a bad token.
- `imageSanitizer.ts` with `sharp`: magic-byte type check, `limitInputPixels` (decompression-bomb protection),
  re-encode to ≤1024 px JPEG with **all** metadata (EXIF/GPS) stripped. Tests must prove the output is ≤1024 px with no
  EXIF, and that a bomb, garbage or a wrong type is rejected as INPUT_REJECTED.
- `claudeService.ts` with the official `@anthropic-ai/sdk` behind an interface (tests use fakes/recorded fixtures):
  ONE call per analysis with forced tool use (`report_meal_analysis`), prompt caching (`cache_control`) on the fixed
  system prompt + ruleset, low temperature, `max_tokens` ≈ 1000, 30 s timeout, max 1 retry. Model id from env
  `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`; other current ids: `claude-opus-5-5`, `claude-haiku-4-5-20251001`).
  The system prompt forbids medication/dosing advice and treats `<food_description>` as data only. The relay attaches
  `meta {model, promptVersion, rulesetVersion}`. The key comes only from env `ANTHROPIC_API_KEY` and is never logged.
  Check the current Anthropic SDK docs rather than trusting memory.
- Logging: reuse `api/src/lib/logger.ts` redaction; add tests that food text, ingredients, reasoning, photos and
  tokens never appear in log output for this route. Claude telemetry logs only model, latency, token counts (incl.
  cache hits), request id, status, retries and zod failure **paths** (not values).
- Tests (Vitest + supertest, Claude mocked): 401 without a token; 429 on the 31st call; SERVICE_BUSY from the circuit
  breaker and from the kill switch; text length / control-character / file-type rejection; decompression-bomb
  rejection; non-food → 422 NOT_FOOD; a prompt-injection fixture still yields schema-valid output; out-of-schema model
  output → 502 AI_INVALID_OUTPUT; request-id echo. Keep `npm run lint`, `format:check`, `typecheck`, `test`, `build`
  and `npm audit --audit-level=high --omit=dev` green in `api/`.
- Do **not**: deploy, touch GCP/Firebase consoles, create secrets, commit any key, or wire the app to the relay
  (that is Step 6). Put the manual, credentialed steps (Secret Manager, service accounts, Cloud Run flags, Anthropic
  spend limit, budget alert) into `docs/RUNBOOK.md` as a short "Step 5 setup checklist for the owner".

## Working rules

Small, reviewable commits; run the full checks before every push; push each branch when green. Follow the existing
style (Prettier configured in both packages; comments only where the why isn't obvious). If blocked by something only
the owner can do (credentials, decisions), do everything else, note it clearly, and stop rather than guessing.

Finish with a report: what was verified/fixed in Part 1 (with final test counts), what Part 2 covers and doesn't, the
branches and HEAD SHAs pushed, any failing or skipped checks, and the exact list of things the owner must do next.
