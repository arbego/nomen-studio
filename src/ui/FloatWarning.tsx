import { PreviewWarning } from './PreviewWarning';

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
  return <PreviewWarning message={`Nothing holds ${listParts(parts)}.`} remedy={remedy} />;
}
