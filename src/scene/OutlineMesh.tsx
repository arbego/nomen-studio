import { useMemo } from 'react';
import type { TextBlock, Offset2D } from '../geometry/types';
import { buildOutlineGeometry } from '../geometry/outline';

interface OutlineMeshProps {
  block: TextBlock;
  positionX: number;
  letterGapsMm: number[][];
  lineOffsets: Offset2D[];
  growMm: number;
  /** The card's own thickness — deliberately independent of the word's extrudeDepthMm, and normally shallower, so the letters (which start at the same z=0 base) visibly stand proud of it instead of being flush with (and so hidden behind) it. */
  depthMm: number;
  color: string;
  /** Counter holes (e.g. the "a" in a script font) the user has manually filled in — see outline.ts. */
  closedOutlineHoles: string[];
}

/**
 * A growable solid backing card wrapping every line's current letter
 * silhouettes together — purely derived/reactive (see geometry/outline.ts),
 * with no drag interaction of its own, unlike letters and sticks. Renders
 * nothing when there's nothing to show (not grown at all, or the block has no
 * letters yet).
 */
export function OutlineMesh({ block, positionX, letterGapsMm, lineOffsets, growMm, depthMm, color, closedOutlineHoles }: OutlineMeshProps) {
  const outline = useMemo(
    () => buildOutlineGeometry(block, letterGapsMm, lineOffsets, growMm, depthMm, closedOutlineHoles),
    [block, letterGapsMm, lineOffsets, growMm, depthMm, closedOutlineHoles],
  );

  if (!outline) {
    return null;
  }

  return (
    <mesh position={[positionX, 0, 0]} geometry={outline.mainGeometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}
