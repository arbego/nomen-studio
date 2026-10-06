/** Past this many, the list stops naming parts and starts counting them — a warning you have to read twice is one you stop reading. */
const NAMED_LIMIT = 3;

interface FloatWarningProps {
  /** What nothing holds, already named in the product's own vocabulary — see each product's connectivity module. */
  parts: readonly string[];
  /** One line on how to put it right. Product-specific, because what holds a design together differs between them. */
  remedy: string;
}

/** `a`, `a and b`, `a, b and c`, `a, b and 4 more`. */
function listParts(parts: readonly string[]): string {
  const named = parts.slice(0, NAMED_LIMIT);
  const rest = parts.length - named.length;
  const last = rest > 0 ? `${rest} more` : named.pop()!;
  return named.length === 0 ? last : `${named.join(', ')} and ${last}`;
}

/**
 * Something on the design is touching nothing, so it would print as loose bits in
 * the same job rather than as the one piece on screen.
 *
 * Over the preview and not in the panel, because it is about the thing on screen
 * and it is usually a drag that caused it — and the control it would otherwise sit
 * under may be scrolled away or collapsed. The export is deliberately left
 * working: printing the parts separately and gluing them is a real way to make one
 * of these, and a studio that refuses the file is a studio arguing with its user.
 */
export function FloatWarning({ parts, remedy }: FloatWarningProps) {
  if (parts.length === 0) {
    return null;
  }
  return (
    // Polite rather than assertive: this comes and goes as the design is dragged
    // about, and an alert would interrupt a screen reader on every crossing.
    <div role="status" className="max-w-72 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50/95 dark:bg-amber-950/90 px-3 py-2 text-left shadow-md backdrop-blur">
      <p className="flex items-start gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-px h-4 w-4 shrink-0">
          <path d="M10.3 3.9 1.8 18.4A2 2 0 0 0 3.5 21.4h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <span>Nothing holds {listParts(parts)}.</span>
      </p>
      <p className="mt-1 pl-6 text-xs text-amber-800/80 dark:text-amber-200/70">{remedy}</p>
    </div>
  );
}
