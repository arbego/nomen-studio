import type { ProductProject } from '../types';
import { parseStickyNameConfig } from './parseConfig';
import { selectStickyNameConfig, useStickyNameStore } from './store';

export const stickyNameProjectIO: ProductProject = {
  snapshot: () => {
    const config = selectStickyNameConfig(useStickyNameStore.getState());
    return { name: config.name, design: config };
  },
  load: (raw) => useStickyNameStore.getState().loadConfig(parseStickyNameConfig(raw)),
};
