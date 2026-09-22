import { useCallback, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

interface PickMeshProps {
  geometry: THREE.BufferGeometry;
  color: string;
  positionX: number;
  onPickStickPosition?: (localX: number) => void;
}

export function PickMesh({ geometry, color, positionX, onPickStickPosition }: PickMeshProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!onPickStickPosition) return;
      event.stopPropagation();
      const local = event.object.worldToLocal(event.point.clone());
      onPickStickPosition(local.x);
    },
    [onPickStickPosition],
  );

  return (
    <mesh
      geometry={geometry}
      position={[positionX, 0, 0]}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} emissive={hovered ? color : '#000000'} emissiveIntensity={hovered ? 0.15 : 0} />
    </mesh>
  );
}
