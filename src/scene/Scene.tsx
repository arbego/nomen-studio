import { useMemo } from 'react';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import { combinedPickBounds } from '../geometry/letterLayout';
import type { StickParams } from './PickMesh';
import { PickMesh } from './PickMesh';
import { OutlineMesh } from './OutlineMesh';

const PICK_GAP_MM = 12;

interface SceneProps {
  picks: Pick[];
  color: string;
  stick: StickParams;
  stickColor: string;
  stickOffsets: Record<PickId, StickOffset[]>;
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void;
  letterGapsMm: number[][];
  onLetterGapCommit: (pickId: PickId, lineIndex: number, gapIndex: number, gapMm: number) => void;
  lineOffsets: StickOffset[];
  onLineOffsetCommit: (pickId: PickId, lineIndex: number, offset: StickOffset) => void;
  outlineEnabled: boolean;
  outlineGrowMm: number;
  outlineColor: string;
  outlineDepthMm: number;
  closedOutlineHoles: string[];
}

export function Scene({
  picks,
  color,
  stick,
  stickColor,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  lineOffsets,
  onLineOffsetCommit,
  outlineEnabled,
  outlineGrowMm,
  outlineColor,
  outlineDepthMm,
  closedOutlineHoles,
}: SceneProps) {
  const layout = useMemo(() => {
    let cursor = 0;
    const positions: number[] = [];
    for (const pick of picks) {
      const bb = combinedPickBounds(pick, letterGapsMm, lineOffsets);
      const width = bb.max.x - bb.min.x;
      positions.push(cursor - bb.min.x);
      cursor += width + PICK_GAP_MM;
    }
    const totalWidth = cursor - PICK_GAP_MM;
    const centerOffset = totalWidth / 2;
    return positions.map((p) => p - centerOffset);
  }, [picks, letterGapsMm, lineOffsets]);

  const wordIndex = picks.findIndex((p) => p.id === 'word');
  const wordPick = picks[wordIndex];

  return (
    <group>
      {picks.map((pick, i) => (
        <PickMesh
          key={pick.id}
          pick={pick}
          color={color}
          positionX={layout[i] ?? 0}
          stick={stick}
          stickColor={stickColor}
          stickOffsets={stickOffsets[pick.id]}
          onStickOffsetCommit={(index, offset) => onStickOffsetCommit(pick.id, index, offset)}
          letterGapsMm={letterGapsMm}
          onLetterGapCommit={(lineIndex, gapIndex, gapMm) => onLetterGapCommit(pick.id, lineIndex, gapIndex, gapMm)}
          lineOffsets={lineOffsets}
          onLineOffsetCommit={(lineIndex, offset) => onLineOffsetCommit(pick.id, lineIndex, offset)}
        />
      ))}
      {outlineEnabled && wordPick && (
        // Shares the word's own positionX (not laid out side-by-side like a
        // separate pick would be) so it visually surrounds every line instead
        // of sitting next to it.
        <OutlineMesh
          pick={wordPick}
          positionX={layout[wordIndex] ?? 0}
          letterGapsMm={letterGapsMm}
          lineOffsets={lineOffsets}
          growMm={outlineGrowMm}
          depthMm={outlineDepthMm}
          color={outlineColor}
          closedOutlineHoles={closedOutlineHoles}
        />
      )}
    </group>
  );
}
