import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { StickOffset } from '../geometry/types';
import { stickToGeometry, clampStickOffsetToBounds } from '../geometry/stickGeometry';
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
  mainGeometry: THREE.BufferGeometry;
  color: string;
  stick: StickParams;
  offset: StickOffset;
  /** The pick's own group — a stick's (x, y) is in that group's local space, not its own. */
  referenceObject: React.RefObject<THREE.Group | null>;
  onOffsetCommit: (offset: StickOffset) => void;
}

/** One draggable stick. A pick with multiple sticks renders one of these per stick, each independently grabbable. */
export function StickMesh({ mainGeometry, color, stick, offset, referenceObject, onOffsetCommit }: StickMeshProps) {
  const [hovered, setHovered] = useState(false);
  const [liveOffset, setLiveOffset] = useState<StickOffset | null>(null);
  const controls = useThree((s) => s.controls) as ToggleableControls | null;

  const currentOffset = liveOffset ?? offset;

  const geometry = useMemo(() => {
    const clamped = clampStickOffsetToBounds(mainGeometry, currentOffset, stick.widthMm, stick.embedMm);
    return stickToGeometry({ ...stick, offset: clamped });
  }, [mainGeometry, currentOffset, stick]);

  function updateLiveOffset(event: ThreeEvent<PointerEvent>) {
    const reference = referenceObject.current;
    if (!reference) return;
    const point = localDragPoint(event, reference);
    if (point) setLiveOffset({ x: point.x, y: point.y });
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
    updateLiveOffset(event);
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
    const clamped = clampStickOffsetToBounds(mainGeometry, liveOffset, stick.widthMm, stick.embedMm);
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
