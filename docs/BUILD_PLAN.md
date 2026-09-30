# Reflux — Mobile App for Acid Reflux / Heartburn / LPR

## Context

A mobile app that helps people with Acid Reflux, Heartburn and LPR:
1. **Log symptoms**, with lifestyle tags
2. **Log food** via photo or typed text, with AI-generated ingredients
3. **Check food** (photo or text) to see whether it's likely reflux-friendly
4. **Log medications** and **flag late meals** relative to bedtime

This is a greenfield build: `/Users/mayshinlyan/Documents/AI/Reflux` is empty and not yet a git repo. Food logging and food checking share one AI capability (meal → items → ingredients → reflux assessment), so one relay endpoint and one set of client components serve both.

**Privacy is a core product principle.** The app is **local-first**. All health data lives only on the user's phone. The backend is a **stateless relay** that forwards a food photo or text to Claude and stores nothing. Only the food itself is sent to the LLM, never user data.

**Delivery is split into two milestones:**
- **MVP:** a private pilot for the user and a few testers, run in **Expo Go** (no EAS, no store builds, no paid Expo services).
- **Milestone 2:** public beta and store launch. Adds EAS builds, native Firebase (App Check, Analytics), edge security (Cloud Armor, Model Armor) and store readiness.

**Decisions confirmed with user**

| Area | Choice |
|---|---|
| Mobile | React Native + Expo (TypeScript, Expo Router). MVP in Expo Go; EAS from M2 |
| Data storage | On device: expo-sqlite + Drizzle ORM; photos in app storage |
| Backend | Stateless Node + Express (TypeScript) relay on Cloud Run (GCP credits) |
| AI | Claude Vision API via the relay only; curated, sourced trigger ruleset |
| Symptoms | 9 RSI items + constipation + trouble sleeping (0–5), lifestyle tags |
| Extra logs | Medications, meal timing vs bedtime, lifestyle factors |
| Error logging | pino → Cloud Logging / Error Reporting (relay); Sentry, scrubbed (app) |
| Analytics | Content-free event counts, opt-out (M2) |
| Security | Hard caps + input/output containment in MVP; App Check, Cloud Armor, Model Armor in M2 |
| Design | Minimal, warm, friendly; clickable HTML mockups first; frontend-design + ui-ux-pro-max skills |
| CI/CD | GitHub Actions: tests on every commit, relay auto-deploys on merge to `main` |

Superseded earlier choices: Cloud SQL, Prisma, GCS photo storage and account linking (removed by local-first), and EAS in the MVP (deferred to M2).

## Milestone Scope

### MVP — private pilot (Expo Go)

