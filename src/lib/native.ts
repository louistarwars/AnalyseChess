import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useSettings } from '../store/settings';

export const isNative = Capacitor.isNativePlatform();

export function tapFeedback(style: 'light' | 'medium' = 'light') {
  if (!isNative || !useSettings.getState().haptics) return;
  void Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => undefined);
}

/** Partage natif (Android) ou presse-papiers (navigateur). Renvoie 'shared' | 'copied' | 'failed'. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNative) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function readClipboard(): Promise<string | null> {
  try {
    if (isNative) {
      const { Clipboard } = await import('@capacitor/clipboard');
      const { value } = await Clipboard.read();
      return value ?? null;
    }
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
