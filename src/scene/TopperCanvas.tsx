import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Center } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import type { StickParams } from './PickMesh';
import { Scene } from './Scene';

interface TopperCanvasProps {
  picks: Pick[];
  color: string;
  stick: StickParams;
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

// The straight-on front view — matches the initial camera so "home" returns to
// the same view the scene loads with.
const HOME_CAMERA_POSITION: [number, number, number] = [0, 60, 220];
const HOME_TARGET: [number, number, number] = [0, 0, 0];

export function TopperCanvas({
  picks,
  color,
  stick,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  outlineEnabled,
  outlineGrowMm,
  outlineColor,
  outlineDepthMm,
  closedOutlineHoles,
}: TopperCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  function resetToFrontView() {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...HOME_CAMERA_POSITION);
    controls.target.set(...HOME_TARGET);
    controls.update();
  }

  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [0, 60, 220], fov: 35, near: 1, far: 2000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#f3f1ec']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 140, 120]} intensity={1.1} castShadow />
        <directionalLight position={[-100, 60, -80]} intensity={0.35} />

        <Center bottom>
          <Scene
            picks={picks}
            color={color}
            stick={stick}
            stickOffsets={stickOffsets}
            onStickOffsetCommit={onStickOffsetCommit}
            letterGapsMm={letterGapsMm}
            onLetterGapCommit={onLetterGapCommit}
            outlineEnabled={outlineEnabled}
            outlineGrowMm={outlineGrowMm}
            outlineColor={outlineColor}
            outlineDepthMm={outlineDepthMm}
            closedOutlineHoles={closedOutlineHoles}
          />
        </Center>
        <ContactShadows position={[0, -0.1, 0]} opacity={0.35} scale={300} blur={2} far={80} />

        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} minDistance={60} maxDistance={500} makeDefault />
      </Canvas>

      <button
        type="button"
        onClick={resetToFrontView}
        aria-label="Reset view to front"
        title="Reset view to front"
        className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-600 shadow-md backdrop-blur transition-colors hover:border-stone-400 hover:text-stone-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        </svg>
      </button>
    </div>
  );
}
