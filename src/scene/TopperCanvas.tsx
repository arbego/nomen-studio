import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Center } from '@react-three/drei';
import type { Pick } from '../geometry/types';
import { Scene } from './Scene';

interface TopperCanvasProps {
  picks: Pick[];
  color: string;
}

export function TopperCanvas({ picks, color }: TopperCanvasProps) {
  return (
    <Canvas shadows camera={{ position: [0, 60, 220], fov: 35, near: 1, far: 2000 }} gl={{ antialias: true }}>
      <color attach="background" args={['#f3f1ec']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 140, 120]} intensity={1.1} castShadow />
      <directionalLight position={[-100, 60, -80]} intensity={0.35} />

      <Center bottom>
        <Scene picks={picks} color={color} />
      </Center>
      <ContactShadows position={[0, -0.1, 0]} opacity={0.35} scale={300} blur={2} far={80} />

      <OrbitControls enableDamping dampingFactor={0.1} minDistance={60} maxDistance={500} makeDefault />
    </Canvas>
  );
}
