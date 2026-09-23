import { useMemo } from 'react';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import { combinedLetterBounds } from '../geometry/letterLayout';
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
  letterGapsMm: number[];
  onLetterGapCommit: (pickId: PickId, index: number, gapMm: number) => void;
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
      const bb = combinedLetterBounds(pick.letters, letterGapsMm);
      const width = bb.max.x - bb.min.x;
      positions.push(cursor - bb.min.x);
      cursor += width + PICK_GAP_MM;
    }
    const totalWidth = cursor - PICK_GAP_MM;
    const centerOffset = totalWidth / 2;
    return positions.map((p) => p - centerOffset);
  }, [picks, letterGapsMm]);

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
          onLetterGapCommit={(index, gapMm) => onLetterGapCommit(pick.id, index, gapMm)}
        />
      ))}
      {outlineEnabled && wordPick && (
        // Shares the word's own positionX (not laid out side-by-side like a
        // separate pick would be) so it visually surrounds the word instead
        // of sitting next to it.
        <OutlineMesh
          pick={wordPick}
          positionX={layout[wordIndex] ?? 0}
          letterGapsMm={letterGapsMm}
          growMm={outlineGrowMm}
          depthMm={outlineDepthMm}
          color={outlineColor}
          closedOutlineHoles={closedOutlineHoles}
        />
      )}
    </group>
  );
}
