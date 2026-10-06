import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TextBlock, Offset2D } from '../../geometry/types';
import type { CakeTopperBlockId } from './config';
import { combinedBlockBounds } from '../../geometry/letterLayout';
import type { StickParams } from '../../scene/TextBlockMesh';
import { TextBlockMesh } from '../../scene/TextBlockMesh';
import { OutlineMesh } from '../../scene/OutlineMesh';
import { OutlineHoleTargets } from '../../scene/OutlineHoleTargets';
import { useKeyHeld } from '../../scene/useKeyHeld';
import { detectOutlineHoleCandidates } from '../../geometry/outline';
import { usePanelStore } from '../../ui/panelStore';
import { useCakeTopperStore, selectCakeTopperConfig } from './store';
import { useCakeTopperGeometry } from './geometryContext';
import { decoratorFocusKey, lineFocusKey, SECTIONS } from './focus';
import { contentZMm, decoratorOutlineContours, decoratorPlacement, stickThicknessMm, type DecoratorBlock } from './geometry';
import { rotateOffset } from '../../geometry/placement';
import { decoratorColor, type CakeTopperConfig } from './config';

const BLOCK_GAP_MM = 12;

interface SceneProps {
  blocks: TextBlock[];
  color: string;
  stick: StickParams;
  stickColor: string;
  stickOffsets: Record<CakeTopperBlockId, Offset2D[]>;
  onStickOffsetCommit: (blockId: CakeTopperBlockId, index: number, offset: Offset2D) => void;
  letterGapsMm: number[][];
  onLetterGapCommit: (blockId: CakeTopperBlockId, lineIndex: number, gapIndex: number, gapMm: number) => void;
  lineOffsets: Offset2D[];
  onLineOffsetCommit: (blockId: CakeTopperBlockId, lineIndex: number, offset: Offset2D) => void;
  outlineEnabled: boolean;
  outlineGrowMm: number;
  outlineColor: string;
  outlineDepthMm: number;
  closedOutlineHoles: string[];
  /** The ornaments on the piece, built from their icons. */
  decorators?: DecoratorBlock[];
  /** The whole config, for the ornaments' placements and colours — they are keyed by id rather than positional. */
  config?: CakeTopperConfig;
  onDecoratorOffsetCommit?: (id: string, offset: Offset2D) => void;
  onDecoratorTap?: (id: string) => void;
  /** Fills a counter hole in, or opens it again — the same toggle the panel's checklist drives. */
  onToggleOutlineHole?: (key: string) => void;
  /** A letter was clicked rather than dragged — whichever letter, the line it belongs to is what the panel edits. */
  onLineTap?: (lineIndex: number) => void;
  /** A stick was clicked rather than dragged. */
  onStickTap?: () => void;
}

/**
 * The cake topper's scene, driven entirely by props — the shape the scene-wiring
 * tests exercise. `CakeTopperSceneContent` below is the thin store-connected
 * wrapper the product registry actually mounts.
 */
