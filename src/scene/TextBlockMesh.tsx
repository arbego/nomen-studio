import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { TextBlock, Offset2D } from '../geometry/types';
import {
  combinedBlockBounds,
  cumulativeGaps,
  normalizedLetterGaps,
  clampDesiredLetterPosition,
  gapForDesiredPosition,
  letterPositionsMm,
} from '../geometry/letterLayout';
import { localDragPoint } from './dragUtils';
import { useTapGesture } from './tapGesture';
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

interface TextBlockMeshProps {
  block: TextBlock;
  color: string;
  /** Where this block sits in its parent's space (mm). Z matters for products that stack blocks front-to-back, like the name display's inlay. */
  position: [number, number, number];
  /**
   * How far in front of the block's own origin the letters sit (mm), leaving
   * anything attached to them where it was — the cake topper seats its lettering
   * on the front face of its backing card, while the sticks that hold it stay
   * sunk into the card itself.
   */
  letterZMm?: number;
  /**
   * Sticks attached to this block, if the product has any. The cake topper
   * does; the name display stands on a base rail instead and omits all four
   * stick props.
   */
  stick?: StickParams;
  stickColor?: string;
  stickOffsets?: Offset2D[];
  onStickOffsetCommit?: (index: number, offset: Offset2D) => void;
  letterGapsMm: number[][];
  onLetterGapCommit: (lineIndex: number, gapIndex: number, gapMm: number) => void;
  lineOffsets: Offset2D[];
  onLineOffsetCommit: (lineIndex: number, offset: Offset2D) => void;
  /**
   * What dragging a letter means.
   *
   * 'letters' (the default) is the editing gesture: the first letter moves the
   * line, any other one closes or opens the gap before it. 'whole' makes every
   * letter move the whole thing, for a block whose spacing isn't the user's to
   * tune — an ornament on the name display, which is placed rather than set.
   * Without it, grabbing the second letter of such a block would drag it live
   * and then spring back, there being no gap for the parent to store.
   */
  dragMode?: 'letters' | 'whole';
  /**
   * Notified whenever a letter-gap or line drag starts/stops (not a stick
   * drag, which doesn't move any letter). The outline card can't cheaply
   * track a live drag (it's a synchronous but non-trivial re-triangulation,
   * not just repositioning a mesh), so the parent hides it for the duration
   * instead of letting it visibly lag behind the letters being dragged.
   */
  onLetterDragActiveChange?: (active: boolean) => void;
  /**
   * A letter was clicked rather than dragged. Products answer by revealing the
   * control that edits this block — clicking a thing in the preview is the most
   * direct way of asking "what changes this?", and a panel long enough to
   * scroll is one where that question is worth answering.
   */
  onLetterTap?: (lineIndex: number, letterIndex: number) => void;
  /** A stick was clicked rather than dragged, by index within `stickOffsets`. */
  onStickTap?: (index: number) => void;
}

interface DraggingGap {
  lineIndex: number;
  /** Index into that line's own letterGapsMm — the gap immediately before the letter being dragged. */
  gapIndex: number;
  gapMm: number;
}

interface DraggingLine {
  lineIndex: number;
  offset: Offset2D;
}

/**
 * One block: every line's letters (each a separate, individually draggable
 * mesh — see LetterMesh) plus any sticks the product attached to it. Dragging any letter but a line's
 * first closes/opens the gap before it and cascades to every letter after it
 * within that same line; dragging a line's first letter instead repositions
 * the whole line. Both kinds of drag state live here (not in LetterMesh)
 * because a single drag can affect several other letters/meshes at once, so
 * they all need to see the same live value.
 */
