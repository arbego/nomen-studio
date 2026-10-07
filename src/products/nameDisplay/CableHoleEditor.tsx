import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useTapGesture } from '../../scene/tapGesture';
import { pickCableHolePlacement, type CableHole } from './cableHole';
import type { CableHolePlacement } from './config';

interface Props {
  surface: THREE.BufferGeometry;
  hole: CableHole;
  floorZ: number;
  lidTransparent?: boolean;
  onSelect?: () => void;
  onCommit: (placement: CableHolePlacement) => void;
}

/** An uncut picking surface keeps a hole draggable even when the ray crosses its opening. */
export function CableHoleEditor({ surface, hole, floorZ, lidTransparent = true, onSelect, onCommit }: Props) {
  const group = useRef<THREE.Group>(null);
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null;
  const [live, setLive] = useState<CableHolePlacement | null>(null);
  const [selected, setSelected] = useState(false);
  const tap = useTapGesture();
  const drag = useRef<{ placement: CableHolePlacement; start: CableHolePlacement; offset: THREE.Vector3; controlsEnabled: boolean; canMove: boolean } | null>(null);
  const current = live ?? hole.placement;

  useEffect(() => () => {
    if (drag.current && controls) controls.enabled = drag.current.controlsEnabled;
    if (drag.current && typeof document !== 'undefined') document.body.style.cursor = '';
  }, [controls]);

  function pick(event: ThreeEvent<PointerEvent>) {
    if (!group.current) return null;
    group.current.updateWorldMatrix(true, false);
    const ray = event.ray.clone().applyMatrix4(group.current.matrixWorld.clone().invert());
    return pickCableHolePlacement(surface, ray, floorZ);
  }

  function down(event: ThreeEvent<PointerEvent>) {
    // Ignore a marker hidden by another part of the model.
    if (event.intersections?.some((hit) => {
      let object: THREE.Object3D | null = hit.object;
      while (object && object !== group.current) object = object.parent;
      return !object && hit.distance < event.distance - 0.02;
    })) return;
    const picked = pick(event);
    if (!picked) return;
    event.stopPropagation();
    tap.press(event);
    const offset = new THREE.Vector3(picked.point.x - current.point.x, picked.point.y - current.point.y, picked.point.z - current.point.z);
    const sameFace = new THREE.Vector3(picked.normal.x, picked.normal.y, picked.normal.z).dot(new THREE.Vector3(current.normal.x, current.normal.y, current.normal.z)) > 0.999;
    drag.current = { placement: current, start: current, offset: sameFace ? offset : new THREE.Vector3(), controlsEnabled: controls?.enabled ?? true, canMove: selected };
    (event.target as Element).setPointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- OrbitControls is a live Three.js object, suspended during the drag.
    if (controls) controls.enabled = false;
    if (typeof document !== 'undefined') document.body.style.cursor = selected ? 'grabbing' : 'pointer';
  }

  function move(event: ThreeEvent<PointerEvent>) {
    if (!drag.current) return;
    event.stopPropagation();
    if (!drag.current.canMove) return;
    const picked = pick(event);
    if (!picked) return;
    const previous = drag.current.placement;
    const sameFace = new THREE.Vector3(picked.normal.x, picked.normal.y, picked.normal.z).dot(new THREE.Vector3(previous.normal.x, previous.normal.y, previous.normal.z)) > 0.999;
    if (sameFace) {
      picked.point.x -= drag.current.offset.x;
      picked.point.y -= drag.current.offset.y;
      picked.point.z -= drag.current.offset.z;
    } else drag.current.offset.set(0, 0, 0);
    drag.current.placement = picked;
    setLive(picked);
  }

  function finish(event: ThreeEvent<PointerEvent>, commit: boolean) {
    if (!drag.current) return;
    event.stopPropagation();
    const { placement, start, controlsEnabled, canMove } = drag.current;
    const wasTap = tap.release(event);
    drag.current = null;
    (event.target as Element).releasePointerCapture(event.pointerId);
    // eslint-disable-next-line react/immutability -- Restore the imperative OrbitControls state after the gesture.
    if (controls) controls.enabled = controlsEnabled;
    if (typeof document !== 'undefined') document.body.style.cursor = '';
    setLive(null);
    if (!commit) return;
    if (!canMove && wasTap) {
      setSelected(true);
      onSelect?.();
    } else if (canMove && !wasTap && (
      new THREE.Vector3(placement.point.x, placement.point.y, placement.point.z).distanceToSquared(new THREE.Vector3(start.point.x, start.point.y, start.point.z)) > 1e-12 ||
      new THREE.Vector3(placement.normal.x, placement.normal.y, placement.normal.z).distanceToSquared(new THREE.Vector3(start.normal.x, start.normal.y, start.normal.z)) > 1e-12
    )) onCommit(placement);
  }

  const isBack = current.normal.z < -0.5;
  const markers = isBack
    ? [...(lidTransparent ? [{ point: { ...current.point, z: floorZ + 0.06 }, normal: { x: 0, y: 0, z: 1 } }] : []), { point: { ...current.point, z: -0.06 }, normal: current.normal }]
    : [{ point: { x: current.point.x + current.normal.x * 0.06, y: current.point.y + current.normal.y * 0.06, z: current.point.z }, normal: current.normal }];

  return (
    <group ref={group} name="cable-hole-editor" onPointerMissed={() => { if (!drag.current) setSelected(false); }}>
      {markers.map(({ point, normal }, index) => (
        <group key={index} position={[point.x, point.y, point.z]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(normal.x, normal.y, normal.z))}>
          <mesh name={`cable-hole-handle-${index}`} onPointerDown={down} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)}
            onPointerOver={(event) => { event.stopPropagation(); if (!drag.current && typeof document !== 'undefined') document.body.style.cursor = selected ? 'grab' : 'pointer'; }}
            onPointerOut={() => { if (!drag.current && typeof document !== 'undefined') document.body.style.cursor = ''; }}>
            <circleGeometry args={[hole.diameterMm / 2 + 0.9, 64]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.FrontSide} />
          </mesh>
          <mesh name={`cable-hole-ring-${index}`} raycast={() => {}}>
            <ringGeometry args={[hole.diameterMm / 2, hole.diameterMm / 2 + (selected ? 0.9 : 0.4), 64]} />
            <meshBasicMaterial color={hole.warning && !live ? '#dc2626' : selected ? '#f97316' : '#78716c'} side={THREE.FrontSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
