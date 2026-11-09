# Troubleshooting

## App

| Symptom | Cause | Fix |
|---|---|---|
| Login says “Local demo mode” | No Supabase env vars | Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `frontend/.env`, restart the dev server |
| Trades disappear after clearing browser data | Demo mode is browser-only | **Profile → Export all data (JSON)** first |
| “An account with this email already exists” | Local demo users are per-browser | Sign in instead, or use a different email |
| Charts blank | Container has zero width (hidden ancestor) | Ensure the chart is inside a laid-out container |
| Save fails with a generic error | Repository write rejected | Open DevTools → Network/Console; Supabase errors name the table |
| PDF download blocked | Popup/download blocker | Allow downloads for the origin |
| Coach answers sound statistical, not conversational | No AI key configured | Configure the Edge Function or a BYOK key |

## GitHub Pages

| Symptom | Cause | Fix |
|---|---|---|
| 404 on refresh at a deep path | Static host, path-based route | The app uses hash routes; use `/#/journal`, or the `404.html` redirect |
| White page, assets 404 | Wrong base path | Build with `VITE_BASE_PATH=/<repo>/`; the workflow sets it |
| Deploy job skipped | Pages source not set to GitHub Actions | Settings → Pages → Source |
| Stale app after deploy | Service worker cache | Hard reload, or bump `VERSION` in `frontend/public/sw.js` |

## Supabase

| Symptom | Cause | Fix |
|---|---|---|
| `permission denied for table trades` | RLS policy missing | Re-run the RLS migration |
| `new row violates row-level security policy` | `user_id` not set on insert | The repository attaches `userId`; check auth session is live |
| Auth emails not arriving | SMTP not configured | Supabase → Auth → SMTP, or disable confirmation for local dev |
| Edge Function 503 `missing_provider_key` | Secret absent | `supabase secrets set OPENAI_API_KEY=…` |
| Edge Function 429 | Rate limit (30/hour) | Wait, or raise `RATE_LIMIT_PER_HOUR` in `ai-coach` |

## Android

| Symptom | Cause | Fix |
|---|---|---|
| Gradle fails at `compileSdkVersion` | SDK 34 missing | `sdkmanager "platforms;android-34" "build-tools;34.0.0"` |
| `Unsupported class file major version` | Wrong JDK | Use JDK 17 (`JAVA_HOME`) |
| APK installs but screen is blank | Assets not synced | `npm run build && npx cap sync android` |
| Release APK unsigned | No signing secrets | Add the four `ANDROID_KEYSTORE_*` secrets |
| Back button closes the app immediately | Deep history | Expected at the router root; navigation history is respected elsewhere |

## CI

| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails | Lockfile out of sync | Run `npm install` locally and commit `package-lock.json` |
| Security gate fails | A key-like string in `frontend/src` | Remove it; keys belong in Edge Function secrets |
| Tests pass locally, fail in CI | Timezone-dependent date tests | Tests use fixed dates; check `TZ` if you add new ones |
