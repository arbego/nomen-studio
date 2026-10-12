import type { BufferGeometry } from 'three';
import type { Region } from '../../../geometry/clipper';
import type { StickyNameConfig } from '../config';

/** Font outlines -> themed solid -> magnet cuts. Themes never own magnet logic. */
export interface LetterTheme {
  id: StickyNameConfig['theme'];
  label: string;
  build: (region: Region, config: StickyNameConfig) => BufferGeometry;
}
