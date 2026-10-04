import type { StandMode } from '../../geometry/baseGeometry';

/**
 * The three ways a piece can be made to stand, as the panel words them.
 *
 * Beside the control rather than inside it, so a panel can say which one is set
 * without opening the section that sets it — and so the file holding the
 * control goes on exporting only the control (fast refresh wants that).
 */
export const MODES: { value: StandMode; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'Relies on the font having a flat bottom of its own, like a slab serif does.' },
  { value: 'rail', label: 'Base rail', hint: 'A slab under the piece, with a socket cut into it for the piece to drop into. Works with any font, including scripts.' },
  { value: 'trim', label: 'Flat cut', hint: 'Slices the piece off flat at the baseline. Adds no material, but leaves a narrow footprint.' },
];

/** What each mode is called, keyed by mode. */
export const STAND_MODE_LABELS: Record<StandMode, string> = Object.fromEntries(MODES.map((mode) => [mode.value, mode.label])) as Record<StandMode, string>;
