<div align="center">

<img src="frontend/public/brand/hiro-segawa.png" alt="Hiro Segawa — Segawa TradeAI mascot" width="520" />

# Segawa TradeAI

**Trade Smarter. Understand Better. Grow Consistently.**

An AI trading journal, performance-analytics workspace, risk manager and prop-firm challenge
tracker — built around **Hiro Segawa**, your AI trading coach.

React 18 · TypeScript · Vite · Tailwind · Supabase · OpenAI-compatible AI · Capacitor Android · PWA

</div>

---

## 1. What this is

Segawa TradeAI is a **working application**, not a landing page or a mockup. It stores real trade
records, computes every metric from those records (never sample data), analyses them with a
rule-based intelligence engine, optionally enriches the analysis with an LLM, and ships as a
responsive web app, an installable PWA and a Capacitor Android app.

**Primary instrument:** XAUUSD Gold. Also supported: forex, indices, commodities, crypto and stocks —
each with editable broker contract specs (contract size, tick size, tick value).

### The honest status of each deliverable

| Deliverable | Status |
|---|---|
| Web application (20 screens, all routed) | ✅ Working, 81 automated tests passing |
| P&L / analytics / risk engine | ✅ Working, unit-tested against known values |
| Manual journal with screenshots, rules, emotions | ✅ Working |
| AI Monthly Intelligence, Trade Investigation, Coach | ✅ Working — live LLM **or** built-in local statistical engine |
| Supabase schema + RLS + Edge Functions | ✅ Written and deployable (needs **your** project) |
| Local demo mode | ✅ Working (clearly labelled, browser-only) |
| Android Capacitor project + Gradle build | ✅ Project complete; APK is produced by **GitHub Actions** (see §13) |
| GitHub Pages deployment | ⚠️ Workflow complete — goes live once the PR is merged to `main` and Pages is enabled |
| Signed release APK | ⚠️ Requires you to add 4 signing secrets (documented in §15) |

Nothing above is faked. Where a credential or a runner is required, the app shows an honest
**configuration-required** state instead of pretending the service works.

---

## 2. Screenshots

Run the app locally and capture your own data — this repository deliberately ships **no fabricated
performance screenshots**. The visual language is:

- Deep violet `#0A0714` canvas, sakura-pink `#FF79C6` and neon-violet `#C084FC` accents
- Poppins headings / Inter body, Inter tabular numerals for all figures
- Hiro Segawa artwork on splash, onboarding, login, dashboard insight panel, coach, audits and empty states
- Desktop: fixed sidebar + 1400px analytics workspace · Mobile: bottom navigation + floating add-trade button

| Screen | Route | What it does |
|---|---|---|
| Splash | `/` (boot) | Branded loading state |
| Onboarding | `#/welcome` | 3-step value tour |
| Login / Register | `#/login`, `#/register` | Supabase auth or local demo auth |
| Dashboard | `#/` | 24 metrics, 5 charts, calendar heatmap, risk guard |
| Trade Journal | `#/journal` | Search, 6 filters, sort, duplicate, delete, CSV |
| Add / Edit Trade | `#/journal/new`, `#/journal/:id/edit` | 40+ fields with live P&L preview |
| Trade Details | `#/journal/:id` | Full record + investigation |
| Analytics | `#/analytics` | 4 tabs, distribution, timing analysis |
| AI Coach | `#/coach` | Streaming chat with your real statistics |
| Monthly Audit | `#/audit` | 20-detector mistake engine + narrative report |
| Risk Management | `#/risk` | Position sizing, limits, live breaches |
| Strategy Analysis | `#/strategy` | Per-model attribution + playbook library |
| Psychology | `#/psychology` | Emotion-vs-outcome correlation |
| Challenge Tracker | `#/challenge` | Prop-firm progress and drawdown room |
| Reports | `#/reports` | Daily→annual, PDF / CSV / print |
| Notifications | `#/notifications` | Trade + risk events |
| Profile | `#/profile` | Identity, JSON export, account deletion |
| Settings | `#/settings` | Currency, balance, PWA install, security notes |
| AI Configuration | `#/ai-config` | Provider, model, key handling, connection test |

