import { ACCENT } from './accent';

/**
 * The letter, as one straight-edged outline. Traced from the original artwork
 * (src/assets/logo/mark-1024.png), which is where to go back to if the mark is
 * ever redrawn.
 */
const LETTER =
  'M0 0L196 0L391 293L389 82L333 66L333 0L563 0L563 68L512 82L512 511L367 511L173 221L174 430L229 444L229 511L0 511L0 445L51 430L51 82L0 67Z';

/**
 * The groove cut across its face — the inlay the whole studio is about, in the
 * one accent colour.
 *
 * Widened from the traced original, which was drawn at 1024px and came out a
 * hairline at the sizes this is actually used: barely over a pixel at the
 * landing screen's 40, and all but gone in a 16px tab, where the light letter
 * of the dark theme gives it least contrast to work with. Centred on the same
 * axis, so the mark itself has not moved.
 */
const INLAY = 'M88 0L124 0L471 511L435 511Z';

interface LogoProps {
  /** Size it by height and let the width follow: `h-8 w-auto`. */
  className?: string;
  /**
   * What it stands for, when it stands alone. Left off beside the name written
   * out in words, where reading it twice helps nobody.
   */
  label?: string;
}

/**
 * The studio's mark: a slab-serif N with a thin inlay cut across it, which is
 * the thing every product here makes — a heavy letter with something set into
 * its face in a second colour.
 *
 * The letter takes `currentColor`, so it is the same ink as the text beside it
 * and needs no second drawing for the dark theme. The inlay keeps the accent in
 * both, as it is the one colour that does not move with the theme.
 */
export function Logo({ className = 'h-8 w-auto', label }: LogoProps) {
  return (
    <svg
      viewBox="0 0 563 512"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path fill="currentColor" d={LETTER} />
      <path fill={ACCENT} d={INLAY} />
    </svg>
  );
}
