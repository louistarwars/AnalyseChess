import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.louistarwars.analysechess',
  appName: 'AnalyseChess',
  webDir: 'dist',
  backgroundColor: '#0b0d12',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#0b0d12',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0d12',
      overlaysWebView: false,
    },
  },
};

export default config;
