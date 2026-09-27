import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useSettings } from '../store/settings';

export const isNative = Capacitor.isNativePlatform();

export function tapFeedback(style: 'light' | 'medium' = 'light') {
  if (!isNative || !useSettings.getState().haptics) return;
  void Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => undefined);
}
