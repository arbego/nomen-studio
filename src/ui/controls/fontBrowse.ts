import { create } from 'zustand';
import type { FontCategory } from '../../fonts/types';

export interface FontBrowse {
  query: string;
  category: FontCategory | '';
}
export const DEFAULT_FONT_BROWSE: FontBrowse = { query: '', category: '' };

/** Session-only browsing state survives closing a picker or its section. */
export const useFontBrowseStore = create<{
  fields: Record<string, FontBrowse>;
  setBrowse: (key: string, browse: FontBrowse) => void;
}>((set) => ({
  fields: {},
  setBrowse: (key, browse) => set((state) => ({ fields: { ...state.fields, [key]: browse } })),
}));
