import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.com.jobbandiera.gestion',
  appName: 'JOB Bandiera',
  webDir: 'dist',
  android: {
    // Release builds must not be debuggable from Chrome DevTools.
    webContentsDebuggingEnabled: false,
    allowMixedContent: false
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0f172a',
      showSpinner: false
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0f172a'
    }
  }
};

export default config;