export function CakeTopperScene({
  blocks,
  color,
  stick,
  stickColor,
  stickOffsets,
  onStickOffsetCommit,
  letterGapsMm,
  onLetterGapCommit,
  lineOffsets,
  onLineOffsetCommit,
  outlineEnabled,
  outlineGrowMm,
  outlineColor,
  outlineDepthMm,
  closedOutlineHoles,
  decorators = [],
  config: fullConfig,
  onDecoratorOffsetCommit,
  onDecoratorTap,
  onToggleOutlineHole,
  onLineTap,
  onStickTap,
}: SceneProps) {
  const layout = useMemo(() => {
    let cursor = 0;
    const positions: number[] = [];
    for (const block of blocks) {
      const bb = combinedBlockBounds(block, letterGapsMm, lineOffsets);
      const width = bb.max.x - bb.min.x;
      positions.push(cursor - bb.min.x);
      cursor += width + BLOCK_GAP_MM;
    }
    const totalWidth = cursor - BLOCK_GAP_MM;
    const centerOffset = totalWidth / 2;
    return positions.map((p) => p - centerOffset);
  }, [blocks, letterGapsMm, lineOffsets]);

  // Everything that is not the card sits on its front face, so the two meet
  // across a face instead of the card being buried inside the letters — the
  // preview shows the same stack the file carries. See contentZMm.
  const contentZ = fullConfig ? contentZMm(fullConfig) : 0;
  const wordIndex = blocks.findIndex((p) => p.id === 'word');
  const wordBlock = blocks[wordIndex];
  // The outline card can't cheaply track a live letter/line drag (unlike a
  // letter or stick mesh, it's a re-triangulation, not just a reposition), so
  // it's hidden for the duration instead of visibly lagging behind.
  const [wordLetterDragActive, setWordLetterDragActive] = useState(false);

  // Holding the modifier turns the card's counter holes into things you can
  // point at. Letting go has to forget whatever was under the pointer, since
  // no pointerout will arrive once the patches are gone.
  const [hoveredHole, setHoveredHole] = useState<string | null>(null);
  const editingHoles = useKeyHeld('Control', () => setHoveredHole(null)) && outlineEnabled && !!onToggleOutlineHole;
  // The panel pointing at one of its checklist rows. Lights that hole up even
  // with nothing held: the row names it by line and letter, which is exact and
  // no way to find it on the card.
  const highlightedHole = usePanelStore((s) => s.highlighted);
  const markingHoles = editingHoles || highlightedHole !== null;
  // The card grows around the ornaments as well as the letters, so it reaches
  // out and holds them. Memoized because it is rebuilt from every ornament's
  // contours, and the card itself re-triangulates whenever this changes.
  const ornamentContours = useMemo(
    () => (fullConfig && outlineEnabled && decorators.length > 0 ? decoratorOutlineContours(decorators, fullConfig) : undefined),
    [fullConfig, outlineEnabled, decorators],
  );
  // Only worth finding while they can be pointed at — it is another run of the
  // offsetting, and the rest of the time nobody is asking.
  const holeCandidates = useMemo(
    () => (markingHoles && outlineEnabled && wordBlock ? detectOutlineHoleCandidates(wordBlock, letterGapsMm, lineOffsets, outlineGrowMm, ornamentContours) : []),
    [markingHoles, outlineEnabled, wordBlock, letterGapsMm, lineOffsets, outlineGrowMm, ornamentContours],
  );
  // Memoized because the patches build a geometry per candidate: a fresh array
  // every render would throw all of them away and rebuild them every render.
  const markedHoles = useMemo(
    () => (editingHoles ? holeCandidates : holeCandidates.filter((candidate) => candidate.key === highlightedHole)),
    [editingHoles, holeCandidates, highlightedHole],
  );
  // What the card would look like with the hole under the pointer toggled —
  // the preview is the real thing rebuilt, not a drawing of it.
  const previewedHoles = useMemo(() => {
    if (!editingHoles || !hoveredHole) return closedOutlineHoles;
    return closedOutlineHoles.includes(hoveredHole) ? closedOutlineHoles.filter((key) => key !== hoveredHole) : [...closedOutlineHoles, hoveredHole];
  }, [editingHoles, hoveredHole, closedOutlineHoles]);

  return (
    <group>
      {blocks.map((block, i) => {
        const blockId = block.id as CakeTopperBlockId;
        return (
          <TextBlockMesh
            key={block.id}
            block={block}
            color={color}
            position={[layout[i] ?? 0, 0, 0]}
            // The letters rise onto the card; the sticks stay sunk into it.
            letterZMm={contentZ}
            stick={stick}
            stickColor={stickColor}
            stickOffsets={stickOffsets[blockId]}
            onStickOffsetCommit={(index, offset) => onStickOffsetCommit(blockId, index, offset)}
            letterGapsMm={letterGapsMm}
            onLetterGapCommit={(lineIndex, gapIndex, gapMm) => onLetterGapCommit(blockId, lineIndex, gapIndex, gapMm)}
            lineOffsets={lineOffsets}
            onLineOffsetCommit={(lineIndex, offset) => onLineOffsetCommit(blockId, lineIndex, offset)}
            onLetterDragActiveChange={block.id === 'word' ? setWordLetterDragActive : undefined}
            onLetterTap={onLineTap && ((lineIndex) => onLineTap(lineIndex))}
            onStickTap={onStickTap && (() => onStickTap())}
          />
        );
      })}
      {outlineEnabled && wordBlock && !wordLetterDragActive && (
        // Shares the word's own positionX (not laid out side-by-side like a
        // separate block would be) so it visually surrounds every line instead
        // of sitting next to it.
        <OutlineMesh
          block={wordBlock}
          positionX={layout[wordIndex] ?? 0}
          letterGapsMm={letterGapsMm}
          lineOffsets={lineOffsets}
          growMm={outlineGrowMm}
          depthMm={outlineDepthMm}
          color={outlineColor}
          closedOutlineHoles={previewedHoles}
          extraContours={ornamentContours}
        />
      )}
      {/* Each ornament in its own anchor group, turned about its own centre, as
          the name display places its own. dragMode="whole" is what makes any
          part of an icon pick the whole thing up: an ornament is placed, not
          kerned, so it has no gaps of its own to retune. */}
      {fullConfig &&
        decorators.map((decorator) => {
          const { rotationRad = 0, pivot = { x: 0, y: 0 }, translate = { x: 0, y: 0 } } = decoratorPlacement(decorator, fullConfig);
          return (
            <group key={decorator.id} position={[(layout[wordIndex] ?? 0) + translate.x + pivot.x, translate.y + pivot.y, contentZ]} rotation={[0, 0, rotationRad]}>
              <TextBlockMesh
                block={decorator.block}
                color={decoratorColor(fullConfig, decorator.id)}
                position={[-pivot.x, -pivot.y, 0]}
                letterGapsMm={[[]]}
                onLetterGapCommit={() => {}}
                dragMode="whole"
                lineOffsets={[{ x: 0, y: 0 }]}
                // Measured inside the turned group, so the delta is turned back
                // into the lettering's frame before it moves the ornament.
                onLineOffsetCommit={(_lineIndex, dragged) => {
                  const delta = rotateOffset(dragged, rotationRad);
                  onDecoratorOffsetCommit?.(decorator.id, { x: translate.x + delta.x, y: translate.y + delta.y });
                }}
                onLetterTap={onDecoratorTap && (() => onDecoratorTap(decorator.id))}
              />
            </group>
          );
        })}

      {markedHoles.length > 0 && !wordLetterDragActive && (
        <OutlineHoleTargets
          // Only the one being pointed at when that is all this is for: a card
          // lit up all over would not say which row the pointer is on.
          candidates={markedHoles}
          positionX={layout[wordIndex] ?? 0}
          cardDepthMm={outlineDepthMm}
          hoveredKey={editingHoles ? hoveredHole : null}
          highlightedKey={highlightedHole}
          interactive={editingHoles}
          onHoverChange={setHoveredHole}
          onToggle={onToggleOutlineHole ?? (() => {})}
        />
      )}
    </group>
  );
}

