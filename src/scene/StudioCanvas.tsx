import { useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { fitCameraToBoxFrontal } from './cameraFit';

interface StudioCanvasProps {
  /** The current product's scene content — see products/<id>/SceneContent.tsx. */
  children: ReactNode;
}

/**
 * Fits the view once, as soon as there is actually something to fit, so the
 * initial load frames the design exactly as pressing the reset button would.
 *
 * Watching the scene's own bounding box rather than taking a "geometry is
 * ready" flag keeps the canvas independent of how (or how asynchronously) each
 * product builds its geometry. The check stops after the first successful fit,
 * so it costs a handful of frames at startup and nothing afterwards.
 */
function FitOnFirstContent({ onFit }: { onFit: () => boolean }) {
  const doneRef = useRef(false);
  useFrame(() => {
    if (doneRef.current) return;
    doneRef.current = onFit();
  });
  return null;
}

// Fallback camera pose, only ever used before any geometry has loaded (so
// there's nothing yet to fit the view to).
const HOME_CAMERA_POSITION: [number, number, number] = [0, 60, 220];
const HOME_TARGET: [number, number, number] = [0, 0, 0];

/**
 * The shared 3D preview every product is designed in: lighting, ground shadow,
 * orbit controls, and a reset-to-front button that re-fits the camera to
 * whatever is currently on screen. Product-agnostic — it only renders whatever
 * scene content it's given, centered on the ground plane.
 */
export function StudioCanvas({ children }: StudioCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sceneGroupRef = useRef<THREE.Group>(null);

  // A true frontal view (camera level with the model, looking straight along
  // Z — not tilted down at it) at whatever distance fits the model's current
  // bounding box entirely on screen, recomputed from the live geometry rather
  // than a fixed position, so it still frames correctly after the design's
  // size, line count, or part count changes.
  /** Returns whether it had real geometry to fit to (false means "nothing on screen yet"). */
  function resetToFrontView(): boolean {
    const controls = controlsRef.current;
    const group = sceneGroupRef.current;
    if (!controls) return false;
    const camera = controls.object as THREE.PerspectiveCamera;
    const box = group ? new THREE.Box3().setFromObject(group) : null;
    if (!box || box.isEmpty()) {
      camera.position.set(...HOME_CAMERA_POSITION);
      controls.target.set(...HOME_TARGET);
      controls.update();
      return false;
    }
    const { position, target } = fitCameraToBoxFrontal(box, camera.fov, camera.aspect);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    return true;
  }

  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [0, 60, 220], fov: 35, near: 1, far: 2000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#f3f1ec']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 140, 120]} intensity={1.1} castShadow />
        <directionalLight position={[-100, 60, -80]} intensity={0.35} />

        <group ref={sceneGroupRef}>
          <Center bottom>{children}</Center>
        </group>
        <FitOnFirstContent onFit={resetToFrontView} />
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
