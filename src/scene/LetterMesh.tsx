import { useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { LetterGeometry } from '../geometry/types';

function setCursor(cursor: string) {
  if (typeof document !== 'undefined') {
    document.body.style.cursor = cursor;
  }
}

interface LetterMeshProps {
  letter: LetterGeometry;
  color: string;
  /** x offset (mm) from this letter's own natural, baked-in position — the cumulative effect of every gap override before it (0 for the first letter of a line, which has no gap before it). */
  xMm: number;
  /** y offset (mm) — this letter's line's own draggable position offset, shared by every letter in that line. */
  yMm: number;
  /** Every letter is draggable: the first letter of a line drags the whole line's position, every other letter closes/opens the gap before it. */
  draggable: boolean;
  dragging: boolean;
  /**
   * Whether *something* in this pick (any letter, line, or stick — not
   * necessarily this one) is currently being dragged. React Three Fiber's
   * pointer capture only guarantees drag *events* keep reaching the captured
   * object — it still raycasts and fires onPointerOver/onPointerOut on
   * whatever else the cursor happens to pass over mid-drag. Without this,
   * dragging one object across another would light up the one merely being
   * passed over, as if it were also about to be picked up.
   */
  anyDragActive: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
}

/** One letter of a line — a static, pre-extruded solid positioned via a cheap (x, y) translation, draggable to either close/open the gap before it or (for a line's first letter) reposition the whole line. */
export function LetterMesh({ letter, color, xMm, yMm, draggable, dragging, anyDragActive, onPointerDown, onPointerMove, onPointerUp }: LetterMeshProps) {
  const [hovered, setHovered] = useState(false);
  // Hovering lights this letter up, unless it's just being passed over while
  // something *else* is being dragged — but being dragged itself always
  // highlights it, regardless of anyDragActive.
  const highlighted = draggable && (dragging || (hovered && !anyDragActive));

  return (
    <mesh
      geometry={letter.geometry}
      position={[xMm, yMm, 0]}
      castShadow
      receiveShadow
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? onPointerUp : undefined}
      onPointerOver={
        draggable
          ? (e) => {
              e.stopPropagation();
              setHovered(true);
              if (!dragging && !anyDragActive) setCursor('grab');
            }
          : undefined
      }
      onPointerOut={
        draggable
          ? (e) => {
              e.stopPropagation();
              setHovered(false);
              if (!dragging && !anyDragActive) setCursor('auto');
            }
          : undefined
      }
    >
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
        emissive={highlighted ? color : '#000000'}
        emissiveIntensity={highlighted ? 0.15 : 0}
      />
    </mesh>
  );
}
