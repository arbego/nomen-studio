import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Pick, StickOffset } from '../geometry/types';
import { combinedLetterBounds, cumulativeGaps, normalizedLetterGaps, clampDesiredLetterPosition, gapForDesiredPosition } from '../geometry/letterLayout';
import { localDragPoint } from './dragUtils';
import { StickMesh } from './StickMesh';
import { LetterMesh } from './LetterMesh';

export interface StickParams {
  lengthMm: number;
  widthMm: number;
  embedMm: number;
  thicknessMm: number;
}

// OrbitControls listens to native pointer events directly on the canvas, so a
// synthetic-event stopPropagation() from a mesh handler doesn't stop it from
// also rotating the camera during a drag — it has to be disabled explicitly.
type ToggleableControls = { enabled: boolean };

interface PickMeshProps {
  pick: Pick;
  color: string;
  positionX: number;
  stick: StickParams;
  stickColor: string;
  stickOffsets: StickOffset[];
  onStickOffsetCommit: (index: number, offset: StickOffset) => void;
  letterGapsMm: number[];
  onLetterGapCommit: (index: number, gapMm: number) => void;
}

interface DraggingGap {
  /** Index into letterGapsMm — the gap immediately before the letter being dragged. */
  gapIndex: number;
  gapMm: number;
}

/**
 * One pick: every letter (each a separate, individually draggable mesh — see
 * LetterMesh) plus its sticks. Dragging any letter but the first closes/opens
 * the gap before it and cascades to every letter after it; the drag state
 * lives here (not in LetterMesh) because — unlike sticks, which move
 * independently of each other — a single letter drag can move several
 * downstream letters at once, so every letter needs to see the same live value.
 */
export function PickMesh({ pick, color, positionX, stick, stickColor, stickOffsets, onStickOffsetCommit, letterGapsMm, onLetterGapCommit }: PickMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const controls = useThree((s) => s.controls) as ToggleableControls | null;
  const [dragging, setDragging] = useState<DraggingGap | null>(null);

  const gaps = normalizedLetterGaps(pick.letters.length, letterGapsMm);
  const naturalXsMm = useMemo(() => pick.letters.map((letter) => letter.naturalXMm), [pick.letters]);
  const effectiveGaps = dragging ? gaps.map((gap, i) => (i === dragging.gapIndex ? dragging.gapMm : gap)) : gaps;
  const cascade = useMemo(() => cumulativeGaps(effectiveGaps), [effectiveGaps]);
  const bounds = useMemo(() => combinedLetterBounds(pick.letters, effectiveGaps), [pick.letters, effectiveGaps]);

  function updateDrag(letterIndex: number, event: ThreeEvent<PointerEvent>) {
    const reference = groupRef.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (!point) return;
    // Solved fresh from the last *committed* gaps every frame (not from the
    // previous drag frame's live value) — avoids compounding rounding error
    // over a long drag.
    const desired = clampDesiredLetterPosition(letterIndex, point.x, naturalXsMm, gaps);
    const gapMm = gapForDesiredPosition(letterIndex, desired, naturalXsMm, gaps);
    setDragging({ gapIndex: letterIndex - 1, gapMm });
  }

  function handlePointerDown(letterIndex: number, event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- controls is a live Three.js object from useThree, not React state
    if (controls) controls.enabled = false;
    updateDrag(letterIndex, event);
  }

  function handlePointerMove(letterIndex: number, event: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    event.stopPropagation();
    updateDrag(letterIndex, event);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- see handlePointerDown
    if (controls) controls.enabled = true;
    onLetterGapCommit(dragging.gapIndex, dragging.gapMm);
    setDragging(null);
  }

  return (
    <group ref={groupRef} position={[positionX, 0, 0]}>
      {pick.letters.map((letter, i) => (
        <LetterMesh
          key={i}
          letter={letter}
          color={color}
          cascadeXMm={cascade[i]}
          draggable={i > 0}
          dragging={dragging?.gapIndex === i - 1}
          onPointerDown={(e) => handlePointerDown(i, e)}
          onPointerMove={(e) => handlePointerMove(i, e)}
          onPointerUp={handlePointerUp}
        />
      ))}
      {stickOffsets.map((offset, index) => (
        <StickMesh
          key={index}
          bounds={bounds}
          color={stickColor}
          stick={stick}
          offset={offset}
          referenceObject={groupRef}
          onOffsetCommit={(newOffset) => onStickOffsetCommit(index, newOffset)}
        />
      ))}
    </group>
  );
}