/**
 * The cake topper's scene as the product registry mounts it: no props, reading
 * the product's own store and the shared geometry build directly.
 */
export function CakeTopperSceneContent() {
  const config = useCakeTopperStore(useShallow(selectCakeTopperConfig));
  const setStickOffset = useCakeTopperStore((s) => s.setStickOffset);
  const setLetterGap = useCakeTopperStore((s) => s.setLetterGap);
  const setLineOffset = useCakeTopperStore((s) => s.setLineOffset);
  const onToggleClosedOutlineHole = useCakeTopperStore((s) => s.toggleClosedOutlineHole);
  const setDecoratorOffset = useCakeTopperStore((s) => s.setDecoratorOffset);
  const focus = usePanelStore((s) => s.focus);
  const { blocks, decorators } = useCakeTopperGeometry();

  // A stick is embedded into the outline card when there is one, so it reads
  // as (and is sized/colored like) part of that piece rather than the
  // lettering — matches stickThicknessMm in geometry.ts, used at export time.
  const stickDepthMm = stickThicknessMm(config);
  const stick = useMemo(
    () => ({
      lengthMm: config.stickLengthMm,
      widthMm: config.stickWidthMm,
      embedMm: config.stickEmbedMm,
      thicknessMm: stickDepthMm,
    }),
    [config.stickLengthMm, config.stickWidthMm, config.stickEmbedMm, stickDepthMm],
  );

  return (
    <CakeTopperScene
      blocks={blocks}
      color={config.previewColor}
      stick={stick}
      stickColor={config.outlineEnabled ? config.outlineColor : config.previewColor}
      stickOffsets={config.stickOffsets}
      onStickOffsetCommit={(blockId, index, offset) => setStickOffset(blockId, index, offset)}
      letterGapsMm={config.letterGapsMm}
      onLetterGapCommit={(_blockId, lineIndex, gapIndex, gapMm) => setLetterGap(lineIndex, gapIndex, gapMm)}
      lineOffsets={config.lineOffsets}
      onLineOffsetCommit={(_blockId, lineIndex, offset) => setLineOffset(lineIndex, offset)}
      outlineEnabled={config.outlineEnabled}
      outlineGrowMm={config.outlineGrowMm}
      outlineColor={config.outlineColor}
      outlineDepthMm={config.outlineDepthMm}
      closedOutlineHoles={config.closedOutlineHoles}
      decorators={decorators}
      config={config}
      onDecoratorOffsetCommit={setDecoratorOffset}
      onDecoratorTap={(id) => focus(SECTIONS.decorators, decoratorFocusKey(id))}
      onToggleOutlineHole={onToggleClosedOutlineHole}
      onLineTap={(lineIndex) => focus(SECTIONS.text, lineFocusKey(lineIndex))}
      onStickTap={() => focus(SECTIONS.sticks)}
    />
  );
}
