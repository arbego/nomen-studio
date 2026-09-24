import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { StickOffset } from '../geometry/types';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from '../geometry/stickGeometry';
import { localDragPoint } from './dragUtils';
import type { StickParams } from './PickMesh';

// OrbitControls listens to native pointer events directly on the canvas, so a
// synthetic-event stopPropagation() from a mesh handler doesn't stop it from
// also rotating the camera during a drag — it has to be disabled explicitly.
type ToggleableControls = { enabled: boolean };

// Guarded because this runs fine in the browser, but not under
// @react-three/test-renderer's headless (no-`document`) scene-graph tests.
function setCursor(cursor: string) {
  if (typeof document !== 'undefined') {
    document.body.style.cursor = cursor;
  }
}

interface StickMeshProps {
  /** The piece it's attaching to's current combined bounds, in the pick group's local space — used to clamp where this stick is allowed to sit. */
  bounds: THREE.Box3;
  color: string;
  stick: StickParams;
  offset: StickOffset;
  /** The pick's own group — a stick's (x, y) is in that group's local space, not its own. */
  referenceObject: React.RefObject<THREE.Group | null>;
  onOffsetCommit: (offset: StickOffset) => void;
}

/** One draggable stick. A pick with multiple sticks renders one of these per stick, each independently grabbable. */
export function StickMesh({ bounds, color, stick, offset, referenceObject, onOffsetCommit }: StickMeshProps) {
  const [hovered, setHovered] = useState(false);
  const [liveOffset, setLiveOffset] = useState<StickOffset | null>(null);
  const controls = useThree((s) => s.controls) as ToggleableControls | null;
  // The (x, y) delta between where the pointer first landed and the stick's
  // offset at that moment — captured once on pointer down and held constant
  // for the rest of the drag, so the stick keeps whatever relationship it had
  // to the cursor at grab time instead of snapping its offset to exactly the
  // clicked point (which is almost never (0, 0) on the stick's own body).
  const grabDeltaRef = useRef<StickOffset>({ x: 0, y: 0 });

  const currentOffset = liveOffset ?? offset;

  const geometry = useMemo(() => {
    const clamped = clampStickOffsetToBounds(bounds, currentOffset, stick.widthMm, stick.embedMm);
    const lengthMm = stickLengthForLevelTip(stick.lengthMm, stick.embedMm, clamped.y);
    return stickToGeometry({ ...stick, lengthMm, offset: clamped });
  }, [bounds, currentOffset, stick]);

  function updateLiveOffset(event: ThreeEvent<PointerEvent>) {
    const reference = referenceObject.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (point) setLiveOffset({ x: point.x - grabDeltaRef.current.x, y: point.y - grabDeltaRef.current.y });
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    // controls is the live OrbitControls instance (an imperative Three.js
    // object from useThree), not React state — toggling .enabled directly is
    // the standard R3F way to suspend it during a drag.
    // eslint-disable-next-line react/immutability -- see above
    if (controls) controls.enabled = false;
    setCursor('grabbing');
    const reference = referenceObject.current;
    const point = reference ? localDragPoint(event, reference) : null;
    grabDeltaRef.current = point ? { x: point.x - offset.x, y: point.y - offset.y } : { x: 0, y: 0 };
    setLiveOffset(offset);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (liveOffset === null) return;
    event.stopPropagation();
    updateLiveOffset(event);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (liveOffset === null) return;
    event.stopPropagation();
    (event.target as Element).releasePointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- see handlePointerDown
    if (controls) controls.enabled = true;
    setCursor(hovered ? 'grab' : 'auto');
    const clamped = clampStickOffsetToBounds(bounds, liveOffset, stick.widthMm, stick.embedMm);
    onOffsetCommit(clamped);
    setLiveOffset(null);
  }

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (liveOffset === null) setCursor('grab');
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        if (liveOffset === null) setCursor('auto');
      }}
    >
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} emissive={hovered ? color : '#000000'} emissiveIntensity={hovered ? 0.15 : 0} />
    </mesh>
  );
}
