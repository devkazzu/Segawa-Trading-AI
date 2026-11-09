# Deployment

## 1. Frontend → GitHub Pages

The workflow `.github/workflows/web-deploy.yml` runs on pushes to `main` and manual dispatch:

1. `npm ci`
2. typecheck + 103 tests
3. secret-pattern grep (fails the build if a key leaks into `frontend/src` or `frontend/public`)
4. `npm run build` with `VITE_BASE_PATH=/Segawa-Trading-AI/`
5. upload Pages artifact → deploy

**One-time setup (required):**

1. Merge the working branch into `main`.
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. Optional: **Settings → Secrets and variables → Actions → Variables** add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Expected URL: `https://<owner>.github.io/Segawa-Trading-AI/`. The deploy job prints the real URL in its
summary (`page_url`) — that is the authoritative source, not this document.

### Why hash routing

GitHub Pages is static and cannot rewrite paths. `HashRouter` means every route is
`…/#/journal/new`, so refreshes, deep links and the Android `WebView` all work with no server rules.
`frontend/public/404.html` additionally redirects accidental path-style links to the hash router.

## 2. Backend → Supabase

```bash
npm i -g supabase
supabase login
supabase link --project-ref <ref>
supabase db push
supabase functions deploy ai-coach
supabase functions deploy delete-account
supabase secrets set OPENAI_API_KEY=sk-...
```

Then set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (local `.env` and/or repo variables) and rebuild.

Auth settings to check in the dashboard:

- Email provider enabled, “Confirm email” on for production
- Minimum password length ≥ 8
- Site URL = your Pages URL; add `http://localhost:5173` to redirect allow-list
- For native: add `com.segawa.tradeai://` as an additional redirect URL

## 3. Android

Handled by `.github/workflows/android-build.yml`. See [ANDROID.md](ANDROID.md).

## 4. Versioning

```bash
git tag v1.0.0 && git push origin v1.0.0
```

- `release.yml` builds and verifies the web bundle, publishes a deployable zip and release notes.
- `android-build.yml` builds the APK for the tag and attaches it to the same release.

## 5. Post-deploy verification checklist

- [ ] `GET /` returns the app shell
- [ ] `manifest.webmanifest` and `sw.js` are served (check the Network tab)
- [ ] Login screen shows the correct mode (Supabase or Local demo)
- [ ] Sign-up → email confirmation → sign-in works (Supabase mode)
- [ ] Add a trade, reload, the trade is still there
- [ ] Export CSV and PDF produce files
- [ ] A second account cannot see the first account's trades (RLS)
