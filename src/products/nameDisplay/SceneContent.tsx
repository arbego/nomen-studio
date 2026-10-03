import { useShallow } from 'zustand/react/shallow';
import { TextBlockMesh } from '../../scene/TextBlockMesh';
import { StandMesh } from '../../scene/StandMesh';
import { useNameDisplayStore, selectNameDisplayConfig } from './store';
import { useNameDisplayGeometry } from './geometryContext';
import { standGeometryFor, type NameDisplayGeometry } from './geometry';
import type { NameDisplayConfig } from './config';

interface NameDisplaySceneProps {
  built: NameDisplayGeometry;
  config: NameDisplayConfig;
  onNameOffsetCommit: (offset: { x: number; y: number }) => void;
  onNameLetterGapCommit: (gapIndex: number, gapMm: number) => void;
}

/**
 * The name display's scene, driven entirely by props.
 *
 * The initial is rendered from its own pocketed solid rather than as letters,
 * since the recess makes it a single boolean result and not a row of glyphs; it
 * is also not draggable — the name moves *onto* it, not the other way round.
 */
export function NameDisplayScene({ built, config, onNameOffsetCommit, onNameLetterGapCommit }: NameDisplaySceneProps) {
  const initialRail = standGeometryFor(built.initial, config, config.initialDepthMm, [], { x: 0, y: 0 });
  const nameRail = standGeometryFor(built.name, config, config.nameDepthMm, config.nameLetterGapsMm, config.nameOffset);

  return (
    <group>
      <mesh geometry={built.initialGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={config.initialColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {initialRail && <StandMesh geometry={initialRail} color={config.initialColor} />}

      <TextBlockMesh
        block={built.name}
        color={config.nameColor}
        // Seated at the pocket floor, so it visibly sits *in* the initial and
        // stands proud of it by exactly protrusionMm.
        position={[config.nameOffset.x, config.nameOffset.y, built.nameZMm]}
        letterGapsMm={[config.nameLetterGapsMm]}
        onLetterGapCommit={(_lineIndex, gapIndex, gapMm) => onNameLetterGapCommit(gapIndex, gapMm)}
        // The name is one line, so TextBlockMesh's own "drag the first letter to
        // move the whole line" gesture is exactly "drag the name around".
        lineOffsets={[{ x: 0, y: 0 }]}
        onLineOffsetCommit={(_lineIndex, offset) => onNameOffsetCommit({ x: config.nameOffset.x + offset.x, y: config.nameOffset.y + offset.y })}
      />
      {nameRail && <StandMesh geometry={nameRail} color={config.nameColor} />}
    </group>
  );
}

/** The name display's scene as the product registry mounts it. */
export function NameDisplaySceneContent() {
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const setNameOffset = useNameDisplayStore((s) => s.setNameOffset);
  const setNameLetterGap = useNameDisplayStore((s) => s.setNameLetterGap);
  const { result: built } = useNameDisplayGeometry();

  if (!built) {
    return null;
  }

  return <NameDisplayScene built={built} config={config} onNameOffsetCommit={setNameOffset} onNameLetterGapCommit={setNameLetterGap} />;
}
