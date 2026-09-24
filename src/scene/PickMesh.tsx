import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Pick, StickOffset } from '../geometry/types';
import { combinedPickBounds, cumulativeGaps, normalizedLetterGaps, clampDesiredLetterPosition, gapForDesiredPosition } from '../geometry/letterLayout';
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
  letterGapsMm: number[][];
  onLetterGapCommit: (lineIndex: number, gapIndex: number, gapMm: number) => void;
  lineOffsets: StickOffset[];
  onLineOffsetCommit: (lineIndex: number, offset: StickOffset) => void;
}

interface DraggingGap {
  lineIndex: number;
  /** Index into that line's own letterGapsMm — the gap immediately before the letter being dragged. */
  gapIndex: number;
  gapMm: number;
}

interface DraggingLine {
  lineIndex: number;
  offset: StickOffset;
}

/**
 * One pick: every line's letters (each a separate, individually draggable
 * mesh — see LetterMesh) plus its sticks. Dragging any letter but a line's
 * first closes/opens the gap before it and cascades to every letter after it
 * within that same line; dragging a line's first letter instead repositions
 * the whole line. Both kinds of drag state live here (not in LetterMesh)
 * because a single drag can affect several other letters/meshes at once, so
 * they all need to see the same live value.
 */
export function PickMesh({
  pick,
  color,
  positionX,
  stick,
  stickColor,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  lineOffsets,
  onLineOffsetCommit,
}: PickMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const controls = useThree((s) => s.controls) as ToggleableControls | null;
  const [draggingGap, setDraggingGap] = useState<DraggingGap | null>(null);
  const [draggingLine, setDraggingLine] = useState<DraggingLine | null>(null);

  const naturalXsMmByLine = useMemo(() => pick.lines.map((line) => line.letters.map((letter) => letter.naturalXMm)), [pick.lines]);
  const gapsByLine = useMemo(
    () => pick.lines.map((line, i) => normalizedLetterGaps(line.letters.length, letterGapsMm[i] ?? [])),
    [pick.lines, letterGapsMm],
  );
  const effectiveGapsByLine = draggingGap
    ? gapsByLine.map((gaps, i) => (i === draggingGap.lineIndex ? gaps.map((gap, gi) => (gi === draggingGap.gapIndex ? draggingGap.gapMm : gap)) : gaps))
    : gapsByLine;
  const effectiveLineOffsets = draggingLine
    ? lineOffsets.map((offset, i) => (i === draggingLine.lineIndex ? draggingLine.offset : offset))
    : lineOffsets;
  const cascadesByLine = useMemo(() => effectiveGapsByLine.map((gaps) => cumulativeGaps(gaps)), [effectiveGapsByLine]);
  const bounds = useMemo(
    () => combinedPickBounds(pick, effectiveGapsByLine, effectiveLineOffsets),
    [pick, effectiveGapsByLine, effectiveLineOffsets],
  );

  function updateGapDrag(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    const reference = groupRef.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (!point) return;
    const offset = lineOffsets[lineIndex] ?? { x: 0, y: 0 };
    const naturalXsMm = naturalXsMmByLine[lineIndex];
    const gaps = gapsByLine[lineIndex];
    // Solved fresh from the last *committed* gaps every frame (not from the
    // previous drag frame's live value) — avoids compounding rounding error
    // over a long drag. point.x is in the pick group's space, which already
    // includes this line's own (committed) offset, so it's subtracted back
    // out before solving in the line's own natural-position frame.
    const desired = clampDesiredLetterPosition(letterIndex, point.x - offset.x, naturalXsMm, gaps);
    const gapMm = gapForDesiredPosition(letterIndex, desired, naturalXsMm, gaps);
    setDraggingGap({ lineIndex, gapIndex: letterIndex - 1, gapMm });
  }

  function updateLineDrag(lineIndex: number, event: ThreeEvent<PointerEvent>) {
    const reference = groupRef.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (!point) return;
    setDraggingLine({ lineIndex, offset: { x: point.x, y: point.y } });
  }

  function handlePointerDown(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- controls is a live Three.js object from useThree, not React state
    if (controls) controls.enabled = false;
    if (letterIndex === 0) {
      updateLineDrag(lineIndex, event);
    } else {
      updateGapDrag(lineIndex, letterIndex, event);
    }
  }

  function handlePointerMove(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    if (letterIndex === 0) {
      if (!draggingLine || draggingLine.lineIndex !== lineIndex) return;
      event.stopPropagation();
      updateLineDrag(lineIndex, event);
    } else {
      if (!draggingGap || draggingGap.lineIndex !== lineIndex) return;
      event.stopPropagation();
      updateGapDrag(lineIndex, letterIndex, event);
    }
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!draggingGap && !draggingLine) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- see handlePointerDown
    if (controls) controls.enabled = true;
    if (draggingLine) {
      onLineOffsetCommit(draggingLine.lineIndex, draggingLine.offset);
      setDraggingLine(null);
    }
    if (draggingGap) {
      onLetterGapCommit(draggingGap.lineIndex, draggingGap.gapIndex, draggingGap.gapMm);
      setDraggingGap(null);
    }
  }

  return (
    <group ref={groupRef} position={[positionX, 0, 0]}>
      {pick.lines.map((line, lineIndex) =>
        line.letters.map((letter, i) => {
          const offset = effectiveLineOffsets[lineIndex] ?? { x: 0, y: 0 };
          return (
            <LetterMesh
              key={`${lineIndex}-${i}`}
              letter={letter}
              color={color}
              xMm={cascadesByLine[lineIndex][i] + offset.x}
              yMm={offset.y}
              draggable
              dragging={i === 0 ? draggingLine?.lineIndex === lineIndex : draggingGap?.lineIndex === lineIndex && draggingGap?.gapIndex === i - 1}
              onPointerDown={(e) => handlePointerDown(lineIndex, i, e)}
              onPointerMove={(e) => handlePointerMove(lineIndex, i, e)}
              onPointerUp={handlePointerUp}
            />
          );
        }),
      )}
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
