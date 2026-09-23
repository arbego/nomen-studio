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
  /** x offset (mm) from this letter's own natural, baked-in position — the cumulative effect of every gap override before it. 0 for the natural case. */
  cascadeXMm: number;
  /** The first letter has no gap before it to adjust, so it isn't draggable. */
  draggable: boolean;
  dragging: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
}

/** One letter of the word — a static, pre-extruded solid positioned via a cheap x translation, draggable (except the first letter) to close/open the gap before it. */
export function LetterMesh({ letter, color, cascadeXMm, draggable, dragging, onPointerDown, onPointerMove, onPointerUp }: LetterMeshProps) {
  const [hovered, setHovered] = useState(false);
  const highlighted = draggable && (hovered || dragging);

  return (
    <mesh
      geometry={letter.geometry}
      position={[cascadeXMm, 0, 0]}
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
              if (!dragging) setCursor('grab');
            }
          : undefined
      }
      onPointerOut={
        draggable
          ? (e) => {
              e.stopPropagation();
              setHovered(false);
              if (!dragging) setCursor('auto');
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