---

## 3. Feature list

**Journal** — manual entry as the primary workflow (no broker API required). 40+ fields: instrument,
market, direction, entry/exit/stop/target, lot size, contract size, tick size/value, currency,
timestamps, session, timeframe, strategy, setup, risk %, commission, swap, spread, fees, screenshots,
notes, emotions and a per-trade rule checklist. Open/closed trades, duplicate, edit, delete.

**Calculation engine** (pure functions, 100 % unit-tested)
- Gross and net P&L from broker tick maths: `(exit − entry) ÷ tickSize × tickValue × lots`
- Money at risk, R-multiple, planned R:R, holding time, cost totals
- Win rate, profit factor, expectancy, average win/loss, average R, streaks, recovery factor
- Equity curve, peak-to-trough drawdown in money and %, calendar buckets, month/session/strategy grouping

**AI Monthly Trading Intelligence** — 20 detectors covering overtrading, revenge trading, FOMO,
late entries, early exits, missing/manipulated stops, lot-size inconsistency, excessive risk, poor R:R,
unconfirmed entries, counter-trend exposure, repeated losing setups, impulsive re-entry, rule
violations, daily-loss breaches, emotional trading, overconfidence, unplanned trades, poor session
selection and strategy drift. Each finding carries severity, frequency, affected trade IDs, evidence,
financial impact, explanation, corrective action and an explicit **verified-fact vs interpretation** flag.

**AI Trade Investigation** — 8 structured questions per trade, each answered from recorded fields and
labelled verified/interpretation, plus an execution score and improvement list.

**AI Trading Coach** — conversation history persisted per user, answers grounded in a compact JSON
snapshot of *your* statistics. Local statistical engine answers when no key is configured, so the
feature never dies.

**Risk Management** — position sizing from real tick specs, risk/reward checks, daily & weekly loss
limits, drawdown guard, daily trade cap, consecutive-loss alert, configurable contract defaults.

**Challenge Tracker** — multiple profiles with target progress, remaining daily-loss allowance,
remaining max-loss allowance, minimum trading days, phase and status.

**Reports** — daily/weekly/monthly/quarterly/annual/custom, export to PDF (jsPDF), CSV and print.

**Platform** — installable PWA with offline app shell, Android APK via Capacitor, safe-area handling,
keyboard resize, hardware back button, status-bar theming.

---

## 4. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| UI | React 18 + TypeScript + Vite 6 | Route-level code splitting, error boundary, skeletons |
| Styling | Tailwind CSS 3 | Custom Sakura/violet design tokens |
| Charts | Recharts | Equity, daily P&L, monthly, donut, drawdown, distribution |
| Icons | lucide-react | |
| State | React context + typed repository abstraction | Local ↔ Supabase swap with no page changes |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) | RLS on every table |
| AI | OpenAI or any OpenAI-compatible endpoint via Edge Function | Also supports BYOK for local demo |
| Exports | jsPDF, Blob CSV | |
| Android | Capacitor 6 + Gradle + AGP 8.2 | `com.segawa.tradeai` |
| CI/CD | GitHub Actions | Tests → Pages deploy; APK build; tagged releases |

---

## 5. Installation

```bash
git clone https://github.com/devkazzu/Segawa-Trading-AI.git
cd Segawa-Trading-AI
npm install            # installs the root (Capacitor) and frontend workspaces
cp .env.example frontend/.env   # optional — the app runs without it in local demo mode
npm run dev            # http://localhost:5173
```

Requires **Node 20+**. The app runs immediately in **Local Demo Mode** (no backend needed).
Click **“Explore with demo data”** on the login screen to load a clearly-labelled sample journal.

