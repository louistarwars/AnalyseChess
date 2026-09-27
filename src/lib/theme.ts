import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect } from 'react';
import { useSettings, type AppTheme } from '../store/settings';

export function useAppTheme(): AppTheme {
  return useSettings((s) => s.appTheme);
}

export function useIsManga(): boolean {
  return useSettings((s) => s.appTheme === 'manga');
}

/** Applique le thème sur <html> et adapte la couleur des icônes de la barre d'état Android. */
export function useApplyTheme() {
  const theme = useAppTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'manga' ? '#f4efe3' : '#0b0d12');
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme === 'manga' ? 'light' : 'dark');
    if (Capacitor.isNativePlatform()) {
      void SystemBars.setStyle({ style: theme === 'manga' ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => undefined);
    }
  }, [theme]);
}
