/** Registers the service worker shell; safe to call in dev (no-op if no SW). */
export async function registerPwa(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  try {
    const base = import.meta.env.BASE_URL;
    const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    // Activate a waiting worker so the offline shell updates on next open.
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage({ type: 'SKIP_WAITING' });
      });
    });
  } catch (err) {
    console.warn('Service worker registration failed', err);
  }
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  const evt = (window as unknown as { __segawaInstallPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } }).__segawaInstallPrompt;
  if (!evt) return 'unsupported';
  await evt.prompt();
  const choice = await evt.userChoice;
  return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
}
