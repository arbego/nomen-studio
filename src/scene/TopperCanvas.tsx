import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Pick, PickId, StickOffset } from '../geometry/types';
import type { StickParams } from './PickMesh';
import { Scene } from './Scene';
import { fitCameraToBoxFrontal } from './cameraFit';

interface TopperCanvasProps {
  picks: Pick[];
  color: string;
  stick: StickParams;
  stickColor: string;
  stickOffsets: Record<PickId, StickOffset[]>;
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void;
  letterGapsMm: number[][];
  onLetterGapCommit: (pickId: PickId, lineIndex: number, gapIndex: number, gapMm: number) => void;
  lineOffsets: StickOffset[];
  onLineOffsetCommit: (pickId: PickId, lineIndex: number, offset: StickOffset) => void;
  outlineEnabled: boolean;
  outlineGrowMm: number;
  outlineColor: string;
  outlineDepthMm: number;
  closedOutlineHoles: string[];
}

// Fallback camera pose, only ever used before any geometry has loaded (so
// there's nothing yet to fit the view to).
const HOME_CAMERA_POSITION: [number, number, number] = [0, 60, 220];
const HOME_TARGET: [number, number, number] = [0, 0, 0];

export function TopperCanvas({
  picks,
  color,
  stick,
  stickColor,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  lineOffsets,
  onLineOffsetCommit,
  outlineEnabled,
  outlineGrowMm,
  outlineColor,
  outlineDepthMm,
  closedOutlineHoles,
}: TopperCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sceneGroupRef = useRef<THREE.Group>(null);
  const didInitialFitRef = useRef(false);

  // A true frontal view (camera level with the model, looking straight along
  // Z — not tilted down at it) at whatever distance fits the model's current
  // bounding box entirely on screen, recomputed from the live geometry rather
  // than a fixed position, so it still frames correctly after the design's
  // size, line count, or stick count changes.
  function resetToFrontView() {
    const controls = controlsRef.current;
    const group = sceneGroupRef.current;
    if (!controls) return;
    const camera = controls.object as THREE.PerspectiveCamera;
    const box = group ? new THREE.Box3().setFromObject(group) : null;
    if (!box || box.isEmpty()) {
      camera.position.set(...HOME_CAMERA_POSITION);
      controls.target.set(...HOME_TARGET);
      controls.update();
      return;
    }
    const { position, target } = fitCameraToBoxFrontal(box, camera.fov, camera.aspect);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  }

  // Fits the view once the very first geometry has loaded, so the initial
  // load looks the same as pressing the reset button — not just the button.
  useEffect(() => {
    if (didInitialFitRef.current || picks.length === 0) return;
    didInitialFitRef.current = true;
    resetToFrontView();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetToFrontView intentionally reads live refs, not reactive props
  }, [picks]);

  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [0, 60, 220], fov: 35, near: 1, far: 2000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#f3f1ec']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 140, 120]} intensity={1.1} castShadow />
        <directionalLight position={[-100, 60, -80]} intensity={0.35} />

        <group ref={sceneGroupRef}>
          <Center bottom>
            <Scene
              picks={picks}
              color={color}
              stick={stick}
              stickColor={stickColor}
              stickOffsets={stickOffsets}
              onStickOffsetCommit={onStickOffsetCommit}
              letterGapsMm={letterGapsMm}
              onLetterGapCommit={onLetterGapCommit}
              lineOffsets={lineOffsets}
              onLineOffsetCommit={onLineOffsetCommit}
              outlineEnabled={outlineEnabled}
              outlineGrowMm={outlineGrowMm}
              outlineColor={outlineColor}
              outlineDepthMm={outlineDepthMm}
              closedOutlineHoles={closedOutlineHoles}
            />
          </Center>
        </group>
        <ContactShadows position={[0, -0.1, 0]} opacity={0.35} scale={300} blur={2} far={80} />

        {/* maxDistance generous enough that fitting the largest possible design (multiple lines, max size, longest sticks) to the frontal view is never clamped closer than it needs to be. */}
        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} minDistance={60} maxDistance={1000} makeDefault />
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
