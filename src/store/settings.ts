import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotationStyle } from '../lib/notation';

export type DepthPreset = 'fast' | 'standard' | 'deep';

export const DEPTHS: Record<DepthPreset, { depth: number; label: string; hint: string }> = {
  fast: { depth: 10, label: 'Rapide', hint: '≈ 15 s par partie' },
  standard: { depth: 13, label: 'Standard', hint: '≈ 45 s par partie' },
  deep: { depth: 16, label: 'Approfondie', hint: '≈ 2 min par partie' },
};

export type AppTheme = 'classic' | 'manga';

interface SettingsState {
  appTheme: AppTheme;
  impactFx: boolean;
  boardTheme: string;
  pieceSet: string;
  notation: NotationStyle;
  depthPreset: DepthPreset;
  sounds: boolean;
  haptics: boolean;
  showArrows: boolean;
  showCoords: boolean;
  autoAnalyze: boolean;
  onboarded: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      appTheme: 'classic',
      impactFx: true,
      boardTheme: 'green',
      pieceSet: 'cburnett',
      notation: 'figurine',
      depthPreset: 'standard',
      sounds: true,
      haptics: true,
      showArrows: true,
      showCoords: true,
      autoAnalyze: true,
      onboarded: false,
      set: (patch) => set(patch),
    }),
    { name: 'analysechess-settings' },
  ),
);
