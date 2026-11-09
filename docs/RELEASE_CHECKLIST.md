# Production release checklist

Use this before every release. Every line is a real action with a pass/fail you can observe —
nothing here is "assumed done". Items marked **owner** need credentials or repository rights that the
build environment does not have.

---

## 0. What is already true on this branch

| Gate | Command / evidence | Status |
|---|---|---|
| TypeScript strict | `npm run typecheck` | ✅ 0 diagnostics |
| Test suite | `npm test` | ✅ 7 suites / 103 tests |
| Production build | `npm run build` | ✅ exit 0 |
| CI on PR | `gh pr checks 1` → *Tests & typecheck* | ✅ pass |
| Pages base path | serve `dist` under `/Segawa-Trading-AI/` | ✅ all assets HTTP 200 |
| Secrets in bundle | CI `Security gate` step | ✅ pass, and fails on a planted key |

---

## 1. Before merging (web)

- [ ] `cd frontend && npm ci && npm run typecheck && npm test && npm run build` — all green.
- [ ] `git status` is clean; `dist/`, `node_modules/`, `*.jks`, `*.keystore`, `.env*` are untracked.
- [ ] Secret scan: no `sk-`, `sb_secret_`, `service_role` in `frontend/src`, `frontend/public`, `index.html`.
- [ ] `frontend/src/lib/env.ts` still reads `VITE_SUPABASE_ANON_KEY` only (never the service-role key).
- [ ] Version bumped in `frontend/package.json`, `android/app/build.gradle` (`versionName`) and `public/manifest.webmanifest` if the release is user-facing.
- [ ] `docs/DELIVERY.md` test counts match the numbers printed by `npm test`.

## 2. Merge and deploy the web app

- [ ] Merge PR into `main` (squash or merge — either is fine).
- [ ] **Owner:** GitHub → *Settings → Pages → Source: GitHub Actions* (one-time).
- [ ] Watch the deploy: `gh run watch $(gh run list --workflow web-deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')`.
- [ ] Open `https://<owner>.github.io/Segawa-Trading-AI/` and confirm:
  - [ ] splash → login screen renders with the Hiro artwork,
  - [ ] hard-refresh on a deep link (`/#/risk`) still loads (hash routing, no 404),
  - [ ] DevTools → Application → *Manifest* shows the icons, *Service Workers* shows `sw.js` activated,
  - [ ] offline reload serves the shell instead of the browser error page.
- [ ] Lighthouse (mobile) ≥ 90 performance / 100 accessibility on the dashboard; record the score.

## 3. Supabase (owner)

- [ ] Create the project, then run `supabase/migrations/*.sql` in order.
- [ ] Auth → URL configuration: site URL = the Pages URL, redirect allow-list includes `/#/login`.
- [ ] Create the `trade-screenshots` storage bucket (private) and its policies.
- [ ] Deploy both Edge Functions with `supabase functions deploy`; set `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` as **function secrets** (never `VITE_*`).
- [ ] Build with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in the deploy environment.
- [ ] RLS smoke test with two accounts: user A must see **0** rows of user B for `trades`, `trade_screenshots`, `ai_conversations`, `monthly_reports`, `psychology_entries`, `challenge_profiles`.
- [ ] Confirm account deletion removes the profile, all rows it owns and every stored screenshot.

## 4. AI (owner)

- [ ] In *AI Configuration*, save the endpoint/model, run **Test connection** — expect a green result.
- [ ] Ask one question; confirm the answer cites the same findings the audit shows (no invented trades).
- [ ] Remove the key; confirm the UI flips to **Local statistical engine** and answers still work.
- [ ] Confirm no key appears in `localStorage` outside the intended preference record and never in URLs.

## 5. Android release (owner)

Debug build (no secrets needed):

- [ ] Actions → **Android — build APK** → *Run workflow* (workflow dispatch only works once the file is on the default branch).
- [ ] Download the `segawa-debug-apk` artifact; the summary states it is **debug and unsigned for release**.
- [ ] Install on a device: splash, icon, status-bar colour, safe areas, hardware back button, no console errors.

Signed release build:

- [ ] Generate the keystore once, outside the repo:
      `keytool -genkey -v -keystore ~/segawa-release.jks -alias segawa -keyalg RSA -keysize 2048 -validity 10000`
- [ ] Add 4 repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- [ ] Push a tag `v1.0.0` → `release.yml` builds the signed APK/AAB and attaches them to the GitHub release.
- [ ] Verify with `apksigner verify --print-certs app-release.apk` and bump `versionCode` on the next release.
- [ ] Never commit the keystore, `keystore.properties` or the passwords.

## 6. Post-release smoke (10 minutes, real data only)

- [ ] Log a trade with a stop and no strategy → warning shown, R shows `—`.
- [ ] Edit it to closed with an exit → P&L, R and the equity curve update everywhere.
- [ ] Delete it → dashboard totals return to the previous values.
- [ ] Export CSV and open it in a spreadsheet (UTF-8 BOM keeps accents intact); export PDF and check the page numbers.
- [ ] Generate a monthly audit → save → it appears in Reports → coach cites the same findings.
- [ ] Resize to 380 px: bottom nav visible, no horizontal scroll, add-trade button reachable.

## 7. Rollback

- [ ] Web: *Actions → web-deploy → Re-run* on the previous green commit, or `git revert` the release commit and merge.
- [ ] Android: keep the previous APK/AAB artifact from the last release; never reuse a `versionCode`.
- [ ] Database: migrations are additive; restore from the Supabase backup taken before the release (see `docs/DATABASE.md`).
