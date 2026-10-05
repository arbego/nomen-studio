import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { OutlineHoleCandidate } from '../geometry/outline';
import { useTapGesture } from './tapGesture';

/** Guarded because this runs fine in the browser, but not under the headless scene tests, which have no `document`. */
function setCursor(cursor: string) {
  if (typeof document !== 'undefined') {
    document.body.style.cursor = cursor;
  }
}

/** The studio's accent, as the export button and the panel's flash use it — the colour that means "this is the thing". */
const MARKER_COLOR = '#fdba74';

/** How far in front of the card's face the markers sit, in millimeters. Enough to not fight it for depth over a hole that is currently filled in. */
const MARKER_LIFT_MM = 0.08;

interface OutlineHoleTargetsProps {
  candidates: OutlineHoleCandidate[];
  /** The card's own x placement, which these have to share to land on it. */
  positionX: number;
  /** The card's front face, in millimeters from the back of the design. */
  cardDepthMm: number;
  /** The one being pointed at, which is shown as it would be rather than marked. */
  hoveredKey: string | null;
  onHoverChange: (key: string | null) => void;
  onToggle: (key: string) => void;
}

/**
 * A patch over every counter hole in the backing card, for filling one in or
 * opening it again by pointing at it.
 *
 * Only mounted while the modifier is held (see the cake topper's scene), which
 * is what keeps the preview uncluttered and these out of the way of dragging a
 * letter — the same click would otherwise mean two things.
 *
 * The patch over the hole being pointed at goes invisible rather than
 * disappearing: the card behind it is rebuilt with that hole toggled, so what
 * you are looking at is the actual result rather than a drawing of it, and the
 * patch has to stay in the scene to know when the pointer leaves it.
 */
export function OutlineHoleTargets({ candidates, positionX, cardDepthMm, hoveredKey, onHoverChange, onToggle }: OutlineHoleTargetsProps) {
  const tap = useTapGesture();
  const geometries = useMemo(() => candidates.map((candidate) => new THREE.ShapeGeometry(new THREE.Shape(candidate.points))), [candidates]);
  // React Three Fiber never disposes a geometry handed to it through the
  // `geometry` prop, and these are rebuilt every time the modifier is pressed.
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);
  useEffect(() => () => setCursor('auto'), []);

  function handleUp(key: string, event: ThreeEvent<PointerEvent>) {
    // A tap, not a drag: a press that turned into an orbit of the camera is not
    // someone asking for this hole to change.
    if (tap.release(event)) onToggle(key);
  }

  return (
    <group position={[positionX, 0, cardDepthMm + MARKER_LIFT_MM]}>
      {candidates.map((candidate, index) => (
        <mesh
          key={candidate.key}
          geometry={geometries[index]}
          onPointerDown={(event) => {
            event.stopPropagation();
            tap.press(event);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            handleUp(candidate.key, event);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange(candidate.key);
            setCursor('pointer');
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onHoverChange(null);
            setCursor('auto');
          }}
        >
          <meshBasicMaterial
            color={MARKER_COLOR}
            transparent
            opacity={candidate.key === hoveredKey ? 0 : 0.45}
            // Flat on top of whatever is behind it, and never writing depth, so
            // a marker can't hide the card it is marking.
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