---

## 6. Development setup

```bash
npm run dev         # Vite dev server on 0.0.0.0:5173
npm run build       # typecheck + production build → frontend/dist
npm run preview     # serve the production build
npm test            # 81 unit + render tests (vitest)
npm run typecheck   # tsc --noEmit equivalent
```

Project layout:

```
segawa-tradeai/
├── frontend/                 # React + Vite application
│   ├── public/               # mascot, icons, manifest, service worker
│   └── src/
│       ├── components/       # design system, charts, layout, brand
│       ├── context/          # app store + toasts
│       ├── lib/              # calc, risk, analysis, db, export, ai/
│       ├── pages/            # 20 routed screens
│       └── test/             # vitest suites
├── supabase/
│   ├── migrations/           # schema + RLS
│   └── functions/            # ai-coach, delete-account
├── android/                  # Capacitor Android project (Gradle)
├── backend/                  # pointer + deployment notes for the API layer
├── docs/                     # architecture, database, deployment, security…
├── .github/workflows/        # web-deploy, android-build, release
├── capacitor.config.ts
└── package.json              # npm workspaces
```

---

## 7. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations (`supabase/migrations/*.sql`) — see [docs/DATABASE.md](docs/DATABASE.md).
3. Copy the project URL and **anon** key into `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
   ```
4. Restart `npm run dev`. The app switches from Local Demo Mode to real accounts automatically
   (the banner on the login screen tells you which mode is active).

Never put the **service-role** key in any `VITE_*` variable — it bypasses RLS and must only exist
inside Edge Functions.

---

## 8. AI configuration

Two supported paths:

**A. Server-side (recommended, production)** — Supabase Edge Function proxy:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy ai-coach
```

Requests are authenticated, validated and rate-limited (30/user/hour). The key never reaches the browser.

**B. Bring-your-own-key (local demo only)** — enter a key in **AI Configuration**. It is stored in this
browser's `localStorage` and sent directly to the provider. The UI warns you that this is not
production-safe.

**C. No key at all** — the built-in **local statistical engine** answers coach, audit and report
questions from your recorded trades. This is a real analysis engine, not an error message.

---

## 9. Environment variables

See [`.env.example`](.env.example). Only `VITE_*` values are public:

| Variable | Public | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Public anon key (RLS-protected) |
| `VITE_AI_FUNCTION` | ✅ | Edge Function name (default `ai-coach`) |
| `VITE_BASE_PATH` | ✅ | `/` locally, `/Segawa-Trading-AI/` on GitHub Pages |
| `OPENAI_API_KEY` | ❌ | Supabase Edge Function secret only |
| `ANDROID_KEYSTORE_*` | ❌ | GitHub Actions secrets only |

---

## 10. Database migrations

```bash
supabase link --project-ref YOUR_REF
supabase db push            # applies supabase/migrations/*.sql
```

Or paste `20240101000000_init.sql` then `20240101000100_rls.sql` into the SQL editor.
Full table-by-table reference: [docs/DATABASE.md](docs/DATABASE.md).

---

## 11. GitHub setup

The project already lives in this repository (`devkazzu/Segawa-Trading-AI`). To enable Pages:

1. Merge the working PR into `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Optionally add repository **variables** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Push to `main` (or run *Web — test, build & deploy* manually).

URL pattern: `https://<your-username>.github.io/Segawa-Trading-AI/`.
The workflow reports the real deployed URL in its summary — verify it there rather than trusting
this README.

---

## 12. Live deployment

GitHub Pages hosts the static frontend only. Supabase hosts auth, database, storage and the AI proxy —
Pages cannot run server-side code. If `VITE_SUPABASE_*` is absent at build time, the deployed site
runs in **Local Demo Mode** and says so on the login screen.

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 13. APK build

The APK is built by `.github/workflows/android-build.yml` (no local Android SDK required):

