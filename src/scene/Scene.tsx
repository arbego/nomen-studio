import { useMemo } from 'react';
import * as THREE from 'three';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import type { StickParams } from './PickMesh';
import { PickMesh } from './PickMesh';

const PICK_GAP_MM = 12;

interface SceneProps {
  picks: Pick[];
  color: string;
  stick: StickParams;
  stickOffsets: Record<PickId, StickOffset[]>;
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void;
}

export function Scene({ picks, color, stick, stickOffsets, onStickOffsetCommit }: SceneProps) {
  const layout = useMemo(() => {
    let cursor = 0;
    const positions: number[] = [];
    for (const pick of picks) {
      pick.mainGeometry.computeBoundingBox();
      const bb = pick.mainGeometry.boundingBox as THREE.Box3;
      const width = bb.max.x - bb.min.x;
      positions.push(cursor - bb.min.x);
      cursor += width + PICK_GAP_MM;
    }
    const totalWidth = cursor - PICK_GAP_MM;
    const centerOffset = totalWidth / 2;
    return positions.map((p) => p - centerOffset);
  }, [picks]);

  return (
    <group>
      {picks.map((pick, i) => (
        <PickMesh
          key={pick.id}
          mainGeometry={pick.mainGeometry}
          color={color}
          positionX={layout[i] ?? 0}
          stick={stick}
          offsets={stickOffsets[pick.id]}
          onOffsetCommit={(index, offset) => onStickOffsetCommit(pick.id, index, offset)}
        />
      ))}
    </group>
  );
}
