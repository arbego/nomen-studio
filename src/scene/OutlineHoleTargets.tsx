import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { OutlineHoleCandidate } from '../geometry/outline';
import { useTapGesture } from './tapGesture';
import { ACCENT } from '../ui/accent';

/**
 * How strongly one patch is drawn.
 *
 * Nothing at all for the hole being pointed at in the preview, since the card
 * behind it is already showing what would happen; strongest for one the panel
 * is pointing at, which has to be findable among a dozen others; and a plain
 * marker for the rest.
 */
function markerOpacity(key: string, hoveredKey: string | null, highlightedKey: string | null): number {
  if (key === hoveredKey) return 0;
  if (key === highlightedKey) return 0.85;
  return 0.45;
}

/** Guarded because this runs fine in the browser, but not under the headless scene tests, which have no `document`. */
function setCursor(cursor: string) {
  if (typeof document !== 'undefined') {
    document.body.style.cursor = cursor;
  }
}

/** How far in front of the card's face the markers sit, in millimeters. Enough to not fight it for depth over a hole that is currently filled in. */
const MARKER_LIFT_MM = 0.08;

interface OutlineHoleTargetsProps {
  candidates: OutlineHoleCandidate[];
  /** The card's own x placement, which these have to share to land on it. */
  positionX: number;
  /** The card's front face, in millimeters from the back of the design. */
  cardDepthMm: number;
  /** The one being pointed at in the preview, which is shown as it would be rather than marked. */
  hoveredKey: string | null;
  /** The one the panel is pointing at, marked more strongly so it can be picked out of a crowd. */
  highlightedKey: string | null;
  /**
   * Whether these can be clicked.
   *
   * False when they are only up to answer "which hole is this row?" — the
   * modifier is not held, so a click there still belongs to whatever is behind
   * them.
   */
  interactive: boolean;
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
export function OutlineHoleTargets({ candidates, positionX, cardDepthMm, hoveredKey, highlightedKey, interactive, onHoverChange, onToggle }: OutlineHoleTargetsProps) {
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
          onPointerDown={
            interactive
              ? (event) => {
                  event.stopPropagation();
                  tap.press(event);
                }
              : undefined
          }
          onPointerUp={
            interactive
              ? (event) => {
                  event.stopPropagation();
                  handleUp(candidate.key, event);
                }
              : undefined
          }
          onPointerOver={
            interactive
              ? (event) => {
                  event.stopPropagation();
                  onHoverChange(candidate.key);
                  setCursor('pointer');
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? (event) => {
                  event.stopPropagation();
                  onHoverChange(null);
                  setCursor('auto');
                }
              : undefined
          }
        >
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={markerOpacity(candidate.key, hoveredKey, highlightedKey)}
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
