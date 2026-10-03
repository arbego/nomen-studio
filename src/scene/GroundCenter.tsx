import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GroundCenterProps {
  children: ReactNode;
  /** Called once, the first time real content has been centered — the moment the camera can usefully be framed to it. */
  onFirstCenter?: () => void;
}

/**
 * Centers its content horizontally and in depth, and sits the bottom of it on
 * y=0 so the ground shadow reads as a floor.
 *
 * This replaces drei's `<Center>`, which cannot be used here: its measuring
 * layout effect deliberately does not depend on `children` (that is what its
 * `cacheKey` prop exists for). Every product builds its geometry
 * asynchronously — fonts are fetched and parsed before anything exists to
 * measure — so `Center` would measure an empty group, and an empty `Box3` has
 * `min = +Infinity, max = -Infinity`, making `height` `-Infinity` and the
 * `bottom` alignment it derives `+Infinity`. The whole design was translated to
 * infinity and, with no re-measure, stayed there: a blank viewport until the
 * studio was closed and reopened. It only showed up sometimes because a warm
 * font cache can win the race and have content ready for that one measurement.
 *
 * Measuring here instead keeps probing until there is genuinely something to
 * measure, then stops.
 */
export function GroundCenter({ children, onFirstCenter }: GroundCenterProps) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const centeredRef = useRef(false);

  const center = useCallback((): boolean => {
    const outerGroup = outer.current;
    const innerGroup = inner.current;
    if (!outerGroup || !innerGroup) return false;

    // Measured in world space, so the box already includes whatever offset is
    // applied right now; what follows is therefore a correction rather than an
    // absolute position. Since the offset is a pure translation, one pass lands
    // it exactly.
    //
    // `precise` walks vertices instead of combining per-mesh bounding boxes. It
    // runs once, and it matters: the name display rotates its name, and a
    // rotated mesh's box-of-boxes is noticeably larger than the geometry, which
    // would leave the design hovering above the ground instead of resting on it.
    box.setFromObject(innerGroup, true);
    if (box.isEmpty()) return false;

    outerGroup.position.x -= (box.min.x + box.max.x) / 2;
    outerGroup.position.y -= box.min.y;
    outerGroup.position.z -= (box.min.z + box.max.z) / 2;
    return true;
  }, [box]);

  useFrame(() => {
    if (centeredRef.current) return;
    if (!center()) return;
    centeredRef.current = true;
    onFirstCenter?.();
  });

  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}
