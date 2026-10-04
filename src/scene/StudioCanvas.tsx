import { useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { fitCameraToBoxFrontal } from './cameraFit';
import { GroundCenter } from './GroundCenter';
import { GroundGrid } from './GroundGrid';
import { ScaleReference } from './ScaleReference';

interface StudioCanvasProps {
  /** The current product's scene content — see products/<id>/SceneContent.tsx. */
  children: ReactNode;
}

// Fallback camera pose, only ever used before any geometry has loaded (so
// there's nothing yet to fit the view to).
const HOME_CAMERA_POSITION: [number, number, number] = [0, 60, 220];
const HOME_TARGET: [number, number, number] = [0, 0, 0];

const OVERLAY_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 shadow-md backdrop-blur transition-colors hover:border-stone-400 hover:text-stone-900';

/**
 * The shared 3D preview every product is designed in: lighting, ground shadow,
 * orbit controls, and a reset-to-front button that re-fits the camera to
 * whatever is currently on screen. Product-agnostic — it only renders whatever
 * scene content it's given, centered on the ground plane.
 */
export function StudioCanvas({ children }: StudioCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sceneGroupRef = useRef<THREE.Group>(null);
  const contentGroupRef = useRef<THREE.Group>(null);
  const [showScaleReference, setShowScaleReference] = useState(false);

  // A true frontal view (camera level with the model, looking straight along
  // Z — not tilted down at it) at whatever distance fits the model's current
  // bounding box entirely on screen, recomputed from the live geometry rather
  // than a fixed position, so it still frames correctly after the design's
  // size, line count, or part count changes.
  /**
   * Frames whatever is currently on screen. Returns false, having touched
   * nothing, when there is nothing to frame — so waiting on async geometry
   * never costs the user control of the camera.
   */
  function fitToContent(): boolean {
    const controls = controlsRef.current;
    const group = sceneGroupRef.current;
    if (!controls || !group) return false;
    const box = new THREE.Box3().setFromObject(group, true);
    if (box.isEmpty()) return false;
    const camera = controls.object as THREE.PerspectiveCamera;
    const { position, target } = fitCameraToBoxFrontal(box, camera.fov, camera.aspect);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    return true;
  }

  /** The reset button: frame the design, or fall back to the home pose when there's nothing to frame. */
  function resetToFrontView(): void {
    if (fitToContent()) return;
    const controls = controlsRef.current;
    if (!controls) return;
    (controls.object as THREE.PerspectiveCamera).position.set(...HOME_CAMERA_POSITION);
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

        {/* The camera is framed the moment the design is first centered, so the
            initial load looks exactly like pressing the reset button. */}
        <group ref={sceneGroupRef}>
          {/* The design alone. The coin measures this rather than the group
              above it, which also holds the coin — measuring that would push
              the coin further right every frame. */}
          <group ref={contentGroupRef}>
            <GroundCenter onFirstCenter={fitToContent}>{children}</GroundCenter>
          </group>
          {showScaleReference && <ScaleReference contentRef={contentGroupRef} onFirstPlaced={fitToContent} />}
        </group>
        <ContactShadows position={[0, -0.1, 0]} opacity={0.35} scale={300} blur={2} far={80} />
        <GroundGrid />

        {/* maxDistance generous enough that fitting the largest possible design (multiple lines, max size, longest sticks) to the frontal view is never clamped closer than it needs to be. */}
        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} minDistance={60} maxDistance={1000} makeDefault />
      </Canvas>

      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowScaleReference((shown) => !shown)}
          aria-pressed={showScaleReference}
          aria-label={showScaleReference ? 'Hide the 2 euro coin' : 'Show a 2 euro coin for scale'}
          title={showScaleReference ? 'Hide the 2 € coin' : 'Compare with a 2 € coin'}
          className={`${OVERLAY_BUTTON_CLASS} ${showScaleReference ? 'border-stone-400 text-stone-900' : 'border-stone-200 text-stone-600'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={resetToFrontView}
          aria-label="Reset view to front"
          title="Reset view to front"
          className={`${OVERLAY_BUTTON_CLASS} border-stone-200 text-stone-600`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
