import { Capacitor } from '@capacitor/core';

/**
 * Native shell integration (Android via Capacitor). All calls are guarded so
 * the web build never imports native-only behaviour at runtime.
 */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Capture the PWA install prompt for the Settings page.
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      (window as unknown as { __segawaInstallPrompt?: unknown }).__segawaInstallPrompt = e;
    });
    return;
  }

  document.documentElement.classList.add('native-shell');
  document.body.classList.add('native-shell');

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0A0714' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (e) { console.warn('StatusBar unavailable', e); }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 350 });
  } catch (e) { console.warn('SplashScreen unavailable', e); }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch (e) { console.warn('Keyboard plugin unavailable', e); }

  try {
    const { App: CapApp } = await import('@capacitor/app');
    await CapApp.addListener('backButton', (info: { canGoBack: boolean }) => {
      const isRoot = ['#/', '#/login', '#/welcome', ''].includes(window.location.hash);
      if (info.canGoBack && !isRoot) window.history.back();
      else void CapApp.exitApp();
    });
    await CapApp.addListener('appUrlOpen', (event: { url: string }) => {
      const path = event.url.split('#').pop();
      if (path) window.location.hash = path;
    });
  } catch (e) { console.warn('App plugin unavailable', e); }
}

export const isNative = (): boolean => Capacitor.isNativePlatform();
