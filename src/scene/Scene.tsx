import { useMemo } from 'react';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import { combinedLetterBounds } from '../geometry/letterLayout';
import type { StickParams } from './PickMesh';
import { PickMesh } from './PickMesh';

const PICK_GAP_MM = 12;

interface SceneProps {
  picks: Pick[];
  color: string;
  stick: StickParams;
  stickOffsets: Record<PickId, StickOffset[]>;
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void;
  letterGapsMm: number[];
  onLetterGapCommit: (pickId: PickId, index: number, gapMm: number) => void;
}

export function Scene({ picks, color, stick, stickOffsets, onStickOffsetCommit, letterGapsMm, onLetterGapCommit }: SceneProps) {
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

  return (
    <group>
      {picks.map((pick, i) => (
        <PickMesh
          key={pick.id}
          pick={pick}
          color={color}
          positionX={layout[i] ?? 0}
          stick={stick}
          stickOffsets={stickOffsets[pick.id]}
          onStickOffsetCommit={(index, offset) => onStickOffsetCommit(pick.id, index, offset)}
          letterGapsMm={letterGapsMm}
          onLetterGapCommit={(index, gapMm) => onLetterGapCommit(pick.id, index, gapMm)}
        />
      ))}
    </group>
  );
}
