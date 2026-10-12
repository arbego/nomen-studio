import { create } from 'zustand';

/** Selection and cavity visibility are preview state, never saved in a design. */
export const useStickyNameUI = create<{ selectedLetter: number; showMagnets: boolean; select: (index: number) => void; toggleMagnets: () => void }>((set) => ({
  selectedLetter: 0, showMagnets: true,
  select: (selectedLetter) => set({ selectedLetter }),
  toggleMagnets: () => set((s) => ({ showMagnets: !s.showMagnets })),
}));
