import { useEffect, useMemo } from 'react';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { regionToShapes } from '../../geometry/clipper';
import { useShallow } from 'zustand/react/shallow';
import { TextBlockMesh } from '../../scene/TextBlockMesh';
import { StandMesh } from '../../scene/StandMesh';
import { useTapGesture } from '../../scene/tapGesture';
import { rotateOffset } from '../../geometry/placement';
import { usePanelStore } from '../../ui/panelStore';
import { CABLE_HOLE_FOCUS_KEY, decoratorFocusKey, INITIAL_FOCUS_KEY, NAME_FOCUS_KEY, SECTIONS } from './focus';
import { useNameDisplayStore, selectNameDisplayConfig } from './store';
import { useNameDisplayGeometry } from './geometryContext';
import { blockRegion, initialRailGeometry, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
import { decoratorColor, type CableHolePlacement, type NameDisplayConfig } from './config';
import { CableHoleEditor } from './CableHoleEditor';

interface NameDisplaySceneProps {
  blocks: NameDisplayBlocks;
  assembly: NameDisplayAssembly;
  config: NameDisplayConfig;
  showLid?: boolean;
  editingCableHole?: boolean;
  onCableHoleCommit?: (placement: CableHolePlacement) => void;
  onNameOffsetCommit: (offset: { x: number; y: number }) => void;
  onNameLetterGapCommit: (gapIndex: number, gapMm: number) => void;
  onDecoratorOffsetCommit: (id: string, offset: { x: number; y: number }) => void;
  /** A piece was clicked rather than dragged — the product points at the controls that shape it. */
  onInitialTap?: () => void;
  onLidTap?: () => void;
  onNameTap?: () => void;
  onDecoratorTap?: (id: string) => void;
}

/**
 * The name display's scene, driven entirely by props.
 *
 * The initial is rendered from its own pocketed solid rather than as letters,
 * since the recess makes it a single boolean result and not a row of glyphs; it
 * is also not draggable — the name moves *onto* it, not the other way round.
 */
export function NameDisplayScene({
  blocks,
  assembly,
  config,
  showLid = true,
  editingCableHole = false,
  onCableHoleCommit,
  onNameOffsetCommit,
  onNameLetterGapCommit,
  onDecoratorOffsetCommit,
  onInitialTap,
  onLidTap,
  onNameTap,
  onDecoratorTap,
}: NameDisplaySceneProps) {
  // The initial is the one piece here that isn't draggable, so its tap is all
  // its pointer handlers do — and because it never captures the pointer or
  // suspends the controls, orbiting the view from the letter still works.
  const initialTap = useTapGesture();
  const lidTap = useTapGesture();
  // Memoized because it allocates: React Three Fiber never disposes a geometry
  // handed to it via the `geometry` prop, so rebuilding it on every render
  // (a slider drag is dozens per second) would leak GPU buffers. Only the
  // initial has a rail — the name is held by the pocket.
  const initialRail = useMemo(() => initialRailGeometry(blocks, config), [blocks, config]);
  const cableHoleSurface = useMemo(() => config.hollowEnabled && config.cableHoleEnabled && editingCableHole
    ? extrudeMmShapes(regionToShapes(blockRegion(blocks.initial, [])), config.initialDepthMm)
    : null, [blocks.initial, config.hollowEnabled, config.cableHoleEnabled, config.initialDepthMm, editingCableHole]);
  useEffect(() => () => { cableHoleSurface?.dispose(); }, [cableHoleSurface]);

  // The exact placement the pocket was cut from, re-expressed as a Three
  // transform: this group turns about the name's pivot and lands at the name's
  // offset, so `matrix = T(offset + pivot) · R(angle)` applied to content held
  // at `-pivot` reproduces `R(p - pivot) + pivot + offset` — placePoint's rule.
  const { rotationRad = 0, pivot = { x: 0, y: 0 }, translate = { x: 0, y: 0 } } = assembly.namePlacement;
  const nameAnchor: [number, number, number] = [translate.x + pivot.x, translate.y + pivot.y, assembly.nameZMm];
  const showInlays = !assembly.lidGeometry || showLid;

  return (
    <group>
      <mesh
        geometry={assembly.initialGeometry}
        castShadow
        receiveShadow
        onPointerDown={onInitialTap && ((event) => initialTap.press(event))}
        onPointerUp={
          onInitialTap &&
          ((event) => {
            if (initialTap.release(event)) onInitialTap();
          })
        }
      >
        <meshStandardMaterial color={config.initialColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {initialRail && <StandMesh geometry={initialRail} color={config.standColor} />}
      {cableHoleSurface && assembly.cableHole && onCableHoleCommit && <CableHoleEditor surface={cableHoleSurface} hole={assembly.cableHole} floorZ={config.wallThicknessMm} onCommit={onCableHoleCommit} />}
      {assembly.lidGeometry && showLid && (
        <mesh
          geometry={assembly.lidGeometry}
          castShadow
          receiveShadow
          onPointerDown={onLidTap && ((event) => lidTap.press(event))}
          onPointerUp={onLidTap && ((event) => { if (lidTap.release(event)) onLidTap(); })}
        >
          <meshStandardMaterial color={config.lidColor} roughness={0.55} metalness={0.05} />
        </mesh>
      )}

      {/* Seated at the pocket floor, so the name visibly sits *in* the initial and stands proud of it by exactly protrusionMm. */}
      {showInlays && blocks.name && (
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
            onLetterTap={onNameTap && (() => onNameTap())}
          />
        </group>
      )}

      {/* Each ornament seats on the same pocket floor as the name, is anchored
          and turned the same way, and drags the same way. dragMode="whole" is
          what makes a word ornament grabbable anywhere along it: an ornament is
          placed, not kerned, so it has no gaps of its own to retune. */}
      {showInlays && blocks.decorators.map((decorator, i) => {
        const { rotationRad = 0, pivot = { x: 0, y: 0 }, translate = { x: 0, y: 0 } } = assembly.decorators[i].placement;
        return (
          <group key={decorator.id} position={[translate.x + pivot.x, translate.y + pivot.y, assembly.nameZMm]} rotation={[0, 0, rotationRad]}>
            <TextBlockMesh
              block={decorator.block}
              color={decoratorColor(config, decorator.id)}
              position={[-pivot.x, -pivot.y, 0]}
              letterGapsMm={[[]]}
              onLetterGapCommit={() => {}}
              dragMode="whole"
              lineOffsets={[{ x: 0, y: 0 }]}
              // Measured inside the turned group, so the delta is turned back
              // into the initial's frame before it moves the ornament — exactly
              // as a tilted name's drag is.
              onLineOffsetCommit={(_lineIndex, dragged) => {
                const delta = rotateOffset(dragged, rotationRad);
                onDecoratorOffsetCommit(decorator.id, { x: translate.x + delta.x, y: translate.y + delta.y });
              }}
              onLetterTap={onDecoratorTap && (() => onDecoratorTap(decorator.id))}
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
  const showLid = useNameDisplayStore((s) => s.showLid);
  const editingCableHole = useNameDisplayStore((s) => s.editingCableHole);
  const setConfig = useNameDisplayStore((s) => s.setConfig);
  const setNameOffset = useNameDisplayStore((s) => s.setNameOffset);
  const setNameLetterGap = useNameDisplayStore((s) => s.setNameLetterGap);
  const setDecoratorOffset = useNameDisplayStore((s) => s.setDecoratorOffset);
  const focus = usePanelStore((s) => s.focus);
  const { blocks, assembly } = useNameDisplayGeometry();

  if (!blocks || !assembly) {
    return null;
  }

  return (
    <NameDisplayScene
      blocks={blocks}
      assembly={assembly}
      config={config}
      showLid={showLid}
      editingCableHole={editingCableHole}
      onCableHoleCommit={(cableHolePlacement) => {
        setConfig({ cableHolePlacement });
        focus(SECTIONS.hollow, CABLE_HOLE_FOCUS_KEY);
      }}
      onNameOffsetCommit={setNameOffset}
      onNameLetterGapCommit={setNameLetterGap}
      onDecoratorOffsetCommit={setDecoratorOffset}
      onInitialTap={() => focus(SECTIONS.initial, INITIAL_FOCUS_KEY)}
      onLidTap={() => focus(SECTIONS.hollow)}
      onNameTap={() => focus(SECTIONS.name, NAME_FOCUS_KEY)}
      onDecoratorTap={(id) => focus(SECTIONS.decorators, decoratorFocusKey(id))}
    />
  );
}
