import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A number that changes when the geometry in a subtree is replaced, added to or
 * removed — and does not change when any of it merely moves, is recolored or
 * re-rendered.
 *
 * Three gives every BufferGeometry an id when it is constructed, so a build that
 * produces new geometry produces new ids; a drag reuses the same ones. Order
 * matters, which also catches a part appearing or disappearing.
 */
function builtSignature(root: THREE.Object3D): number {
  let signature = 0;
  root.traverse((node) => {
    const geometry = (node as Partial<THREE.Mesh>).geometry;
    if (geometry) {
      signature = (Math.imul(signature, 31) + geometry.id) | 0;
    }
  });
  return signature;
}

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
 * measure, then stops — and starts again whenever the design is rebuilt, since
 * a design that has just grown a base rail is no longer standing on the floor.
 */
export function GroundCenter({ children, onFirstCenter }: GroundCenterProps) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const box = useMemo(() => new THREE.Box3(), []);
  const centeredRef = useRef(false);
  // null until the first real build, so a signature that happens to come out 0 can't be mistaken for one.
  const builtRef = useRef<number | null>(null);
  // Off exactly while something is being dragged; see the note in useFrame below.
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null;

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
    // runs only when the design is rebuilt, and it matters: the name display
    // rotates its name, and a rotated mesh's box-of-boxes is noticeably larger
    // than the geometry, which would leave the design hovering above the ground
    // instead of resting on it.
    //
    // The matrices are brought up to date first. Box3 refreshes neither the
    // ancestors of what it measures nor, with `precise`, anything else — so left
    // to itself it would measure against whatever the last rendered frame left
    // behind, which is one correction out of date the moment this applies one.
    outerGroup.updateWorldMatrix(true, true);
    box.setFromObject(innerGroup, true);
    if (box.isEmpty()) return false;

    outerGroup.position.x -= (box.min.x + box.max.x) / 2;
    outerGroup.position.y -= box.min.y;
    outerGroup.position.z -= (box.min.z + box.max.z) / 2;
    return true;
  }, [box]);

  useFrame(() => {
    const innerGroup = inner.current;
    if (!innerGroup) return;

    // Re-grounded when the design is *rebuilt*, not when it merely moves.
    //
    // Rebuilt is the right trigger: adding a base rail, trimming a flat bottom,
    // changing a height — all of them hand the scene new geometry, and all of
    // them can leave the piece hanging off the floor or sunk into it.
    //
    // Moving is the wrong one, and dangerously so. Letters and ornaments are
    // dragged by transforming meshes that already exist, so re-grounding on
    // position would chase the drag: drag the lowest letter down, the piece
    // rises to meet the floor, the cursor's place in the design moves down
    // again, and the letter runs away from the pointer. Watching which
    // geometries are present can't do that, since a drag changes none of them.
    const built = builtSignature(innerGroup);
    if (built === builtRef.current) return;

    // One thing does rebuild mid-drag: a cake topper's stick changes length as
    // it moves, to keep its tip level, so it hands over fresh geometry on every
    // frame of the drag. Grounding that would chase the pointer in the way
    // described above, so nothing is grounded while a drag is in progress.
    //
    // Every drag in the studio turns the orbit controls off for its duration —
    // it has to, since they listen to the canvas directly (see TextBlockMesh and
    // StickMesh) — which makes that the one dependable "something is being held"
    // signal there is from in here.
    if (controls && !controls.enabled) return;

    if (!center()) return;
    builtRef.current = built;
    if (!centeredRef.current) {
      centeredRef.current = true;
      // Only ever the first time: re-framing the camera because a rail appeared
      // would throw away whatever view the user had moved to.
      onFirstCenter?.();
    }
  });

  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}
