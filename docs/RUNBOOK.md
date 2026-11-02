# Reflux — Operations Runbook

For the relay service (`api/`) running on Google Cloud Run. The mobile app has no server-side operations; its iOS builds are made with EAS (see "Shipping an iOS build").

## Kill switch — stop all AI analysis immediately

Use when: costs are spiking, Claude is returning bad output, or you need to pause the service for any reason without a redeploy.

```
gcloud run services update reflux-relay --region <region> \
  --set-env-vars ANALYSIS_ENABLED=false
```

Every `POST /v1/analyze-food` and `POST /v1/insight` (Bellie's day and week summaries) request now returns `503 SERVICE_BUSY` immediately, with no Claude call made. Re-enable with `ANALYSIS_ENABLED=true`.

## Anthropic access: workload identity federation (no stored key)

The relay calls Claude without any stored key: the Cloud Run service account (`reflux-relay-sa`) gets a Google-signed identity token from the metadata server, and the Anthropic SDK exchanges it for a short-lived Anthropic token. There is then no secret to leak, rotate or expire.

**One-time setup in the Claude Console** (Settings > Workload identity > Connect workload > Google Cloud): issuer `https://accounts.google.com` in discovery mode; a rule that matches `audience` `https://api.anthropic.com` and both the `sub` (the service account's numeric unique ID, from `gcloud iam service-accounts describe reflux-relay-sa@<project>.iam.gserviceaccount.com --format='value(uniqueId)'`) and the `email` claim. Never use a `subject_prefix` with `*` for Google tokens: it matches service accounts in every project. Put the rule in the `reflux` workspace.

**Switch it on:**

1. Set four repository variables (they are identifiers, not secrets): `gh variable set ANTHROPIC_FEDERATION_RULE_ID --body fdrl_...`, and the same for `ANTHROPIC_SERVICE_ACCOUNT_ID` (`svac_...`), `ANTHROPIC_ORGANIZATION_ID` and `ANTHROPIC_WORKSPACE_ID` (`wrkspc_...`).
2. Run the **Deploy API** workflow. The relay logs `Anthropic credentials configured` with `auth: federation` (or `api-key`) on startup, never the values. When the ids are set federation wins even while the key is still mounted; the SDK would otherwise prefer a key, so the relay never passes both.
3. **Verify with a real check**, because the `/health` smoke test does not call Claude: take a photo or type a food in the app. A failed exchange shows in the Claude Console under Workload identity > authentication history, with the reason.

**Retiring the old key (done 2026-10-31: the secret was unmounted, a real check still worked, then the secret was deleted; revoke the key in the Claude Console if that is not done yet).** If it ever has to be done again, in this order: deploying without `--update-secrets` does not unmount the secret from the live service. First run `gcloud run services update reflux-relay --region us-central1 --remove-secrets ANTHROPIC_API_KEY`, confirm a real check still works, and only then delete the secret (`gcloud secrets delete reflux-anthropic-api-key`) and revoke the key in the Claude Console. Deleting the secret while it is still mounted stops new revisions from starting.

**Troubleshooting:** a failed exchange shows in the relay log as `request failed` with an `upstreamErrorName` (the error class only, never the message), and in the Claude Console under Workload identity > authentication history with the reason. The relay refuses to start if any federation id is set without `ANTHROPIC_FEDERATION_RULE_ID`, or the rule id without the organization id.

**Roll back:** there is no stored key to fall back to. Create a key in the Claude Console (`reflux` workspace), store it with `echo -n "<key>" | gcloud secrets create reflux-anthropic-api-key --data-file=-` (never set an expiry: Secret Manager deletes an expired secret), grant `reflux-relay-sa` `roles/secretmanager.secretAccessor` on it, mount it with `gcloud run services update reflux-relay --region us-central1 --update-secrets ANTHROPIC_API_KEY=reflux-anthropic-api-key:latest`, and clear the rule id on the service (`--update-env-vars ANTHROPIC_FEDERATION_RULE_ID=`). Changing a repository variable only takes effect at the next Deploy API run, and the workflow does not mount the key, so a redeploy must clear the rule id too.

## Adjusting rate limits

Per-user daily limit and the global daily circuit breaker are both env vars on the Cloud Run service:

```
gcloud run services update reflux-relay --region <region> \
  --set-env-vars PER_USER_DAILY_LIMIT=30,GLOBAL_DAILY_LIMIT=300
```

Bellie's summaries (`POST /v1/insight`) have their own per-user daily allowance, `PER_USER_DAILY_INSIGHT_LIMIT` (default 20), so they never use up meal checks; both kinds of call count toward `GLOBAL_DAILY_LIMIT`.

Kitchen recipe ideas (`POST /v1/recipe-ideas`, three recipes per round) have their own per-user daily allowance, `PER_USER_DAILY_RECIPE_LIMIT` (default 15; the app itself stops at 10 rounds a day, and the extra room covers "Try again" after a failure), and count toward `GLOBAL_DAILY_LIMIT`. A round is the biggest Claude call the relay makes (up to 5000 output tokens, 60 s timeout), so watch its cost first if the bill grows. The request holds food names only (favorites, foods that bothered the person, foods they never eat, dishes already shown), the cuisine, time and servings, and the conditions; the relay checks every returned recipe against the never-eat list and drops any that contain a listed food, and it never logs the names or the recipes.

Kitchen ingredient edits (`POST /v1/recipe-adjust`: swap, remove or add ingredients, one recipe rewritten per call) have their own per-user daily allowance, `PER_USER_DAILY_ADJUST_LIMIT` (default 40), and count toward `GLOBAL_DAILY_LIMIT`. They never use up the daily rounds of ideas. A call is about a third of a round (up to 2500 output tokens, 60 s timeout). The relay applies the same never-eat check to the rewritten recipe and asks once more if it fails; it never logs the names or the recipe.

Feedback from Settings > Send feedback (`POST /v1/feedback`) has its own per-user daily allowance, `PER_USER_DAILY_FEEDBACK_LIMIT` (default 5). There is also a daily ceiling over everyone, `GLOBAL_DAILY_FEEDBACK_LIMIT` (default 500, then `503 SERVICE_BUSY`), because anonymous sign-in makes the per-user cap easy to dodge. It makes no Claude call, so it does not count toward `GLOBAL_DAILY_LIMIT` and the kill switch does not stop it. Each message is one document in the Firestore `feedback` collection (`message`, `createdAt`, and when sent `appVersion` and `platform`; no user id). Read them in the Firebase console; delete a document there to remove a message. The relay never logs the text, only its length. The collection has no TTL, so clear it out when it has been read.

Raise `GLOBAL_DAILY_LIMIT` when onboarding more pilot testers; lower it if you suspect abuse. Check current usage first via the Firestore `rate_limits` collection or the relay's Claude-call log count for today.

## Responding to a GCP budget alert

1. Check Cloud Billing reports, filtered to the `reflux` project, for the spend source (Claude token cost surfaces as Anthropic invoice, not GCP — check the Anthropic Console usage page too).
2. If it's AI cost: check the global circuit breaker is actually capping calls (Cloud Logging, filter for `SERVICE_BUSY`). If not tripping as expected, lower `GLOBAL_DAILY_LIMIT` immediately and investigate why the cap didn't hold.
3. If usage looks abnormal (spikes from one anonymous UID, or a pattern suggesting the relay URL leaked): flip the kill switch, revoke the access rule or workspace key in the Claude Console, and review Cloud Logging for the source before re-enabling.
4. If it's genuinely expected pilot growth: raise the Anthropic workspace spend limit deliberately, don't just let the alert repeat.

## Rolling back a Cloud Run revision

```
gcloud run revisions list --service reflux-relay --region <region>
gcloud run services update-traffic reflux-relay --region <region> \
  --to-revisions <previous-revision-name>=100
```

`deploy-api.yml` never sends traffic to a revision that fails its `/health` smoke test, so use this only if a bad revision passed the smoke test but misbehaves under real use. Rolling back pins traffic to that revision; the next automatic deploy clears the pin (`--to-latest`), or run `gcloud run services update-traffic reflux-relay --region <region> --to-latest` yourself.

## Step 5 setup checklist for the owner

> Historical first-time setup. Production no longer uses the stored key in steps 1, 2 and the `--set-secrets` flag below: it uses workload identity federation (see the section above).

The relay code for `POST /v1/analyze-food` is built and tested with Claude and Firebase mocked. These steps need your credentials and are not done yet. Replace `<region>` and `<project>` with your values.

1. **Anthropic (dev key first):** in the Anthropic Console create a `reflux` workspace, set a monthly **spend limit** on it, and create an API key inside that workspace. Never paste the key into a file, chat or commit.
2. **Secret Manager:** `echo -n "<key>" | gcloud secrets create reflux-anthropic-api-key --data-file=-` Do not set an expiry (`--expire-time` or `--ttl`): an expired secret is deleted and the relay can no longer start.
3. **Runtime service account** (least privilege): create `reflux-relay-sa` and grant only `roles/secretmanager.secretAccessor` on that one secret and `roles/datastore.user` on the project. Nothing else. The relay verifies Firebase tokens with Application Default Credentials, so no key file is needed.
4. **Firebase:** enable Anonymous sign-in under Authentication. Create a Firestore database in native mode with rules that **deny all client access** (`allow read, write: if false;`); the relay reaches it through the service account, which bypasses rules.
5. **Firestore TTL:** `gcloud firestore fields ttls update expiresAt --collection-group=rate_limits --enable-ttl` so old daily counters delete themselves after 48 h.
6. **Cloud Run flags** when deploying (`deploy-api.yml` in Step 8, or by hand for the first test):
   `--service-account reflux-relay-sa --max-instances 3 --concurrency 20 --timeout 60 --set-secrets ANTHROPIC_API_KEY=reflux-anthropic-api-key:latest --set-env-vars PER_USER_DAILY_LIMIT=30,GLOBAL_DAILY_LIMIT=300,ANALYSIS_ENABLED=true`
   Optionally set `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) and `FIREBASE_PROJECT_ID`.
7. **GCP budget alert:** create a budget on the project with alerts at 50 %, 90 % and 100 %. Claude token cost bills on the Anthropic invoice, not GCP, so the Anthropic spend limit in step 1 is the real cap.
8. **Log-based alerts** in Cloud Monitoring on: severity `ERROR` spikes, `message="global circuit breaker tripped"`, and `AI_UPSTREAM_ERROR` / `AI_INVALID_OUTPUT` counts.
9. **Curl check** once deployed (needs an anonymous ID token from the Firebase Auth REST API): a text request and a photo request return valid JSON; a non-food photo returns 422; the 31st call in a day returns 429; lowering `GLOBAL_DAILY_LIMIT` to 1 returns 503 `SERVICE_BUSY`; a corrupt or huge image returns 400/413; logs contain no food text; and `cacheReadTokens` becomes non-zero on repeat calls in the `claude call completed` log line. If it stays at zero, the fixed system prompt + ruleset is below the model's minimum cacheable length or something in it varies between requests.
10. **Clinician review:** `api/src/config/refluxRuleset.json` is flagged `needsClinicianReview`. It must be reviewed before any public launch (Milestone 2).

## Running the MVP pilot (Expo Go)

1. Confirm the relay is deployed and healthy: `curl https://<relay-url>/health`.
2. Confirm the Anthropic spend limit and GCP budget alert are both set before onboarding any tester.
3. Start the dev server in tunnel mode so it's reachable outside your Wi-Fi: `npx expo start --tunnel` from `app/`.
4. Share the QR code / Expo Go link with testers. Tell them explicitly: **the dev server must stay running for the app to work, and deleting Expo Go deletes their local data** (no cloud backup in the MVP).
5. Watch Cloud Logging and the Anthropic Console usage page while testers are active, especially in the first session.

## Testing the home-screen widget (development build)

The iOS home-screen widget (Snap food, plus saved foods on the medium size) is a native extension, so **Expo Go can't show it**; everything else in the app still runs in Expo Go (`scripts/test-app.sh` serves Expo Go by default). `expo-widgets` generates the widget target and its App Group (`group.com.mayshinlyan.adayinmybelly`) at prebuild; there is nothing to edit in `ios/`.

1. Build a development build and install it on the phone, either locally (needs Xcode) with `cd app && npx expo run:ios --device`, or in the cloud with `cd app && npx eas-cli@latest build --profile development --platform ios` (register the phone first with `npx eas-cli@latest device:create`). Either way the Apple team must be able to use the App Groups capability.
2. Serve to it with `scripts/test-app.sh --dev-build` and open the app once, so it can fill the widget.
3. Long-press the home screen, tap +, and add **Snap food** in the small or medium size.
4. Check: tapping the bubble opens the camera; the medium size lists up to three of Favorite foods (A to Z); tapping one logs it and opens the check-in; renaming or removing a saved food updates the widget; **Delete all data** (You) empties it.

A tapped food carries a token made on the phone, so a link from a web page or message can't log a meal; without it `?quickLog=` just opens the Food screen. Changing the widget's look means updating the Figma component *Widget/Bellie says* first, then re-exporting `app/assets/images/widget-bellie-says.png` at 3×.

## Shipping an iOS build (EAS → TestFlight)

Profiles are in `app/eas.json`: `development` (dev client, internal), `preview` (internal, no dev server) and `production` (store build, build number bumped by EAS). Run EAS as `npx eas-cli@latest <command>` from `app/`.

One-time setup:

1. Join the Apple Developer Program, make a free Expo account, then `eas login` and `eas init`.
2. Register each test iPhone with `eas device:create` (needed for `development` and `preview`; turn on Developer Mode on the phone).
3. **Put the app's `EXPO_PUBLIC_*` values in EAS.** `app/.env` is git-ignored, so cloud builds never see it, and without these the build installs but can't reach the relay or Firebase. For each variable in `app/.env.example`, run `eas env:create --environment <development|preview|production> --name <NAME> --value <value> --visibility plaintext` (they are public, bundled into the app, never secrets). Check with `eas env:list --environment production`.

Each release:

1. `eas build --platform ios --profile production`, then `eas submit --platform ios --latest`. The first submit creates the app in App Store Connect (the store name must be unique).
2. In App Store Connect → TestFlight, add internal testers (up to 100, no Apple review). External testers and the App Store need the privacy policy, privacy label and the Milestone 2 items in `docs/BUILD_PLAN.md`.
3. Check on the phone: install from TestFlight with no dev server running, log a meal (proves the env vars reached the build), and, for the widget, add **Snap food**.

`runtimeVersion` follows the native fingerprint. Over-the-air updates are not set up yet: they need `npx expo install expo-updates` and `eas update:configure` first, after which an update only reaches builds with matching native code. `eas init` also adds the project id to `app.json`; commit that change.

## Milestone 2 additions (not yet applicable in MVP)

- **Raising `MIN_APP_VERSION`:** set the env var, confirm the version-check middleware returns `426 UPGRADE_REQUIRED` for older installs, and post in the update notes why the bump was needed.
- **EAS Update rollback:** `eas update:rollback` (or republish the previous update group) on the affected channel if an OTA update introduces a regression.
- **Cloud Armor rule tuning:** adjust the per-IP rate-based ban threshold in the security policy if legitimate users are getting banned, or tighten it if abuse patterns emerge; test changes in preview mode before enforcing.

## Automatic deployment (`deploy-api.yml`)

A push to `main` that changes `api/**` (or a manual **Run workflow** in the Actions tab) runs the API checks, deploys a new revision to Cloud Run with no traffic under the `candidate` tag, smoke tests its `/health`, and only then moves production traffic to it. If the smoke test fails, production keeps serving the old revision.

Auth is Workload Identity Federation: GitHub gives the run a short-lived token and Google lets it act as the `gh-deployer` service account, only for this repo. No key file or secret is stored in GitHub.

One-time setup (already done for this project):

1. Enable `iamcredentials`, `sts`, `run`, `cloudbuild` and `artifactregistry` APIs.
2. Create service account `gh-deployer`; grant it `run.admin`, `cloudbuild.builds.editor`, `artifactregistry.writer`, `storage.admin`, `serviceusage.serviceUsageConsumer`, and `iam.serviceAccountUser` on the runtime and build service accounts.
3. Create workload identity pool `github` and OIDC provider `github-oidc` (issuer `https://token.actions.githubusercontent.com`) with attribute condition `assertion.repository=='<owner>/<repo>'`.
4. Grant `roles/iam.workloadIdentityUser` on `gh-deployer` to `principalSet://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/github/attribute.repository/<owner>/<repo>`.
5. In GitHub → Settings → Secrets and variables → Actions → **Variables**, set `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` (full provider resource name) and `GCP_DEPLOY_SA` (service account email).

Notes:

- The workflow uses `--update-env-vars` / `--update-secrets`, so other settings already on the service (for example `FIREBASE_PROJECT_ID`) are kept. Change the per-user and global limits by editing the workflow, not by hand, or the next deploy overwrites them. `ANALYSIS_ENABLED` is deliberately not set by the workflow, so a deploy never undoes the kill switch.
- Branch protection needs GitHub Pro on a private repo. Without it the `test` job in the workflow is the gate: a failing check stops the deploy but does not block the push.
- To disable auto-deploy, turn the workflow off in the Actions tab; manual `gcloud run deploy` still works.
