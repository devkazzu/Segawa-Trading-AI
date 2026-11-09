# Android build & release

## Project

| Setting | Value |
|---|---|
| Application id | `com.segawa.tradeai` |
| Display name | Segawa TradeAI |
| Min SDK | 22 (Android 5.1) |
| Target / compile SDK | 34 |
| Build tools | AGP 8.2.1, Gradle 8.2.1 (wrapper), JDK 17 |
| Web assets | `frontend/dist` → `android/app/src/main/assets/public` (via `cap sync`) |

Capacitor plugins wired into the native shell:

| Plugin | Use |
|---|---|
| `@capacitor/status-bar` | Violet-dark status bar that matches the design |
| `@capacitor/splash-screen` | Native launch screen, hidden after the WebView paints |
| `@capacitor/keyboard` | `Native` resize so the trade form stays visible |
| `@capacitor/app` | Hardware back button → history back, exit at root |
| `@capacitor/filesystem` / `@capacitor/camera` | Available for screenshot attachments |

Native behaviour lives in `src/lib/native.ts` and is guarded by `Capacitor.isNativePlatform()`, so the
web build never executes native code paths.

## Local build

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug       # → app/build/outputs/apk/debug/*.apk
./gradlew assembleRelease     # signed when env vars are present
./gradlew bundleRelease       # AAB for Play Console
```

If `./gradlew` is unavailable, use a system Gradle 8.x: `gradle :app:assembleDebug`.

## CI build

`.github/workflows/android-build.yml`:

1. checkout → Node 20 → `npm ci` → `npm test`
2. `npm run build` with `VITE_BASE_PATH=/`
3. `npx cap sync android`
4. JDK 17 + `android-actions/setup-android` (platform 34, build-tools 34.0.0)
5. `gradle/actions/setup-gradle` (Gradle 8.7)
6. decode keystore secret if present
7. `gradle :app:assembleDebug` and, when signing exists, `:app:assembleRelease`
8. rename outputs to `Segawa-TradeAI-v<version>[-debug].apk`, upload artifacts, write a summary
9. on tags: attach APKs to the GitHub Release

Version name comes from the git tag (`v1.2.0` → `1.2.0`) or `package.json`; version code is the commit count.

## Signing

Create a keystore once (keep it out of the repo — `.gitignore` blocks `*.keystore`, `*.jks`, `*.p12`):

```bash
keytool -genkeypair -v -keystore segawa-release.keystore \
  -alias segawa -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 segawa-release.keystore > keystore.b64
```

Add four repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

`app/build.gradle` only defines a `release` signing config when `ANDROID_KEYSTORE_PATH` exists, so an
unsigned environment can never produce a mis-signed APK — it produces a debug build and says so.

## Installation

1. Download the APK from the Actions artifact or Releases page.
2. Enable “Install unknown apps” for your file manager/browser.
3. Open the APK → Install. Launch **Segawa TradeAI**.

## Play Store notes

- Build an AAB: `./gradlew bundleRelease` (workflow can be extended with a `bundleRelease` step).
- Target API 34 satisfies current Play requirements; bump `variables.gradle` as Google raises the floor.
- Play requires a privacy policy URL — describe that trade data lives in the user's Supabase project.

## Known native caveats

- The app ships the web bundle inside the APK, so **web updates require a new APK**. For live web
  content you can point `server.url` at your Pages URL, at the cost of offline reliability.
- Screenshots are embedded as compressed data URLs (≈1400 px JPEG) rather than native file paths.
- No iOS Xcode project is committed (no macOS runner in this repository).
