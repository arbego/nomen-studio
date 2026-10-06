import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FloatWarning } from '../../ui/FloatWarning';
import { looseCakeTopperParts } from './connectivity';
import { useCakeTopperGeometry } from './geometryContext';
import { selectCakeTopperConfig, useCakeTopperStore } from './store';

/**
 * Whether the topper would come out of the printer in one piece.
 *
 * Memoized because it is a run of polygon intersections and it watches a panel
 * that changes on every keystroke. Not folded into the provider's build alongside
 * the geometry, because it turns on the cheap, synchronous half of the design —
 * where each line was dragged, where each stick sits, how far the card is grown —
 * which that build deliberately excludes so dragging never re-runs a font (see
 * geometry.ts).
 */
export function CakeTopperWarnings() {
  const config = useCakeTopperStore(useShallow(selectCakeTopperConfig));
  const { blocks, decorators, loading, error } = useCakeTopperGeometry();
  const block = blocks[0];

  const parts = useMemo(() => (block && !loading && !error ? looseCakeTopperParts(block, decorators, config) : []), [block, decorators, config, loading, error]);

  return (
    <FloatWarning
      parts={parts}
      remedy={
        config.outlineEnabled
          ? 'Grow the backing card, or drag them until they touch what it already holds.'
          : 'Drag them together until they overlap, or switch the backing card on to hold them.'
      }
    />
  );
}
