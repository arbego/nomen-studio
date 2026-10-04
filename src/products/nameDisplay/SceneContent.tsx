import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TextBlockMesh } from '../../scene/TextBlockMesh';
import { StandMesh } from '../../scene/StandMesh';
import { rotateOffset } from '../../geometry/placement';
import { useNameDisplayStore, selectNameDisplayConfig } from './store';
import { useNameDisplayGeometry } from './geometryContext';
import { initialRailGeometry, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
import type { NameDisplayConfig } from './config';

interface NameDisplaySceneProps {
  blocks: NameDisplayBlocks;
  assembly: NameDisplayAssembly;
  config: NameDisplayConfig;
  onNameOffsetCommit: (offset: { x: number; y: number }) => void;
  onNameLetterGapCommit: (gapIndex: number, gapMm: number) => void;
  onDecoratorOffsetCommit: (id: string, offset: { x: number; y: number }) => void;
}

/**
 * The name display's scene, driven entirely by props.
 *
 * The initial is rendered from its own pocketed solid rather than as letters,
 * since the recess makes it a single boolean result and not a row of glyphs; it
 * is also not draggable — the name moves *onto* it, not the other way round.
 */
export function NameDisplayScene({ blocks, assembly, config, onNameOffsetCommit, onNameLetterGapCommit, onDecoratorOffsetCommit }: NameDisplaySceneProps) {
  // Memoized because it allocates: React Three Fiber never disposes a geometry
  // handed to it via the `geometry` prop, so rebuilding it on every render
  // (a slider drag is dozens per second) would leak GPU buffers. Only the
  // initial has a rail — the name is held by the pocket.
  const initialRail = useMemo(() => initialRailGeometry(blocks, config), [blocks, config]);

  // The exact placement the pocket was cut from, re-expressed as a Three
  // transform: this group turns about the name's pivot and lands at the name's
  // offset, so `matrix = T(offset + pivot) · R(angle)` applied to content held
  // at `-pivot` reproduces `R(p - pivot) + pivot + offset` — placePoint's rule.
  const { rotationRad = 0, pivot = { x: 0, y: 0 }, translate = { x: 0, y: 0 } } = assembly.namePlacement;
  const nameAnchor: [number, number, number] = [translate.x + pivot.x, translate.y + pivot.y, assembly.nameZMm];

  return (
    <group>
      <mesh geometry={assembly.initialGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={config.initialColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {initialRail && <StandMesh geometry={initialRail} color={config.standColor} />}

      {/* Seated at the pocket floor, so the name visibly sits *in* the initial and stands proud of it by exactly protrusionMm. */}
      <group position={nameAnchor} rotation={[0, 0, rotationRad]}>
        <TextBlockMesh
          block={blocks.name}
          color={config.nameColor}
          position={[-pivot.x, -pivot.y, 0]}
          letterGapsMm={[config.nameLetterGapsMm]}
          onLetterGapCommit={(_lineIndex, gapIndex, gapMm) => onNameLetterGapCommit(gapIndex, gapMm)}
          // The name is one line, so TextBlockMesh's own "drag the first letter to
          // move the whole line" gesture is exactly "drag the name around".
          lineOffsets={[{ x: 0, y: 0 }]}
          // The drag delta is measured inside the rotated group, so it has to be
          // turned back into the initial's frame before it can be added to the
          // name's offset — otherwise dragging a tilted name would track the
          // cursor at an angle.
          onLineOffsetCommit={(_lineIndex, offset) => {
            const delta = rotateOffset(offset, rotationRad);
            onNameOffsetCommit({ x: config.nameOffset.x + delta.x, y: config.nameOffset.y + delta.y });
          }}
        />
      </group>

      {/* Each ornament seats on the same pocket floor as the name, is anchored
          and turned the same way, and drags the same way — a one-glyph block, so
          TextBlockMesh's "drag the first letter to move the line" gesture is
          exactly "drag the icon around". */}
      {blocks.decorators.map((decorator, i) => {
        const { rotationRad = 0, pivot = { x: 0, y: 0 }, translate = { x: 0, y: 0 } } = assembly.decorators[i].placement;
        return (
          <group key={decorator.id} position={[translate.x + pivot.x, translate.y + pivot.y, assembly.nameZMm]} rotation={[0, 0, rotationRad]}>
            <TextBlockMesh
              block={decorator.block}
              color={config.nameColor}
              position={[-pivot.x, -pivot.y, 0]}
              letterGapsMm={[[]]}
              onLetterGapCommit={() => {}}
              lineOffsets={[{ x: 0, y: 0 }]}
              // Measured inside the turned group, so the delta is turned back
              // into the initial's frame before it moves the ornament — exactly
              // as a tilted name's drag is.
              onLineOffsetCommit={(_lineIndex, dragged) => {
                const delta = rotateOffset(dragged, rotationRad);
                onDecoratorOffsetCommit(decorator.id, { x: translate.x + delta.x, y: translate.y + delta.y });
              }}
            />
          </group>
        );
      })}
    </group>
  );
}

/** The name display's scene as the product registry mounts it. */
export function NameDisplaySceneContent() {
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const setNameOffset = useNameDisplayStore((s) => s.setNameOffset);
  const setNameLetterGap = useNameDisplayStore((s) => s.setNameLetterGap);
  const setDecoratorOffset = useNameDisplayStore((s) => s.setDecoratorOffset);
  const { blocks, assembly } = useNameDisplayGeometry();

  if (!blocks || !assembly) {
    return null;
  }

  return (
    <NameDisplayScene
      blocks={blocks}
      assembly={assembly}
      config={config}
      onNameOffsetCommit={setNameOffset}
      onNameLetterGapCommit={setNameLetterGap}
      onDecoratorOffsetCommit={setDecoratorOffset}
    />
  );
}
