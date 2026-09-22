import { useMemo } from 'react';
import * as THREE from 'three';
import type { Pick } from '../geometry/types';
import { PickMesh } from './PickMesh';

const PICK_GAP_MM = 12;

interface SceneProps {
  picks: Pick[];
  color: string;
}

export function Scene({ picks, color }: SceneProps) {
  const layout = useMemo(() => {
    let cursor = 0;
    const positions: number[] = [];
    for (const pick of picks) {
      pick.geometry.computeBoundingBox();
      const bb = pick.geometry.boundingBox as THREE.Box3;
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
        <PickMesh key={pick.id} geometry={pick.geometry} color={color} positionX={layout[i] ?? 0} />
      ))}
    </group>
  );
}