export function TextBlockMesh({
  block,
  color,
  position,
  letterZMm = 0,
  stick,
  stickColor,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  lineOffsets,
  onLineOffsetCommit,
  onLetterDragActiveChange,
  onLetterTap,
  onStickTap,
  dragMode = 'letters',
}: TextBlockMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const controls = useThree((s) => s.controls) as ToggleableControls | null;
  // One for the whole block: only one letter can be held at a time, and a press
  // on another ends any press already in hand.
  const tap = useTapGesture();
  const [draggingGap, setDraggingGap] = useState<DraggingGap | null>(null);
  const [draggingLine, setDraggingLine] = useState<DraggingLine | null>(null);
  // Which stick (if any) is currently dragging — a stick otherwise owns its
  // drag state entirely on its own, but its siblings need to know *something*
  // is being dragged too (see anyDragActive below).
  const [draggingStickIndex, setDraggingStickIndex] = useState<number | null>(null);
  // React Three Fiber's pointer capture only guarantees drag events keep
  // reaching whatever grabbed the pointer — it still raycasts and fires
  // onPointerOver/onPointerOut on anything else the cursor passes over
  // mid-drag. Threaded down to every letter and stick so hovering during
  // someone else's drag doesn't light them up as if they were also grabbable.
  const letterDragActive = draggingGap !== null || draggingLine !== null;
  const anyDragActive = letterDragActive || draggingStickIndex !== null;

  useEffect(() => {
    onLetterDragActiveChange?.(letterDragActive);
  }, [letterDragActive, onLetterDragActiveChange]);
  // The delta between where the pointer first landed and the thing being
  // dragged's position at that moment (a gap-drag's letter, or a line-drag's
  // offset) — captured once on pointer down and held constant for the rest of
  // the drag. Without it, the dragged thing would snap to align exactly with
  // wherever on it you happened to click, instead of keeping the relationship
  // it had to the cursor at grab time.
  const grabDeltaRef = useRef<Offset2D>({ x: 0, y: 0 });

  const naturalXsMmByLine = useMemo(() => block.lines.map((line) => line.letters.map((letter) => letter.naturalXMm)), [block.lines]);
  const gapsByLine = useMemo(
    () => block.lines.map((line, i) => normalizedLetterGaps(line.letters.length, letterGapsMm[i] ?? [])),
    [block.lines, letterGapsMm],
  );
  const effectiveGapsByLine = draggingGap
    ? gapsByLine.map((gaps, i) => (i === draggingGap.lineIndex ? gaps.map((gap, gi) => (gi === draggingGap.gapIndex ? draggingGap.gapMm : gap)) : gaps))
    : gapsByLine;
  const effectiveLineOffsets = draggingLine
    ? lineOffsets.map((offset, i) => (i === draggingLine.lineIndex ? draggingLine.offset : offset))
    : lineOffsets;
  const cascadesByLine = useMemo(() => effectiveGapsByLine.map((gaps) => cumulativeGaps(gaps)), [effectiveGapsByLine]);
  const bounds = useMemo(
    () => combinedBlockBounds(block, effectiveGapsByLine, effectiveLineOffsets),
    [block, effectiveGapsByLine, effectiveLineOffsets],
  );

  function updateGapDrag(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>, isInitial: boolean) {
    const reference = groupRef.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (!point) return;
    const offset = lineOffsets[lineIndex] ?? { x: 0, y: 0 };
    const naturalXsMm = naturalXsMmByLine[lineIndex];
    const gaps = gapsByLine[lineIndex];
    // point.x is in the block group's space, which already includes this
    // line's own (committed) offset, so it's subtracted back out before
    // solving in the line's own natural-position frame.
    const pointInLineFrame = point.x - offset.x;
    if (isInitial) {
      // Grab delta = where the cursor landed minus the letter's own current
      // (committed) position, so the very first drag frame reproduces that
      // same current position exactly instead of snapping the letter to
      // wherever on it was clicked.
      const currentX = letterPositionsMm(naturalXsMm, gaps)[letterIndex];
      grabDeltaRef.current = { x: pointInLineFrame - currentX, y: 0 };
    }
    // Solved fresh from the last *committed* gaps every frame (not from the
    // previous drag frame's live value) — avoids compounding rounding error
    // over a long drag.
    const desired = clampDesiredLetterPosition(letterIndex, pointInLineFrame - grabDeltaRef.current.x, naturalXsMm, gaps);
    const gapMm = gapForDesiredPosition(letterIndex, desired, naturalXsMm, gaps);
    setDraggingGap({ lineIndex, gapIndex: letterIndex - 1, gapMm });
  }

  function updateLineDrag(lineIndex: number, event: ThreeEvent<PointerEvent>, isInitial: boolean) {
    const reference = groupRef.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (!point) return;
    if (isInitial) {
      const current = lineOffsets[lineIndex] ?? { x: 0, y: 0 };
      grabDeltaRef.current = { x: point.x - current.x, y: point.y - current.y };
    }
    setDraggingLine({ lineIndex, offset: { x: point.x - grabDeltaRef.current.x, y: point.y - grabDeltaRef.current.y } });
  }

  /** Whether grabbing this letter moves the whole line rather than retuning its own gap. */
  function movesWholeLine(letterIndex: number): boolean {
    return dragMode === 'whole' || letterIndex === 0;
  }

  function handlePointerDown(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    tap.press(event);
    (event.target as Element).setPointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- controls is a live Three.js object from useThree, not React state
    if (controls) controls.enabled = false;
    if (movesWholeLine(letterIndex)) {
      updateLineDrag(lineIndex, event, true);
    } else {
      updateGapDrag(lineIndex, letterIndex, event, true);
    }
  }

  function handlePointerMove(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    if (movesWholeLine(letterIndex)) {
      if (!draggingLine || draggingLine.lineIndex !== lineIndex) return;
      event.stopPropagation();
      updateLineDrag(lineIndex, event, false);
    } else {
      if (!draggingGap || draggingGap.lineIndex !== lineIndex) return;
      event.stopPropagation();
      updateGapDrag(lineIndex, letterIndex, event, false);
    }
  }

  function handlePointerUp(lineIndex: number, letterIndex: number, event: ThreeEvent<PointerEvent>) {
    // Before the guard below: a click is a click whether or not a drag ever got
    // as far as registering, and `release` is false unless the press landed on
    // this block in the first place.
    if (tap.release(event)) onLetterTap?.(lineIndex, letterIndex);
    if (!draggingGap && !draggingLine) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- see handlePointerDown
    if (controls) controls.enabled = true;
    // Both commits run for a tap too, writing back the position the press
    // started from: the grab delta makes the first drag frame reproduce it
    // exactly, so a click can't nudge what it was only asking about.
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
    <group ref={groupRef} position={position}>
      {block.lines.map((line, lineIndex) =>
        line.letters.map((letter, i) => {
          const offset = effectiveLineOffsets[lineIndex] ?? { x: 0, y: 0 };
          return (
            <LetterMesh
              key={`${lineIndex}-${i}`}
              letter={letter}
              color={color}
              xMm={cascadesByLine[lineIndex][i] + offset.x}
              yMm={offset.y}
              zMm={letterZMm}
              draggable
              dragging={movesWholeLine(i) ? draggingLine?.lineIndex === lineIndex : draggingGap?.lineIndex === lineIndex && draggingGap?.gapIndex === i - 1}
              anyDragActive={anyDragActive}
              onPointerDown={(e) => handlePointerDown(lineIndex, i, e)}
              onPointerMove={(e) => handlePointerMove(lineIndex, i, e)}
              onPointerUp={(e) => handlePointerUp(lineIndex, i, e)}
            />
          );
        }),
      )}
      {stick &&
        stickOffsets?.map((offset, index) => (
          <StickMesh
            key={index}
            bounds={bounds}
            color={stickColor ?? color}
            stick={stick}
            offset={offset}
            referenceObject={groupRef}
            onOffsetCommit={(newOffset) => onStickOffsetCommit?.(index, newOffset)}
            anyDragActive={anyDragActive}
            onDraggingChange={(dragging) => setDraggingStickIndex(dragging ? index : null)}
            onTap={onStickTap && (() => onStickTap(index))}
          />
        ))}
    </group>
  );
}
