import { useRef } from 'react';
import * as THREE from 'three';
import type { StickOffset } from '../geometry/types';
import { StickMesh } from './StickMesh';

export interface StickParams {
  lengthMm: number;
  widthMm: number;
  embedMm: number;
  thicknessMm: number;
}

interface PickMeshProps {
  mainGeometry: THREE.BufferGeometry;
  color: string;
  positionX: number;
  stick: StickParams;
  offsets: StickOffset[];
  onOffsetCommit: (index: number, offset: StickOffset) => void;
}

export function PickMesh({ mainGeometry, color, positionX, stick, offsets, onOffsetCommit }: PickMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[positionX, 0, 0]}>
      <mesh geometry={mainGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </mesh>
      {offsets.map((offset, index) => (
        <StickMesh
          key={index}
          mainGeometry={mainGeometry}
          color={color}
          stick={stick}
          offset={offset}
          referenceObject={groupRef}
          onOffsetCommit={(newOffset) => onOffsetCommit(index, newOffset)}
        />
      ))}
    </group>
  );
}
