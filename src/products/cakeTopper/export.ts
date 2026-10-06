import type * as THREE from 'three';
import type { TextBlock } from '../../geometry/types';
import { buildOutlineGeometry } from '../../geometry/outline';
import { threeMfBinary, type ThreeMfObject } from '../../export/threeMfExport';
import { getIcon } from '../../icons/catalog';
import { combineGeometries } from '../../geometry/combine';
import { decoratorOutlineContours, letteringGeometry, mergedBlockGeometry, placedDecoratorGeometry, sticksForBlock, type DecoratorBlock } from './geometry';
import { decoratorColor, type CakeTopperConfig } from './config';

/** The outline card's own geometry under a block's current letters, or null when there's nothing to add (disabled, or not grown at all). */
function outlineGeometryFor(block: TextBlock, config: CakeTopperConfig, decorators: DecoratorBlock[]): THREE.BufferGeometry | null {
  if (!config.outlineEnabled) {
    return null;
  }
  const outline = buildOutlineGeometry(
    block,
    config.letterGapsMm,
    config.lineOffsets,
    config.outlineGrowMm,
    config.outlineDepthMm,
    config.closedOutlineHoles,
    decoratorOutlineContours(decorators, config),
  );
  return outline?.mainGeometry ?? null;
}

/**
 * The topper's printable pieces, in the colors the preview shows them in.
 *
 * The sticks belong to whichever piece they are actually sunk into, and are
 * merged into it rather than being a part of their own: into the backing card
 * when there is one — they are cut to the card's thickness and embedded in it,
 * which is also the filament the preview already shows them in — and into the
 * lettering when there is not. Left in the lettering while a card is present,
 * each stick would be a lettering-colored part buried inside a card-colored one,
 * for the slicer to resolve by part order: a stripe of the wrong filament
 * through the card, for a piece that is plainly part of it.
 */
export function printObjects(block: TextBlock, config: CakeTopperConfig, decorators: DecoratorBlock[] = []): ThreeMfObject[] {
  const outline = outlineGeometryFor(block, config, decorators);
  const objects: ThreeMfObject[] = [
    { name: 'Lettering', color: config.previewColor, geometry: outline ? letteringGeometry(block, config) : mergedBlockGeometry(block, config) },
  ];
  if (outline) {
    objects.push({ name: 'Backing card', color: config.outlineColor, geometry: combineGeometries([outline, ...sticksForBlock(block, config)]) });
  }
  // Each ornament on its own, because each can be a filament of its own. They
  // are placed where they were dragged, so they meet the lettering or the card
  // in the file exactly as they do on screen, and fuse to it in the print.
  for (const decorator of decorators) {
    objects.push({
      name: getIcon(config.decorators.find((d) => d.id === decorator.id)!.iconName).name,
      color: decoratorColor(config, decorator.id),
      geometry: placedDecoratorGeometry(decorator, config),
    });
  }
  return objects;
}

/**
 * The whole topper as one .3mf: the lettering and, when enabled, the backing
 * card behind it, as two named parts in their own colors.
 *
 * STL would flatten that back into one anonymous mesh — it has no notion of a
 * part and none of a color — leaving the card and the letters to be told apart
 * by hand in the slicer, which is exactly the work the design already did.
 */
export function combined3mfBinary(block: TextBlock, config: CakeTopperConfig, designName: string, decorators: DecoratorBlock[] = []): Uint8Array {
  return threeMfBinary(printObjects(block, config, decorators), designName);
}