| Area | Scope |
|---|---|
| Onboarding | One welcome screen + disclaimer; silent anonymous session (Firebase **JS SDK**) |
| Symptoms | Quick log (tap chips, 1–5 each), lifestyle tags, notes, edit/delete |
| Food | Log food + Check food (photo/text → multi-item analysis), "I ate this" |
| Extra logs | Medications (one-tap "my meds"), bedtime setting + late-meal badge |
| Screens | Today (pet hero + today's activity), History timeline, Settings (bedtime, my meds, privacy/about, delete all data, send feedback) |
| Companion pet | An animal companion on Today that grows with consistent, reflux-friendly logging (see Navigation & Screens). The user picks the animal (dog is the default) and can rename it. Progress is derived from the log history; only name + animal are stored. Local-only; purely motivational, no medical claims |
| Design | Design system from mockups, light mode, accessibility basics |
| Data | On-device SQLite + Drizzle, backup-before-migrate |
| Relay | `/health`, `/v1/analyze-food`, sourced ruleset, strict output schema, prompt caching, version stamps, kill switch |
| Security | Anonymous auth, per-user + global daily caps, Anthropic spend limit, GCP budget alert, input limits, server-side image sanitizing, strict output schema, Firestore deny-all, Secret Manager, least-privilege IAM, max instances, redacted logs |
| Logging | pino → Cloud Logging / Error Reporting, error contract, request IDs, Sentry for JS errors (scrubbed) |
| Dev / CI / CD | One GCP/Firebase project + Firebase emulators locally; CI tests (incl. security tests), Dependabot, secret scanning (CodeQL deferred, see Security); relay auto-deploys to Cloud Run |
| Docs | Skills installed, PRD, short runbook, mockups |
| Distribution | `npx expo start --tunnel`; testers open the app in Expo Go (the dev server must be running) |

### Milestone 2 — public beta & store launch

| Area | Scope |
|---|---|
| Builds | EAS development + store builds (free plan to start), EAS Update with `runtimeVersion: fingerprint`, TestFlight + Play internal testing |
| Native Firebase | Migrate to `@react-native-firebase` (auth, App Check, Analytics). Anonymous UIDs reset on migration; harmless, since no user data is server-side |
| Security | **App Check** enforced (App Attest / Play Integrity), **load balancer + Cloud Armor** + custom domain, **Model Armor**, min-app-version check, separate dev/prod projects, **Anthropic workload identity federation** (replaces the long-lived API key) |
| Observability | Firebase Analytics (content-free allowlist, opt-out toggle), Sentry native crashes + source maps, crash-reporting toggle |
| Features | Weekly RSI check-in + total score, 7-day trend strip, export data (JSON/CSV), dark mode |
| Quality | Maestro E2E flows, nightly AI eval golden set |
| Legal / store | Privacy policy + terms URL, Apple privacy label, Google Data Safety, Anthropic Usage Policy review, RSI usage terms + credit, clinician/dietitian review of the ruleset and pet wording, developer accounts ($99/yr Apple, $25 Google), icon, splash, age rating |

### Later backlog

- **Personalized trigger learning, on device:** correlate symptoms with foods, trigger categories, late meals, tags and medications.
- **Opt-in end-to-end encrypted backup/sync.**
- **PDF summary for doctors.**
- **Barcode scanning** (e.g. the Open Food Facts database).
- App lock (Face ID / fingerprint) + SQLCipher database encryption.
- Edit ingredients → re-assess; "Was this right?" feedback on verdicts.
- Local reminders; localization; staging environment.
- **Pet extras:** clinician/dietitian review of pet copy (with the ruleset review), more animals/stages/accessories.

## Step 0 — Skills, product docs & mockups (before any app code)

1. **Install frontend design skills** at project scope (`Reflux/.claude/skills/`, committed with the repo):
   - **frontend-design** from `anthropics/claude-code` (`plugins/frontend-design/skills/frontend-design/SKILL.md`), via `/plugin marketplace add anthropics/claude-code` + `/plugin install frontend-design`, or by copying the skill folder.
   - **ui-ux-pro-max** from `nextlevelbuilder/ui-ux-pro-max-skill`. This is third-party, so **read its full contents, especially any scripts, before installing**.
   - Verify both appear in the skills list. Where they conflict with this plan's design system, this plan wins.
2. `git init`, then write `docs/PRD.md` at repo root (outside `app/` and `api/`). It covers: problem, users, goals and non-goals, **MVP vs M2 scope**, feature specs with user stories, privacy and security model, design principles, architecture, data model, relay API, success metrics, legal checklist, backlog. Also write `docs/RUNBOOK.md`.
3. Build **clickable HTML mockups** of the MVP screens using the skills and the design system below. Publish as a private Artifact (openable on a phone), keep the source at `docs/design/mockups.html`, and iterate until the user signs off.

## Design References — read these before building any UI

These are the visual source of truth. Open them before writing screens or components; do not re-derive the look from prose.

- **`docs/design/style-guide.html`**: the existing design system (color tokens light + dark, type scale, spacing, radii, components). Port its `:root` tokens into `app/src/theme/`; do not invent new values.
- **`docs/design/mockups.html`**: the approved clickable mobile mockups (screens: welcome, today (pet hero), today's activity, check, check result, history, log food, log food result, log symptoms, log medication, settings). It is the reference for layout, copy, states and interactions, including the pet's stages, moods and status messages (`dogSvg`, `renderPet`, message arrays), which should be ported to the app.
- **`docs/PRD.md`**: product scope and rules; keep it in sync when this plan changes.
- **Skills** (`.claude/skills/frontend-design`, `.claude/skills/ui-ux-pro-max`): use for craft and checks.

**Precedence:** this plan > style-guide/mockups for behavior and scope > skills. If the mockups and this plan disagree, flag it and ask rather than guessing. Known gaps to resolve first: the mockups do not yet show animal choice, pet renaming, a Settings "My pet" row, or the pet's idle and tap animations; update them (and get sign-off) before building those screens.

## Design System — minimal, warm, friendly

**Principles:** one primary action per screen; generous whitespace; plain, encouraging language ("How's your throat today?"); never alarming; no clinical jargon up front.

**Deliberately not the generic "healthcare app" look.** Checked against the ui-ux-pro-max design database: its default healthcare/medical palette is a cold cyan/teal (`#0891B2`), which is exactly the generic-health-app cliché to avoid. Its recipe/cooking-app pairing (warm terracotta `#9A3412` + fresh green `#059669` on a cream `#FFFBEB` background) is the closer analog, since this is fundamentally a *food* app, and confirms warm terracotta + green/sage is a grounded, legitimate pairing rather than an arbitrary choice. Our exact hexes stay distinct from both that result and from the "AI-default" terracotta-on-cream combination the frontend-design skill flags as a tell (near `#D97757` on `#F4F1EA`, usually paired with a serif display face) — this palette uses a rounded sans, not a serif, and different hex values.

- **Color (light):** background cream `#FBF7F2`, surface `#FFFFFF`, text warm charcoal `#2E2A26`, secondary `#7A716A`, primary clay/terracotta `#C8664A`, accent sage `#8BA888`, hairlines `#EDE6DD`.
- **Dark palette (M2):** `#1F1B18` background, `#2A2521` surfaces. The tokens are structured for it from day one.
- **Verdict colors** (always with icon + label, never color alone): Likely OK = sage, Caution = honey `#D9A441`, Likely trigger = soft clay red `#C4553D`.
- **Type:** one rounded, friendly sans (Nunito or DM Sans), base 17pt, titles 28pt, respects the phone's text-size setting. Avoid generic AI-page tells: no single-word-accented headlines, no all-caps labels, no decorative "eyebrow" labels above headings.
- **Shape:** 16–20px rounded cards, pill buttons, very soft or no shadows, 8pt spacing grid. **Icons:** Lucide line icons only, never emoji as functional icons.
- **Feedback:** gentle haptics on save, subtle fades, a friendly "Looking at your food…" skeleton during analysis. One deliberate motion moment (e.g. the verdict card reveal), not scattered hover/fade effects on everything. The companion pet is the intentional exception: its idle and tap animations are the product's personality (see Today).
- **Native layout rules** (from the ui-ux-pro-max app-interface checks):
  - Every screen wrapped in `SafeAreaView`/safe-area insets — no content under the notch or gesture bar.
  - Bottom tab bar: our 3 tabs (Today, Check, History) stay under the 5-tab ceiling.
  - Touch targets are **platform-specific, not one flat number**: 44pt minimum on iOS, 48dp on Android (`Platform.select`), with at least 8dp spacing between adjacent touchables.
  - No custom horizontal swipe gestures that could fight the OS back-gesture; horizontal swipe is reserved for an explicit carousel only (e.g. the meal-items card, if it scrolls horizontally).
- **Accessibility:** WCAG AA contrast (4.5:1 text), platform-correct tap targets (above), visible focus, screen-reader labels on every control, `prefers-reduced-motion` respected.
- Theme tokens in `app/src/theme/`. No hardcoded styles.

## Navigation & Screens (MVP)

Three bottom tabs plus a floating **+** button:

- **Today:** a pet-hero home screen. The companion dog (default name "Buddy") sits centre stage with a mood-based status line, a growth progress bar, and a large "Log something" **+** button. A "Today's activity" pill (with entry count) opens the list of today's symptoms, meals (verdict + late-meal badges) and medications. Gear icon → Settings.
  - **Growth stages:** Puppy → Young dog → Grown dog (drawn at 90% / 95% / 100% of a pet sized to 70% of the screen width, capped so Today fits short phones; growth also shows in the stage name, progress bar and celebration). Progress fills 0–100; at 100 the pet advances a stage and the overflow carries over. Grown dog is the cap. Progress never drops below 0.
  - **Mood:** *happy* or *unwell*, set by the most recent action. Status copy is warm and never blaming (e.g. "Buddy is thriving!" / "Buddy's feeling a little ruff today."). Mood is always shown with text, not colour alone.
  - **Progress rules (v1, tunable):** food verdict OK +8, Caution −4, Likely trigger −10 (a further −4 if a non-OK meal is within 3h of bedtime); symptom log with average severity ≤2 → +3, 3 → 0, ≥4 → −8; medication logged +3 (always happy, so taking meds is never punished).
  - **Choose & rename (MVP):** the user picks the animal (dog is the default; the mockup currently draws only the dog, so extra animals need mockups before build) and can rename it from Settings ("My pet"), with a name-and-animal step during onboarding or on first Today visit. Every animal shares the same three stages, mood states and progress rules; only the artwork differs.
  - **Progress is derived from history (not accumulated):** `lib/petProgress.ts` replays all diary food logs, symptom logs and medication logs in chronological order, applies the rules above with progress clamped at 0 and stage overflow carried, and returns `{stage, progress, mood}`. Mood comes from the most recent log's delta. Consequence: editing or deleting an entry, or changing bedtime (late-meal penalty), automatically corrects the pet. Food *checks* (not saved to the diary) never affect the pet. Delta constants live in one place so they can be tuned.
  - **Alive and interactive (MVP):** the pet is always gently moving and reacts when tapped.
    - *At rest:* a still pose that matches the mood (happy, or droopy when unwell) with a soft breath. The mood's full 3D motion (a wag and smile, or a sad sigh) plays when the pet is tapped.
    - *Tap reaction:* the mood clip plays once, with a light haptic (`expo-haptics`), a small floating heart, and a short speech bubble with a friendly line (e.g. "Hi!", "Thanks for checking in", or, when unwell, "Thanks, I needed that"). Each tap picks a different line, and repeated taps cycle through reactions rather than stacking. A cooldown of about 600ms stops button-mashing.
    - *Growth moment:* when a stage-up is derived after a save, play a one-time celebration (grow and sparkle) the next time Today is shown.
    - *Rules:* taps are play only and never change progress, mood or stage, so the pet can't be gamed. The pet is an accessible button labelled "Pet {name}"; the bubble text is announced to screen readers.
    - *Reduced motion:* no idle loop and no bounce. A tap still shows the speech bubble and triggers the haptic.
    - *Implementation:* the pet is a pre-rendered 3D dog. At rest it is a still image per mood (`poster_happy`, `poster_unwell`) with a gentle Reanimated breath; a tap plays its mood clip once (`react_happy`, `react_unwell`, which play forward and back so they end on the still's exact frame) and a stage-up plays `celebrate` once, then it returns to the still. This replaces an always-looping idle, which moved too much and cost more memory. Clips are transparent animated WebPs (every frame a full keyframe, transparent background) shown with `expo-image`, which runs in Expo Go; `lib/petClips.ts` decides what to show. They are built from the green-screen videos in `art/originals/` by `art/build-clips.sh` (needs ffmpeg and the libwebp tools). Nothing plays when Today isn't focused or the app is in the background; reduced motion shows only the still. Real-time 3D (three.js, Rive) is a Milestone 2 option, since it needs a dev build.
    - *Growth moment:* the only pet value stored besides name and animal is `pet_seen_stage` (the highest stage the user has seen). When the derived stage is higher, the celebration plays once and the stage is marked seen.
  - **Principles:** encouraging, not punishing; the pet never dies or disappears; no streak-shame. The pet is decorative feedback, never a medical judgement.
  - **Storage:** only the pet's identity (`pet_name`, `pet_animal`) is persisted, in `app_settings`; stage/progress/mood are computed on read and not stored. Nothing about the pet is sent to the relay.
  - **Post-MVP:** clinician/dietitian review of pet wording (alongside the ruleset review); additional stages/animals/accessories.
- **Check:** camera-first. Snap or type food and see per-item verdicts plus an overall verdict. "I ate this" saves it to the diary.
- **History:** a day-grouped timeline of symptoms, meals and medications, with filter chips. Tap an entry for detail, edit or delete.
- **+ sheet:** Log symptoms / Log food / Log medication.
  - **Quick symptom log:** tap chips for the symptoms you feel → 1–5 each → optional tags (stress, lay down after eating, large meal, alcohol, exercise, poor sleep) → optional note → save.
  - **Log food:** camera or text → meal card (items + ingredients) → save.
  - **Log medication:** one tap on a saved med, or add new (name, type: PPI / H2 blocker / antacid / alginate / other, optional dose).
- **Settings:** my pet (rename, change animal), bedtime (default 22:30; a meal within 3h of bedtime is flagged as late), my medications, privacy explainer, disclaimer, about and credits (RSI citation, AI disclosure), delete all data, send feedback (email link).
- **Added in M2:** weekly RSI check-in, 7-day trend strip on Today, export, dark mode, analytics and crash-reporting toggles.

## Onboarding — as minimal as possible

1. **One welcome screen:** app name, one-line value proposition, "Your data stays on your phone", disclaimer ("For tracking only, not medical advice. Food results are AI-generated."), and a "Get started" button.
2. "Get started" silently creates an anonymous Firebase session (JS SDK with AsyncStorage persistence; used only for relay rate limiting) and lands on Today.
3. Bedtime and medications aren't asked up front; they're set later or prompted inline when first relevant. The camera permission is requested on first camera tap.

## Privacy Model

- **What leaves the phone:**
  - To the relay: only the food photo (re-encoded, EXIF stripped) or food text. The relay forwards it to Claude with the ruleset.
  - To Sentry: scrubbed error reports.
  - In M2, also content-free analytics events.
  - No symptoms, medications, tags, history, name or email ever leave the device.
- **The relay stores nothing.** Uploads stay in memory only and bodies are never logged. The only server-side state is a rate-limit counter (anonymous UID + date) in Firestore with a 48h TTL.
- **Anthropic:** API inputs aren't used for training under the commercial terms by default. Confirm current retention terms before public launch.
- **On device:**
  - Data sits in the app sandbox under OS encryption.
  - Delete-all wipes the DB, photos and the anonymous user.
  - M2 export writes to the cache directory and deletes the file after sharing.
- **Expo Go caveat:** in the pilot, app data lives inside Expo Go's sandbox. Deleting Expo Go deletes pilot data. Tell testers this.

## Repo Structure

```
Reflux/
├── .claude/skills/                    # frontend-design, ui-ux-pro-max
├── docs/ PRD.md, RUNBOOK.md, design/mockups.html
├── app/                               # Expo client (owns all user data)
│   ├── app/                           # Expo Router routes
│   │   ├── welcome.tsx, settings.tsx, _layout.tsx (DB backup + migrations on startup)
│   │   ├── (tabs)/today.tsx, check/index.tsx, check/result.tsx, history/index.tsx, history/[id].tsx
│   │   └── log/symptoms.tsx, log/food.tsx, log/medication.tsx
│   ├── drizzle/                       # generated SQL migrations, bundled
│   └── src/
│       ├── db/ schema.ts, client.ts, repositories/ (symptoms, food, medications, settings)
│       ├── theme/
│       ├── components/                # SymptomChip, SeveritySelector, TagChips, CameraCapture, MealResultCard, VerdictBadge, LateMealBadge, TimelineItem
│       ├── services/                  # firebase.ts (JS SDK anon auth), relayClient.ts, photoStore.ts, imagePrep.ts
│       ├── lib/                       # logger.ts, errors.ts, sentry.ts (scrubber), mealTiming.ts
│       ├── hooks/                     # useAnalyzeFood, useSymptomLogs, useFoodLogs, useMedications, useSettings
│       └── constants/                 # symptomItems.ts, lifestyleTags.ts, medicationTypes.ts, strings.ts
├── api/                               # stateless relay
│   ├── src/
│   │   ├── index.ts, app.ts, errors.ts
│   │   ├── lib/logger.ts              # pino, Cloud Logging format, redaction
│   │   ├── routes/ analyzeFood.routes.ts, health.routes.ts
│   │   ├── services/ claudeService.ts, foodAnalysisService.ts, rateLimitService.ts, imageSanitizer.ts
│   │   ├── middleware/ firebaseAuth.ts, rateLimit.ts, upload.ts, validateInput.ts, errorHandler.ts
│   │   ├── prompts/ foodAnalysisPrompt.ts, schemas.ts
│   │   └── config/ refluxRuleset.json, env.ts
│   ├── test/
│   └── Dockerfile
└── .github/ workflows/ci.yml, deploy-api.yml; dependabot.yml
```

- M2 adds: `middleware/appCheck.ts`, `appVersion.ts`, `modelArmor.ts`; `services/modelArmorService.ts`; `app/src/lib/analytics.ts`; `app/e2e/`; `mobile.yml`, `ai-eval.yml`.
- Tooling: TypeScript `strict`, ESLint + Prettier, `husky` + `lint-staged`, root README.
- Expo SDK pinned to the version the current Expo Go app supports.

## On-Device Data Model (SQLite via Drizzle)

Defined in `app/src/db/schema.ts`. Migrations are generated with `drizzle-kit generate`, committed, and applied at startup via `useMigrations` (works in Expo Go).

**Migration safety:** copy the DB file to a backup before new migrations (keep the last 2); additive migrations only; a failed migration restores the backup and reports to Sentry (migration name only).

**Tables:**
- **symptom_logs**: `id`, `kind` (`quick`|`checkin`; `checkin` used from M2), `logged_at` (ISO UTC), `tz` (IANA), `notes`, timestamps.
- **symptom_log_items**: `symptom_log_id` FK cascade, `item_key`, `score` (CHECK 0–5), unique per log + item.
- **symptom_log_tags**: `symptom_log_id` FK cascade, `tag_key`, unique per log + tag.
- **food_logs** (one row per meal/check):
  - `id`, `entry_type` (`diary`|`check`), `source` (`photo`|`text`), `input_text`, `photo_uri`.
  - `meal_name`, `overall_verdict`, `analysis` (JSON: items, ingredients, verdicts, reasoning, matched triggers, overall).
  - `analysis_meta` (JSON: model, prompt version, ruleset version).
  - `logged_at`, `tz`, timestamps; partial index on `logged_at` where `entry_type='diary'`.
- **medications**: `id`, `name`, `type`, `default_dose`, `active`, timestamps.
- **medication_logs**: `id`, `medication_id` (nullable), `name` snapshot, `type`, `dose_text`, `taken_at`, `tz`, `notes`.
- **app_settings** (key/value): bedtime, late-meal window (3h), onboarding done, `pet_name`, `pet_animal` (M2 adds the analytics and crash toggles). Pet stage/progress/mood are **not** stored; they are derived from the logs by `lib/petProgress.ts`.

"Late meal" is computed at read time in `lib/mealTiming.ts`, so changing bedtime updates all history. Pet progress is computed the same way in `lib/petProgress.ts` (and uses `mealTiming` for the late-meal penalty).

## Relay API (Cloud Run)

```
GET  /health            # liveness check for Cloud Run probes, deploy smoke test
POST /v1/analyze-food
  headers: Authorization (Firebase anon ID token), X-Request-Id
  body: multipart { photo } OR JSON { text }
  200 → { isFood, mealName, items[], overall, meta }
  errors → { error: { code, message, requestId } }
```

- `/v1` keeps older installs working when the API changes. Users never see these URLs.
- **MVP middleware order:** `firebaseAuth` → `rateLimit` (per-user 30/day + global daily circuit breaker) → `upload` (5MB, memory only) → `validateInput` → handler → strict output validation.
- **M2 prepends** `appVersion` and `appCheck`, and adds `modelArmor` after `validateInput`.
- **Kill switch:** `ANALYSIS_ENABLED=false` → `SERVICE_BUSY` immediately, with no Claude calls.
- **Error codes** (mirrored in `app/src/lib/errors.ts`, each mapped to a friendly message): `AUTH_FAILED`, `RATE_LIMITED`, `SERVICE_BUSY`, `UPLOAD_TOO_LARGE`, `INPUT_REJECTED`, `NOT_FOOD`, `AI_TIMEOUT`, `AI_UPSTREAM_ERROR`, `AI_INVALID_OUTPUT`, `INTERNAL`. M2 adds `APP_CHECK_FAILED` and `UPGRADE_REQUIRED`.

## Claude Integration & Ruleset

- **Ruleset** (`refluxRuleset.json`, with a `version` field): **acidic (low pH; key for LPR)**, caffeine, mint, alcohol, carbonation, high-fat/fried, spicy, chocolate, raw garlic/onion, large portion. Each has a description, example keywords and **cited sources** (e.g. ACG GERD guideline, LPR low-acid-diet research). Clinician review happens in M2, before public launch.
- **One call per analysis** with forced tool use (`report_meal_analysis`):
  - Top level: `isFood`, `mealName`, and `overall {verdict, confidence, reasoning ≤400}`.
  - `items[≤8]`, each with `name`, `ingredients[≤20]{name, matchedCategories}`, `verdict`, `reasoning ≤300` and `matchedTriggers[{category, evidence}]`.
  - Enums for verdicts and categories (categories restricted to the ruleset); strict zod with unknown fields rejected; one retry.
- **Prompt caching** on the fixed system prompt + ruleset (confirm the minimum cacheable length via the `claude-api` skill).
- Low `max_tokens` (about 1000), low temperature, 30s timeout, max 1 retry. The system prompt forbids medication/dosing advice and treats `<food_description>` content as data only.
- The relay attaches `meta {model, promptVersion, rulesetVersion}`.
- `identifyFood()` / `assessReflux()` stay separate internally for a future re-assess feature.
- Look up the current model ID at implementation time via the `claude-api` skill.

## Security

**MVP (private pilot)**

The main risk without App Check is that anyone who finds the relay URL can mint anonymous tokens. Hard caps bound the worst case to a known dollar amount.

- **Cost caps:**
  - Per-user daily limit plus a **global daily circuit breaker** (e.g. 300 Claude calls/day for the pilot).
  - **Anthropic workspace spend limit** with a separate dev key.
  - GCP budget alert.
  - Cloud Run max instances 3, concurrency 20, 60s timeout; body limit 5MB.
- **Input hardening:**
  - Text is 1–200 characters with control characters stripped, wrapped in delimiters.
  - Images: magic-byte type check; `sharp` with `limitInputPixels` (blocks decompression bombs); server-side re-encode to ≤1024px JPEG with metadata stripped. The client isn't trusted.
- **Output containment:** forced single tool, strict schema with enums and length caps, plain `<Text>` rendering. No secrets or user data in the prompt, so an injection has nothing to leak and no actions to take.
- **Platform:**
  - Firestore rules deny all client access. Anthropic key only in Secret Manager. Least-privilege runtime service account.
  - Workload Identity Federation for GitHub restricted to this repo + `main`.
  - Non-root slim container; `helmet`; no CORS.
- **GitHub:** private repo, branch protection, secret scanning + push protection, Dependabot, Actions pinned to SHAs, `npm audit` gate. **CodeQL is deferred:** on a private repo GitHub only accepts its results with the paid GitHub Code Security add-on, so `codeql.yml` was removed. Restore it from the commit history if the repo goes public or gets that add-on.

**Added in M2 (before public launch)**
- **App Check** enforced (App Attest / Play Integrity; debug tokens for development; no bypass flag).
- **External HTTPS load balancer + Cloud Armor:** path allowlist, per-IP rate ban, custom domain; Cloud Run ingress internal + load balancer only (about $25/mo from credits).
- **Model Armor** on text input and reasoning output.
- Min-app-version check; separate dev/prod projects.
- **Anthropic workload identity federation (WIF)** in place of the long-lived `ANTHROPIC_API_KEY` in Secret Manager, so no static Anthropic secret exists. In the Anthropic org create a federation issuer, rule and service account for the Cloud Run identity; have `claudeService` use the SDK's zero-argument client when the federation env vars are set (keep the key as a fallback for local dev); then delete the secret and revoke the key. First confirm WIF is available on the account and check the current SDK docs for the exact env vars. The MVP uses an API key with a workspace spend limit.
- Raise the global circuit breaker to fit expected traffic.
- Monitoring alerts on App Check failures and Cloud Armor bans.

## Error Logging & Debugging (privacy-safe)

**MVP**
- **Error contract** `{ error: { code, message, requestId } }`, with codes mapped to friendly UI messages.
- The client sends `X-Request-Id`. It appears on every relay log line and in the response, and is attached to Sentry events.
- **Relay:**
  - `pino` structured JSON in the Cloud Logging format, with Cloud Error Reporting grouping stack traces.
  - Claude telemetry: model, latency, tokens incl. cache hits, Anthropic `request-id`, status, retries, zod failure paths (not values).
  - A `redact` config plus a test so bodies, images, food text, ingredients and tokens are never logged. `LOG_LEVEL`: `info` in the cloud, `debug` locally.
  - Log-based alerts on 5xx spikes, AI error spikes and the circuit breaker tripping.
- **App:**
  - `@sentry/react-native` for **JS errors**. Confirm Expo Go support at setup; native crash capture comes in M2.
  - `sendDefaultPii: false`, no screenshots or replay. The scrubber drops bodies, console args and any DB/AI field.
  - `lib/logger.ts` logs to the console in development and sends scrubbed breadcrumbs + captures in production.
  - An error boundary per tab. On-device failures report operation name + code only.

**Added in M2:** Sentry native crash reporting + source maps via EAS builds, and a crash-reporting toggle in Settings.

## Analytics (M2)

- **Firebase Analytics** via `@react-native-firebase/analytics` (needs an EAS build). Advertising-ID collection off, no IDFA, no user properties. An opt-out toggle in Settings; disclosed in the privacy policy and store forms.
- **Typed event allowlist** in `lib/analytics.ts`, enforced by a test:
  - `onboarding_completed`
  - `symptom_logged {kind, item_count, tag_count}`
  - `food_logged {source}`
  - `check_done {source}`
  - `check_promoted`
  - `medication_logged`
  - `export_done`
  - `error_shown {code}`
- **Never sent:** food names, verdicts, symptom keys or scores, medication names, tags, free text.
- **Success metrics:** D1/D7/D30 retention; weekly active loggers and logs per active user per week; check → "I ate this" conversion; analysis error rate; crash-free sessions.
- **MVP pilot substitute:** relay counts (analyses/day, distinct anonymous users) plus direct tester feedback.

## Environments & GCP / Firebase Setup

**MVP: one cloud project `reflux`, plus Firebase emulators for local development.**
1. Enable Cloud Run, Artifact Registry, Secret Manager, Firestore, IAM Credentials APIs.
2. Firebase: Anonymous auth only.
3. Firestore native mode, TTL policy on `rate_limits`, deny-all rules.
4. Secret Manager: Anthropic key (pilot workspace with a spend limit) → Cloud Run via `--set-secrets`.
5. Runtime service account `reflux-relay-sa`: secretAccessor (that secret), `datastore.user`, Firebase token-verification role.
6. Cloud Run: min 0 / max 3 instances, concurrency 20, 512Mi, 60s timeout, non-root, HTTPS.
7. Workload Identity Federation for GitHub restricted to this repo + `main`; `github-deployer` service account (`run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`).
8. Budget alert.

**M2:**
- Split into `reflux-dev` + `reflux-prod`.
- Enable App Check (App Attest, Play Integrity), Analytics, Model Armor (template + role for `reflux-relay-sa`), and load balancer + Cloud Armor + domain.
- Set Cloud Run ingress to internal + load balancer only.

## CI/CD (GitHub Actions)

**MVP**

`ci.yml` runs on every push and PR:
- **api:** lint → typecheck → Vitest unit + supertest route tests against **Firebase emulators**, with Claude mocked via recorded fixtures.
- **api tests assert:**
  - Log redaction; the error contract and request-ID echo.
  - 401 without a token; 429 over the per-user limit; `SERVICE_BUSY` from the circuit breaker and kill switch.
  - Text length and file-type rejection; decompression-bomb rejection; a resized image is ≤1024px with no EXIF.
  - An injection fixture still yields schema-valid output; out-of-schema output becomes `AI_INVALID_OUTPUT`.
- **app:**
  - Lint → typecheck → `drizzle-kit check`.
  - Jest (`jest-expo` + React Native Testing Library) for components and hooks.
  - Repository and migration tests (migrate over seeded data) on `better-sqlite3`.
  - `mealTiming` tests across timezones and DST; EXIF-strip test; Sentry scrubber test.

Also: Dependabot, `npm audit --audit-level=high`, Actions pinned to SHAs. Branch protection requires CI to pass.

`deploy-api.yml` runs on merge to `main` when `api/**` changes:
1. Authenticate via Workload Identity Federation.
2. Build the image and push to Artifact Registry, tagged with the SHA.
3. `gcloud run deploy`.
4. Smoke test `/health`. On failure, roll back to the previous revision.

The app has no deploy step in the MVP; testers load it from the dev server in Expo Go.

**Added in M2:**
- `deploy-api.yml` gains a dev/prod split (dispatch to dev, `main` to prod, smoke test through the load balancer).
- `mobile.yml`: `eas update` on merge; store builds run manually or on a version tag.
- `ai-eval.yml`: nightly golden set against the real Claude API ("mint tea" → caution/mint; "plain oatmeal" → likely OK; "pepperoni pizza and cola" → 2 items, likely trigger; "orange juice" → acidic).
- **Maestro E2E** before each store release.
- App Check / version-check / Model Armor tests.

## Operations (`docs/RUNBOOK.md`)

- **MVP:** kill switch, Anthropic key rotation, adjusting per-user and global limits, responding to budget alerts, rolling back a Cloud Run revision, running the pilot (start the tunnel dev server; tester instructions for Expo Go).
- **M2 adds:** raising `MIN_APP_VERSION`, EAS update rollback, Cloud Armor rule tuning.

## Build Order & Verification

### MVP

0. **Skills + docs + mockups.** Install and verify both skills, `git init`, PRD + runbook, clickable mockups to user sign-off.
1. **Skeleton + CI + logging.** Expo app (TypeScript, SDK matching Expo Go) with theme tokens; Express relay with `/health`, pino, error contract; Sentry (JS); strict TypeScript, ESLint, Prettier, husky; `ci.yml` + Dependabot green on a private GitHub repo. Verify: the app opens in Expo Go on your phone, `/health` returns 200, a forced error appears in Sentry (no app data) and in Cloud Error Reporting (with request ID).
2. **Local database.** Schema, first migration, backup-then-migrate, repositories and tests. Verify: fresh install creates tables; a second migration applies over seeded data; a simulated failure restores the backup.
3. **Symptoms + tags.** Quick log, History, edit/delete. Verify: 2 chips + 2 tags stored; correct local-day grouping; data persists across app restarts.
4. **Medications + settings.** My meds, one-tap logging, bedtime. Verify: a medication logged in one tap appears on Today and in History.
5. **Relay + AI.** Ruleset with sources, prompt caching, multi-item schema, anonymous auth, per-user + global caps, kill switch, input sanitizing, strict output, Firestore deny-all; deploy via `deploy-api.yml`. Verify with curl:
   - Text and photo return valid multi-item JSON; a non-food photo returns 422; the 31st call returns 429.
   - A tripped circuit breaker returns `SERVICE_BUSY`; a malformed or huge image is rejected.
   - Logs are content-free; cache hits appear in telemetry.
6. **Log food flow.** Camera/text → `imagePrep` → relay → meal card → save → Today and History; the late-meal badge appears when logged within 3h of bedtime. Pet: `petProgress` unit tests (replay order, clamp at 0, stage carry, cap, late-meal penalty, delete/edit recomputes); pet reacts on Today after a save; rename and animal choice persist across restarts; tapping the pet plays a reaction without changing progress; reduced motion disables the idle loop.
7. **Check flow.** Verify: "mint tea" → Caution citing mint → "I ate this" → in the diary with no second relay call.
8. **Polish + pilot.** Empty, loading, error and offline states (logging works offline; analysis says it needs internet), delete-all, accessibility pass. Set the Anthropic spend limit and budget alert, then start the tunnel dev server and onboard pilot testers with the Expo Go caveat.

### Milestone 2

1. **EAS + native Firebase:** EAS dev builds; migrate to `@react-native-firebase` (auth, App Check, Analytics); App Check enforced on the relay.
2. **Environments + edge:** split dev/prod; load balancer + Cloud Armor + domain; Model Armor; min-app-version check; Anthropic workload identity federation instead of the Secret Manager API key (see Security). Verify: the `*.run.app` URL is refused; unknown paths get 403; an IP burst gets banned; an injection returns `INPUT_REJECTED`.
3. **Features:** weekly RSI check-in, 7-day trend strip, export, dark mode, analytics and crash toggles.
4. **Observability + quality:** Sentry native + source maps, analytics allowlist (verify in DebugView), Maestro E2E, nightly AI eval, `mobile.yml`.
5. **Launch readiness:** privacy policy + terms, store privacy forms, Anthropic Usage Policy review, RSI terms, clinician review, store assets, TestFlight / Play internal beta on real devices.
