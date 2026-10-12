import { create } from 'zustand';
import { createDesignHistory } from '../../store/designHistory';
import { DEFAULT_MAGNET, DEFAULT_STICKY_NAME_CONFIG, MAX_MAGNETS, type MagnetConfig, type StickyNameConfig } from './config';
import { parseStickyNameConfig } from './parseConfig';

interface StickyNameStore extends StickyNameConfig {
  setConfig: (patch: Partial<StickyNameConfig>) => void;
  setMagnetCount: (letter: number, count: number) => void;
  updateMagnet: (letter: number, index: number, patch: Partial<MagnetConfig>) => void;
  autoPlaceMagnets: (letter: number) => void;
  loadConfig: (config: StickyNameConfig) => void;
  reset: () => void;
}

export function selectStickyNameConfig(s: StickyNameConfig): StickyNameConfig {
  return { name: s.name, fontId: s.fontId, theme: s.theme, letterHeightMm: s.letterHeightMm, depthMm: s.depthMm,
    spacingMm: s.spacingMm, bubble: s.bubble, magnets: s.magnets, clearanceMm: s.clearanceMm, previewColor: s.previewColor };
}

export const useStickyNameStore = create<StickyNameStore>((set) => ({
  ...DEFAULT_STICKY_NAME_CONFIG,
  setConfig: (patch) => set((s) => {
    const next = parseStickyNameConfig({ ...selectStickyNameConfig(s), ...patch });
    if (next.name !== s.name) next.magnets = Array.from(next.name, () => []);
    else if (next.fontId !== s.fontId || next.letterHeightMm !== s.letterHeightMm) {
      next.magnets = next.magnets.map((list) => list.map((m) => ({ ...m, position: null })));
    }
    return next;
  }),
  setMagnetCount: (letter, count) => set((s) => {
    if (!Number.isFinite(count) || !s.magnets[letter] || /\s/u.test(Array.from(s.name)[letter])) return s;
    return { magnets: s.magnets.map((list, i) => i === letter ? Array.from({ length: Math.min(MAX_MAGNETS, Math.max(0, Math.round(count))) }, (_, j) => list[j] ?? { ...DEFAULT_MAGNET }) : list) };
  }),
  updateMagnet: (letter, index, patch) => set((s) => parseStickyNameConfig({ ...s,
    magnets: s.magnets.map((list, i) => i === letter ? list.map((m, j) => j === index ? { ...m, ...patch } : m) : list),
  })),
  autoPlaceMagnets: (letter) => set((s) => ({ magnets: s.magnets.map((list, i) => i === letter ? list.map((m) => ({ ...m, position: null })) : list) })),
  loadConfig: (config) => set(parseStickyNameConfig(config)),
  reset: () => set(parseStickyNameConfig(DEFAULT_STICKY_NAME_CONFIG)),
}));

export const stickyNameHistory = createDesignHistory(useStickyNameStore, selectStickyNameConfig);
