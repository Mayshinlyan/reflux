# Reflux — Operations Runbook

For the relay service (`api/`) running on Google Cloud Run. The mobile app has no server-side operations in the MVP (Expo Go, no EAS).

## Kill switch — stop all AI analysis immediately

Use when: costs are spiking, Claude is returning bad output, or you need to pause the service for any reason without a redeploy.

```
gcloud run services update reflux-relay --region <region> \
  --set-env-vars ANALYSIS_ENABLED=false
```

Every `POST /v1/analyze-food` request now returns `503 SERVICE_BUSY` immediately, with no Claude call made. Re-enable with `ANALYSIS_ENABLED=true`.

## Anthropic API key rotation

1. Create a new key in the Anthropic Console under the `reflux` workspace.
2. Update the secret: `echo -n "<new-key>" | gcloud secrets versions add reflux-anthropic-api-key --data-file=-`
3. Cloud Run picks up the new secret version on the next deploy or revision restart — force one with `gcloud run services update reflux-relay --region <region> --no-traffic && gcloud run services update-traffic reflux-relay --region <region> --to-latest`.
4. Revoke the old key in the Anthropic Console once the new revision is confirmed healthy.

## Adjusting rate limits

Per-user daily limit and the global daily circuit breaker are both env vars on the Cloud Run service:

```
gcloud run services update reflux-relay --region <region> \
  --set-env-vars PER_USER_DAILY_LIMIT=30,GLOBAL_DAILY_LIMIT=300
```

Raise `GLOBAL_DAILY_LIMIT` when onboarding more pilot testers; lower it if you suspect abuse. Check current usage first via the Firestore `rate_limits` collection or the relay's Claude-call log count for today.

## Responding to a GCP budget alert

1. Check Cloud Billing reports, filtered to the `reflux` project, for the spend source (Claude token cost surfaces as Anthropic invoice, not GCP — check the Anthropic Console usage page too).
2. If it's AI cost: check the global circuit breaker is actually capping calls (Cloud Logging, filter for `SERVICE_BUSY`). If not tripping as expected, lower `GLOBAL_DAILY_LIMIT` immediately and investigate why the cap didn't hold.
3. If usage looks abnormal (spikes from one anonymous UID, or a pattern suggesting the relay URL leaked): flip the kill switch, rotate the Anthropic key, and review Cloud Logging for the source before re-enabling.
4. If it's genuinely expected pilot growth: raise the Anthropic workspace spend limit deliberately, don't just let the alert repeat.

## Rolling back a Cloud Run revision

```
gcloud run revisions list --service reflux-relay --region <region>
gcloud run services update-traffic reflux-relay --region <region> \
  --to-revisions <previous-revision-name>=100
```

`deploy-api.yml` does this automatically on a failed `/healthz` smoke test; use this manually if a bad revision passed the smoke test but misbehaves under real use.

## Running the MVP pilot (Expo Go)

1. Confirm the relay is deployed and healthy: `curl https://<relay-url>/healthz`.
2. Confirm the Anthropic spend limit and GCP budget alert are both set before onboarding any tester.
3. Start the dev server in tunnel mode so it's reachable outside your Wi-Fi: `npx expo start --tunnel` from `app/`.
4. Share the QR code / Expo Go link with testers. Tell them explicitly: **the dev server must stay running for the app to work, and deleting Expo Go deletes their local data** (no cloud backup in the MVP).
5. Watch Cloud Logging and the Anthropic Console usage page while testers are active, especially in the first session.

## Milestone 2 additions (not yet applicable in MVP)

- **Raising `MIN_APP_VERSION`:** set the env var, confirm the version-check middleware returns `426 UPGRADE_REQUIRED` for older installs, and post in the update notes why the bump was needed.
- **EAS Update rollback:** `eas update:rollback` (or republish the previous update group) on the affected channel if an OTA update introduces a regression.
- **Cloud Armor rule tuning:** adjust the per-IP rate-based ban threshold in the security policy if legitimate users are getting banned, or tighten it if abuse patterns emerge; test changes in preview mode before enforcing.
