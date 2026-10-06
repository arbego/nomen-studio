import { useMemo } from 'react';
import type { TextBlock, Offset2D } from '../geometry/types';
import { buildOutlineGeometry, type ExtraContours } from '../geometry/outline';

interface OutlineMeshProps {
  block: TextBlock;
  positionX: number;
  letterGapsMm: number[][];
  lineOffsets: Offset2D[];
  growMm: number;
  /**
   * The card's own thickness, deliberately independent of the word's
   * extrudeDepthMm. The card is extruded from z=0 forward, and whatever stands on
   * it starts where it ends — so this is also how far the lettering is lifted off
   * the back of the piece (see the cake topper's contentZMm).
   */
  depthMm: number;
  color: string;
  /** Counter holes (e.g. the "a" in a script font) the user has manually filled in — see outline.ts. */
  closedOutlineHoles: string[];
  /** Silhouettes that belong on the card but are not lettering — a topper's ornaments, which the card grows around and holds. */
  extraContours?: ExtraContours;
}

/**
 * A growable solid backing card wrapping every line's current letter
 * silhouettes together — purely derived/reactive (see geometry/outline.ts),
 * with no drag interaction of its own, unlike letters and sticks. Renders
 * nothing when there's nothing to show (not grown at all, or the block has no
 * letters yet).
 */
export function OutlineMesh({ block, positionX, letterGapsMm, lineOffsets, growMm, depthMm, color, closedOutlineHoles, extraContours }: OutlineMeshProps) {
  const outline = useMemo(
    () => buildOutlineGeometry(block, letterGapsMm, lineOffsets, growMm, depthMm, closedOutlineHoles, extraContours),
    [block, letterGapsMm, lineOffsets, growMm, depthMm, closedOutlineHoles, extraContours],
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
