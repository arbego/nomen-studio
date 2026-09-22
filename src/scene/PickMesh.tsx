import * as THREE from 'three';

interface PickMeshProps {
  geometry: THREE.BufferGeometry;
  color: string;
  positionX: number;
}

export function PickMesh({ geometry, color, positionX }: PickMeshProps) {
  return (
    <mesh geometry={geometry} position={[positionX, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}
