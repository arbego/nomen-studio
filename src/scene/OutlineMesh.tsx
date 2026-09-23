import { useMemo } from 'react';
import type { Pick } from '../geometry/types';
import { buildOutlineGeometry } from '../geometry/outline';

interface OutlineMeshProps {
  pick: Pick;
  positionX: number;
  letterGapsMm: number[];
  growMm: number;
  /** The card's own thickness — deliberately independent of the word's extrudeDepthMm, and normally shallower, so the letters (which start at the same z=0 base) visibly stand proud of it instead of being flush with (and so hidden behind) it. */
  depthMm: number;
  color: string;
}

/**
 * A growable solid backing card under the word's current letter silhouettes —
 * purely derived/reactive (see geometry/outline.ts), with no drag
 * interaction of its own, unlike letters and sticks. Renders nothing when
 * there's nothing to show (not grown at all, or the word has no letters yet).
 */
export function OutlineMesh({ pick, positionX, letterGapsMm, growMm, depthMm, color }: OutlineMeshProps) {
  const outline = useMemo(() => buildOutlineGeometry(pick, letterGapsMm, growMm, depthMm), [pick, letterGapsMm, growMm, depthMm]);

  if (!outline) {
    return null;
  }

  return (
    <mesh position={[positionX, 0, 0]} geometry={outline.mainGeometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}
