import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotationStyle } from '../lib/notation';

export type DepthPreset = 'fast' | 'standard' | 'deep';

export const DEPTHS: Record<DepthPreset, { depth: number; label: string; hint: string }> = {
  fast: { depth: 11, label: 'Rapide', hint: '≈ 20 s par partie' },
  standard: { depth: 14, label: 'Standard', hint: '≈ 1 min par partie' },
  deep: { depth: 17, label: 'Approfondie', hint: '≈ 3 min par partie' },
};

interface SettingsState {
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
