import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNativeApp = Capacitor.isNativePlatform();

// The Android app serves the UI from the device, so API calls need the deployed origin.
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://bandiera-gestion.vercel.app';

export function apiUrl(path: string): string {
  return isNativeApp ? `${API_ORIGIN.replace(/\/$/, '')}${path}` : path;
}

export function initNativeShell(): void {
  if (!isNativeApp) return;
  document.documentElement.classList.add('cap-native');
  // Hardware back: close an open dialog via history if possible, otherwise background the app
  // instead of closing it, so an unsent remito is never lost.
  App.addListener('backButton', ({ canGoBack }) => {
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    if (document.querySelector('[role="dialog"], .fixed.inset-0')) {
      document.dispatchEvent(escape);
      return;
    }
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
