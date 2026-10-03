import type * as THREE from 'three';

interface StandMeshProps {
  geometry: THREE.BufferGeometry;
  color: string;
}

/**
 * A base rail under a block (see geometry/baseGeometry.ts). Purely derived
 * scenery with no interaction of its own — its size and position follow the
 * block it stands under, so there is nothing here to grab.
 */
export function StandMesh({ geometry, color }: StandMeshProps) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}
