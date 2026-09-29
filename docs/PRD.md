# Reflux — Product Requirements Document

Status: MVP in development. Last updated 2026-09-28.

## 1. Problem

People with Acid Reflux, Heartburn and LPR (laryngopharyngeal reflux) struggle to connect their symptoms back to specific foods and habits. Symptom-and-trigger correlation is highly individual, but existing tools either track food with no reflux context, or give generic "avoid these foods" lists with no connection to what the person actually ate or how they felt. There's no lightweight way to: log symptoms consistently, log meals with real ingredient detail, and get an instant, trustworthy answer to "is this food going to set me off?"

## 2. Users

- **Primary:** an adult managing chronic reflux/LPR symptoms who wants to understand their own patterns, without the friction of manual food-diary apps built for calorie counting.
- Not a replacement for clinical care. Positioned as a personal tracking and general-wellness tool, used alongside — not instead of — a doctor's or dietitian's guidance.

## 3. Goals

- Make logging symptoms fast enough that it actually happens (a few taps, not a form).
- Make food logging effortless: a photo or a sentence, not manual entry of ingredients and nutrition facts.
- Give an immediate, explained answer to "is this food reflux-friendly?" before or after eating.
- Respect health-data privacy by design: keep the data on the user's device, not on a server.

## 4. Non-goals (MVP)

- Not a calorie counter or general nutrition tracker.
- Not a diagnostic or treatment tool; no medical claims.
- Not multi-device sync (local-first; sync is backlog, opt-in and encrypted if built).
- Not a public consumer launch (MVP is a private pilot for the builder and a few testers).

## 5. Core Features

### 5.1 Symptom logging
Quick log: tap the spot on a simple body map (Throat & voice, Chest, Tummy, or "Something else"), then tap the symptoms felt from that area's short list, so only a few choices are ever on screen at once. The 11 symptoms are the 9-item Reflux Symptom Index (hoarseness, throat clearing, excess mucus/postnasal drip, difficulty swallowing, coughing after eating/lying down, breathing difficulty, troublesome cough, lump-in-throat sensation, heartburn/chest pain/indigestion) plus constipation and trouble sleeping. There is no severity rating in the quick log: a symptom is simply felt or not. The user can optionally tag lifestyle factors (stress, lay down after eating, large meal, alcohol, exercise, poor sleep) and add a note. Full RSI check-in (all 9 items scored 0-5, totaled out of 45) is a Milestone 2 addition and is the one place severity is captured.

**User story:** "As someone with LPR, I want to log that my throat hurts and I felt hoarse right now, in under 10 seconds, so I actually keep doing it."

### 5.2 Food logging
Take a photo or type what was eaten. The app identifies the meal, breaks it into items and ingredients, and saves it to a personal food diary alongside an AI reflux-friendliness assessment for the record — the user doesn't have to type ingredients by hand.

**User story:** "As someone tracking triggers, I want to snap a photo of my lunch and have the ingredients and a reflux read-out appear automatically."

### 5.3 Food checker
Same underlying capability as food logging, used before eating: photo or text in, a per-item and overall verdict out (Likely OK / Caution / Likely trigger) with plain-language reasoning citing specific trigger categories (acidity, caffeine, mint, alcohol, carbonation, high-fat/fried, spicy, chocolate, raw garlic/onion, large portion). "I ate this" promotes the check into the diary with no re-analysis.

**User story:** "As someone deciding what to order, I want to check a dish before I eat it and see why it might be risky."

### 5.4 Medications
One-tap logging against a short personal list of saved medications (name, type: PPI / H2 blocker / antacid / alginate / other, optional dose). Provides context alongside symptoms and food.

### 5.5 Meal timing vs bedtime
A bedtime setting (default 22:30); any meal logged within 3 hours of bedtime is flagged with a "late meal" badge, since eating close to lying down is a well-established reflux trigger. Computed at read time from the current bedtime setting, so changing it updates history retroactively.

### 5.6 Companion pet
The Today screen is led by an animal companion (dog by default; the user picks the animal and can rename it). It grows through three stages (Puppy → Young dog → Grown dog) as the user logs consistently and eats reflux-friendly meals, and shows a happy or unwell mood based on the latest entry. The pet is always gently moving (breathing, blinking, wagging, with a mood-dependent idle). Tapping it gets a bounce, a heart, a haptic and a friendly speech bubble. Taps are just for play and never affect progress, and reduced motion is respected. Tone is always encouraging: the pet never dies or disappears, and it is decorative feedback, not a medical judgement. Progress is derived from the log history (so edits and deletes stay consistent); only the pet's name and animal are stored. Logging symptoms always gives a small boost (never a penalty), since checking in is the behaviour to encourage. Other rules and constants are in the build plan. Clinician review of pet wording is post-MVP.

## 6. Design Principles

Minimal, warm, friendly — never clinical or alarming. One primary action per screen, plain encouraging language, generous whitespace. Deliberately not the generic "healthcare app" cyan/teal look; palette is warm terracotta + sage on cream, closer to a food/comfort register than a clinical one, chosen because this is fundamentally a food app. Verdict colors are always paired with an icon and label, never color alone. Full token spec (colors, type, spacing, native layout rules) lives in the build plan and `app/src/theme/`. Visual source of truth: `docs/design/style-guide.html` (design system) and `docs/design/mockups.html` (mobile mockups).

## 7. Privacy Model

**Local-first.** All health data — symptoms, food logs, medications, photos — lives only in the app's on-device SQLite database and local file storage. Nothing about the user (name, email, history) is ever sent to a server.

