import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.segawa.tradeai',
  appName: 'Segawa TradeAI',
  webDir: 'frontend/dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0A0714',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0714',
  },
  server: {
    androidScheme: 'https',
    hostname: 'segawa.tradeai',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: false,
      backgroundColor: '#0A0714',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0714',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
