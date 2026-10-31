# Reflux

A local-first mobile app for tracking acid reflux, heartburn and LPR: log symptoms, log and check food with an AI reflux read-out, log medications, and grow a companion pet. See [`docs/PRD.md`](docs/PRD.md) for the product spec and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for operations.

| Folder  | What                                                                      |
| ------- | ------------------------------------------------------------------------- |
| `app/`  | Expo (SDK 58) React Native client. Owns all user data, on device.         |
| `api/`  | Stateless Node/Express relay on Cloud Run. Forwards food to Claude only.  |
| `docs/` | PRD, runbook, style guide and clickable mockups (visual source of truth). |

## Getting started

Requires Node 22.

```sh
npm install              # root: installs the pre-commit hook (husky + lint-staged)

cd api && npm install
npm run dev              # relay on http://localhost:8080, try /health
npm test

cd ../app && npm install
npm start                # scan the QR code with Expo Go
npm test
```

Each package has `lint`, `typecheck`, `test` and `format` scripts; CI runs all of them on pull requests and on pushes to `main`.

### Security scans

Install once for the local secret scan: `brew install gitleaks`.

- **pre-commit** runs `gitleaks` on the staged changes and blocks a commit that contains a secret. It warns and continues if gitleaks isn't installed.
- **CI** (the `security` job in `ci.yml`) runs `gitleaks` on the full history and `semgrep` (JS/TS/Node security rules) on `api/src` and `app/src` for every PR. Semgrep is CI-only so pushes stay fast; to run it locally, `brew install semgrep` and use the command in that job.
- A false positive can be suppressed with `// nosemgrep: <rule-id>` (semgrep) or a fingerprint in `.gitleaksignore` (gitleaks), with a comment saying why.

### Environment

- `app/`: `EXPO_PUBLIC_SENTRY_DSN` (optional; Sentry is off without it).
- `api/`: see `api/src/config/env.ts` (`PORT`, `LOG_LEVEL`, `ANALYSIS_ENABLED`, rate limits).
