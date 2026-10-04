import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** A 2 euro coin, to the millimeter: 25.75mm across and 2.20mm thick. */
export const COIN_DIAMETER_MM = 25.75;
export const COIN_THICKNESS_MM = 2.2;

/** The silver core inside the gold ring — approximately, since it only has to read as bimetal. */
const COIN_CORE_DIAMETER_MM = 18.75;

/** Clear air between the design and the coin, so they read as two separate objects. */
const GAP_MM = 10;

/** Nickel brass ring, cupronickel core — the way round a 2 euro coin has it. */
const RING_COLOR = '#c8a84e';
const CORE_COLOR = '#c9c9ce';

interface ScaleReferenceProps {
  /** The group holding the design itself. The coin is placed beside whatever is in it. */
  contentRef: RefObject<THREE.Object3D | null>;
  /** Called once the coin has first been placed beside real content — the moment it is worth framing in view. */
  onFirstPlaced?: () => void;
}

/**
 * A 2 euro coin lying flat on the ground next to the design, at true scale.
 *
 * Millimeters on a slider do not tell you how big a thing will come out of the
 * printer; a coin you have held does. It follows the design's bounds every
 * frame, so it stays beside it as sizes, fonts and letter spacing change.
 */
export function ScaleReference({ contentRef, onFirstPlaced }: ScaleReferenceProps) {
  const group = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const placed = useRef(false);
  const ringRadius = COIN_DIAMETER_MM / 2;
  const coreRadius = COIN_CORE_DIAMETER_MM / 2;

  useFrame(() => {
    const coin = group.current;
    const content = contentRef.current;
    if (!coin || !content) return;

    // Combined mesh boxes rather than `precise` vertices: this runs every
    // frame, and the only cost of overestimating a rotated part's extent is
    // that the coin sits a little further clear of it.
    box.setFromObject(content);
    if (box.isEmpty()) {
      coin.visible = false;
      return;
    }

    coin.visible = true;
    // Beside the design's right edge, centered on its depth so neither one
    // stands in front of the other.
    coin.position.set(box.max.x + GAP_MM + ringRadius, 0, (box.min.z + box.max.z) / 2);

    if (!placed.current) {
      placed.current = true;
      onFirstPlaced?.();
    }
  });

  return (
    // Hidden until measured, so it never flashes at the origin on top of the
    // design. This runs before every render, so the flag is always current.
    <group ref={group} visible={false}>
      <mesh position={[0, COIN_THICKNESS_MM / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[ringRadius, ringRadius, COIN_THICKNESS_MM, 64]} />
        <meshStandardMaterial color={RING_COLOR} roughness={0.35} metalness={0.8} />
      </mesh>
      {/* A hair thicker than the ring purely so the two faces aren't coplanar and don't z-fight. */}
      <mesh position={[0, COIN_THICKNESS_MM / 2, 0]} castShadow>
        <cylinderGeometry args={[coreRadius, coreRadius, COIN_THICKNESS_MM + 0.06, 64]} />
        <meshStandardMaterial color={CORE_COLOR} roughness={0.3} metalness={0.85} />
      </mesh>
    </group>
  );
}
