import { useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { fitCameraToBoxFrontal } from './cameraFit';
import { GroundCenter } from './GroundCenter';
import { GroundGrid } from './GroundGrid';
import { ScaleReference } from './ScaleReference';
import { StudioLights } from './StudioLights';
import { useThemeStore } from '../ui/theme';

interface StudioCanvasProps {
  /** The current product's scene content — see products/<id>/SceneContent.tsx. */
  children: ReactNode;
  /**
   * Pinned over the preview's top-right corner: the product's export button.
   *
   * Here rather than in the sidebar because exporting is what you came to do and
   * it applies to the whole design, so it should be reachable without scrolling
   * past the controls for one part of it.
   */
  actions?: ReactNode;
  /**
   * Pinned above the view buttons in the bottom-right corner: what is wrong with
   * the design as a whole — see the product's own Warnings component.
   *
   * Over the preview because that is what it is about, and because the control
   * that would otherwise carry it may be scrolled out of the panel or collapsed
   * inside it.
   */
  warnings?: ReactNode;
}

// Fallback camera pose, only ever used before any geometry has loaded (so
// there's nothing yet to fit the view to).
const HOME_CAMERA_POSITION: [number, number, number] = [0, 60, 220];
const HOME_TARGET: [number, number, number] = [0, 0, 0];

/** The studio's backdrop, per theme. Only the room changes — see StudioLights for why the light does not. */
const BACKGROUND = { light: '#f3f1ec', dark: '#1b1917' } as const;

/** The ground shadow needs less weight on a dark floor, where it has far less room to darken into before it disappears. */
const SHADOW_OPACITY = { light: 0.35, dark: 0.5 } as const;

const OVERLAY_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 dark:bg-stone-900/90 shadow-md backdrop-blur transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100';

/**
 * The shared 3D preview every product is designed in: lighting, ground shadow,
 * orbit controls, and a reset-to-front button that re-fits the camera to
 * whatever is currently on screen. Product-agnostic — it only renders whatever
 * scene content it's given, centered on the ground plane.
 */
export function StudioCanvas({ children, actions, warnings }: StudioCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sceneGroupRef = useRef<THREE.Group>(null);
  const contentGroupRef = useRef<THREE.Group>(null);
  const [showScaleReference, setShowScaleReference] = useState(false);
  // On by default: a shadow is what tells a 2mm inlay from a colour change.
  // Off is for looking at the shapes themselves, and for a slower machine.
  const [showShadows, setShowShadows] = useState(true);
  const theme = useThemeStore((s) => s.theme);

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
        <color attach="background" args={[BACKGROUND[theme]]} />
        <StudioLights contentRef={contentGroupRef} castShadows={showShadows} />

        {/* The camera is framed the moment the design is first centered, so the
            initial load looks exactly like pressing the reset button. */}
        <group ref={sceneGroupRef}>
          {/* The design alone. The coin measures this rather than the group
              above it, which also holds the coin — measuring that would push
              the coin further right every frame. */}
          <group ref={contentGroupRef}>
            <GroundCenter onFirstCenter={fitToContent}>{children}</GroundCenter>
          </group>
          {showScaleReference && <ScaleReference contentRef={contentGroupRef} />}
        </group>
        {showShadows && <ContactShadows position={[0, -0.1, 0]} opacity={SHADOW_OPACITY[theme]} scale={300} blur={2} far={80} />}
        <GroundGrid theme={theme} />

        {/* maxDistance generous enough that fitting the largest possible design (multiple lines, max size, longest sticks) to the frontal view is never clamped closer than it needs to be. */}
        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} minDistance={60} maxDistance={1000} makeDefault />
      </Canvas>

      {actions && <div className="absolute right-4 top-4">{actions}</div>}

      {/* Just clear of the button row below it, and anchored by its bottom edge so it grows upward rather than over them. */}
      {warnings && <div className="absolute bottom-16 right-4">{warnings}</div>}

      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowShadows((shown) => !shown)}
          aria-pressed={showShadows}
          aria-label={showShadows ? 'Turn shadows off' : 'Turn shadows on'}
          title={showShadows ? 'Shadows on' : 'Shadows off'}
          className={`${OVERLAY_BUTTON_CLASS} ${showShadows ? 'border-stone-400 dark:border-stone-500 text-stone-900 dark:text-stone-100' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'}`}
        >
          {/* A shape and the shadow it throws, which is the thing being switched. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <rect x="3" y="3" width="12" height="12" rx="2.5" />
            <path d="M9 21h9.5a2.5 2.5 0 0 0 2.5-2.5V9" strokeDasharray="2.5 2.5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setShowScaleReference((shown) => !shown)}
          aria-pressed={showScaleReference}
          aria-label={showScaleReference ? 'Hide the 2 euro coin' : 'Show a 2 euro coin for scale'}
          title={showScaleReference ? 'Hide the 2 € coin' : 'Compare with a 2 € coin'}
          className={`${OVERLAY_BUTTON_CLASS} ${showScaleReference ? 'border-stone-400 dark:border-stone-500 text-stone-900 dark:text-stone-100' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'}`}
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
          className={`${OVERLAY_BUTTON_CLASS} border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400`}
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
