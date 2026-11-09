# Setup guide

## 0. Requirements

- Node.js 20+ and npm 10+
- Optional: Supabase CLI (backend), Android SDK + JDK 17 (local APK)

## 1. Install

```bash
git clone https://github.com/devkazzu/Segawa-Trading-AI.git
cd Segawa-Trading-AI
npm install
```

`npm install` at the root installs both the Capacitor root package and the `frontend` workspace.

## 2. Run

```bash
npm run dev
```

Open `http://localhost:5173`, click **Explore with demo data**. You now have 68 sample trades spread
over five months, two strategies, a challenge profile and psychology entries — all clearly labelled as
demo data and stored only in this browser.

## 3. Make it yours

- **Settings**: currency, starting balance, timezone, default instrument/risk.
- **Risk Management**: risk cap, daily/weekly loss limits, drawdown, contract defaults.
- **Trade Journal → Add trade**: log real trades. Delete the demo data from **Profile → Clear journal data**.

## 4. Optional: real accounts (Supabase)

```bash
supabase login
supabase link --project-ref <ref>
supabase db push
supabase functions deploy ai-coach delete-account
supabase secrets set OPENAI_API_KEY=sk-...
```

```env
# frontend/.env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Restart `npm run dev`. The login banner should now read “Supabase connected”.

## 5. Optional: AI

Either deploy the Edge Function (step 4) or open **AI configuration** and paste a BYOK key for local
testing. With neither, the local statistical engine answers — by design.

## 6. Optional: Android

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

Or push to `main` and download the APK from the Actions run.

## 7. Verify

```bash
npm test          # 80 tests
npm run build     # production bundle
```

Both must be green before you deploy.