The backend is a **stateless relay**: it forwards a food photo or text description to Claude for analysis and returns the result, but stores nothing itself. The only server-side state is a short-lived (48h) rate-limit counter keyed to an anonymous session, used purely to stop abuse of the relay. Server logs are structured and redacted so that request bodies, photos, food text and analysis content are never written to logs.

Photos are compressed and stripped of metadata (including EXIF/GPS) on-device before upload, and re-verified server-side rather than trusted from the client.

Anthropic processes the food photo/text to produce the analysis; under Anthropic's commercial API terms, inputs aren't used for model training by default. This will be confirmed and stated plainly in the privacy policy before any public launch.

**Honest promise to users:** "Your health data never leaves your phone."

## 8. Security Model

Threat model, in priority order: (1) cost abuse of the AI relay, (2) prompt injection via user-submitted food text/images, (3) malicious uploads, (4) supply-chain/credential compromise, (5) local data exposure on a lost/stolen device.

**MVP (private pilot):** anonymous Firebase auth, per-user and global daily caps on AI calls, an Anthropic workspace spend limit, a GCP budget alert, a kill switch, server-side image re-validation and re-encoding (magic-byte check, decompression-bomb protection, metadata stripped), a strict validated output schema so the model can only ever return one well-formed JSON shape (no free-form text reaches the UI), Firestore rules that deny all client access, least-privilege service accounts, and standard repo hygiene (branch protection, secret scanning, CodeQL, Dependabot, pinned CI actions).

**Milestone 2 (before public launch):** adds Firebase App Check (device attestation) so only the real app can call the relay, an external load balancer + Cloud Armor in front of Cloud Run (IP-based rate limiting, path allowlisting, the relay's raw URL made unreachable), and Google Model Armor to screen for prompt-injection and harmful-content attempts on both input and output.

Full detail lives in the build plan's Security section.

## 9. Architecture

```
Phone (Expo / React Native)
  - SQLite (Drizzle ORM) — all symptom/food/medication data, on device
  - Local photo storage
       │  only a food photo or food text leaves the device
       ▼
Cloud Run relay (Node/Express, stateless)
  - Firebase anon auth, rate limiting, input/output validation
       │
       ▼
Claude Vision API (Anthropic)
  - Identifies food, infers ingredients, assesses reflux-friendliness
  - against a curated, sourced trigger-category ruleset
       │
       ▼
  result flows back to the phone and is saved locally
```

## 10. Data Model (summary)

On-device SQLite tables: `symptom_logs` / `symptom_log_items` / `symptom_log_tags`, `food_logs` (one row per meal, covering both diary entries and one-off checks, with AI results stored as JSON plus a version stamp for model/prompt/ruleset), `medications` / `medication_logs`, `app_settings`. Full schema with rationale is in the build plan.

## 11. Relay API (summary)

`GET /healthz` (liveness) and `POST /v1/analyze-food` (the one functional endpoint — accepts a photo or text, returns a structured multi-item meal analysis). Versioned under `/v1` so future API changes don't break installed app versions; full endpoint and middleware spec is in the build plan.

## 12. Success Metrics

**MVP (pilot):** relay-side counts (analyses/day, distinct anonymous sessions) plus direct qualitative feedback from testers — there is no in-app analytics yet, by design (local-first).

**Milestone 2 onward,** via content-free, opt-out event counts (no food/symptom content ever included): D1/D7/D30 retention, weekly active loggers and logs per active user, Check → "I ate this" conversion rate, AI analysis error rate, crash-free session rate.

## 13. Legal / Store Readiness Checklist (Milestone 2, before public launch)

- Public privacy policy and terms of service URL; Apple App Privacy label and Google Play Data Safety form filled out to match the privacy model above.
- General-wellness wording only — never "diagnose," "treat" or "cure"; disclaimer shown on welcome, in Settings, and on every AI result.
- Explicit AI-generated-content disclosure in the UI; review of Anthropic's Usage Policy for consumer health use cases before launch.
- Confirm commercial-use terms for the Reflux Symptom Index and credit Belafsky et al. (2002) in the About screen.
- A clinician or dietitian review of the trigger ruleset and all user-facing wording.
- Apple Developer and Google Play accounts, app icon/splash, age rating (13+), camera permission strings.
- Public beta via TestFlight and Google Play internal testing before any public release.

## 14. Roadmap

**MVP → Milestone 2 → Backlog.** Full scope tables and phased build order live in the build plan (`~/.claude/plans/i-want-to-build-pure-eagle.md` during development; this PRD is the durable reference once the plan is executed).

Backlog highlights: pet extras (more animals/stages, clinician review of pet copy), on-device personalized trigger learning (correlating a user's own symptom history against their food/medication/timing history), opt-in end-to-end encrypted backup/sync, a doctor-shareable PDF summary, barcode scanning, app lock + database encryption, editable ingredients with re-assessment, "was this verdict right?" feedback, local reminders, localization.

## 15. Open Questions

- Exact current Claude model ID and minimum prompt-cacheable length — confirm at implementation time.
- Whether Google Model Armor supports image inputs at the time Milestone 2 is built (confirmed textual support; image support to be verified).
- Final Anthropic Usage Policy requirements for consumer health use cases, to be reviewed before Milestone 2 launch.
- Whether Firebase App Check's real device attestation will need adjustment once EAS builds are in place (App Attest on iOS, Play Integrity on Android).