- Triggers: push to `main`, manual dispatch, tags `v*`
- Steps: install → test → build web → `cap sync` → JDK 17 + Android SDK → `gradle assembleDebug` (+ signed release when secrets exist)
- Artifacts: `Segawa-TradeAI-v<version>-debug.apk`, `Segawa-TradeAI-v<version>.apk`
- Tagged builds are attached to the GitHub Release automatically

Local build (if you have the Android SDK):

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

---

## 14. APK installation

1. Download the APK from the workflow artifact or release page.
2. Allow “Install unknown apps” for your browser/file manager.
3. Open the APK and install. Package id: `com.segawa.tradeai`.

---

## 15. Release signing

Add these GitHub Actions secrets (never commit a keystore):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

With them present the workflow produces a **signed** release APK. Without them it produces a debug
APK and an unsigned release APK, and says so in the job summary — it never pretends a signed build exists.

---

## 16. Troubleshooting

| Symptom | Fix |
|---|---|
| “Local demo mode” banner on login | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing or the dev server wasn’t restarted |
| Blank page on GitHub Pages | Pages source must be “GitHub Actions”; base path must be `/Segawa-Trading-AI/` |
| AI answers say “Local statistical engine” | No provider key (server or BYOK) → expected fallback |
| APK artifact missing | Check the *Android — build APK* run log; usually a Gradle/SDK version mismatch |
| Trades vanished after clearing browser data | Demo mode is browser-only — export JSON from Profile first |
| Charts not rendering on a tiny screen | Charts need a nonzero container width; verify no `display:none` ancestor |

More: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## 17. Security notes

- **RLS on every table**, keyed on `auth.uid()`; storage bucket is private with per-user folders.
- **No secrets in the bundle** — CI greps the frontend source for key patterns and fails the build.
- **AI is proxied** through an authenticated, rate-limited Edge Function.
- **AI never executes trades** and cannot access broker credentials — there are none.
- Local demo auth uses SHA-256 hashing in-browser; it is explicitly not a production auth system.
- Full threat model: [docs/SECURITY.md](docs/SECURITY.md).

---

## 18. Known limitations

1. **No broker API sync** — deliberate: manual journaling is the product, not a temporary gap.
2. **Screenshots** are stored as compressed data URLs inside the trade record (max ~1400 px JPEG).
   A storage-backed upload path and `trade_screenshots` table exist, but the client uses embedded
   images for offline reliability. Very large galleries will bloat rows in Supabase mode.
3. **Late-entry / FOMO detectors** are proxy heuristics and are labelled *interpretation*, never fact.
4. **Statistics need volume** — fewer than 20 trades per model is indicative, not conclusive.
5. **No multi-account aggregation UI** yet; the schema supports `accounts`, the UI tracks one account.
6. **Streaming AI** works for BYOK OpenAI-compatible endpoints; the Edge Function returns a complete
   response in one payload.
7. **iOS** is configured in `capacitor.config.ts` but no Xcode project is committed (no macOS runner).
8. Reports are English-only.

---

## Documentation index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and data flow
- [docs/DATABASE.md](docs/DATABASE.md) — tables, relations, RLS, backup
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Pages, Supabase, Android
- [docs/ANDROID.md](docs/ANDROID.md) — Capacitor/Gradle details and signing
- [docs/AI.md](docs/AI.md) — prompts, grounding rules, providers, limits
- [docs/TESTING.md](docs/TESTING.md) — what is tested and how to run it
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and checklist
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [docs/DELIVERY.md](docs/DELIVERY.md) — final delivery checklist & verification log

---

## License

MIT — see [LICENSE](LICENSE).

> **Risk disclaimer.** Segawa TradeAI is an analytical journal and coaching tool. It does not execute
> trades, does not connect to brokers, and provides no financial advice. Trading carries a substantial
> risk of loss. No output of this software guarantees profit or predicts prices.
