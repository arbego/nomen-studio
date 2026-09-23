import { useMemo } from 'react';
import type { Pick } from '../geometry/types';
import { buildOutlineGeometry } from '../geometry/outline';

interface OutlineMeshProps {
  pick: Pick;
  positionX: number;
  letterGapsMm: number[];
  growMm: number;
  extrudeDepthMm: number;
  color: string;
}

/**
 * A growable solid backing card under the word's current letter silhouettes —
 * purely derived/reactive (see geometry/outline.ts), with no drag
 * interaction of its own, unlike letters and sticks. Renders nothing when
 * there's nothing to show (not grown at all, or the word has no letters yet).
 */
export function OutlineMesh({ pick, positionX, letterGapsMm, growMm, extrudeDepthMm, color }: OutlineMeshProps) {
  const outline = useMemo(() => buildOutlineGeometry(pick, letterGapsMm, growMm, extrudeDepthMm), [pick, letterGapsMm, growMm, extrudeDepthMm]);

  if (!outline) {
    return null;
  }

  return (
    <mesh position={[positionX, 0, 0]} geometry={outline.mainGeometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}
