import type * as THREE from 'three';
import type { TextBlock } from '../../geometry/types';
import { buildOutlineGeometry } from '../../geometry/outline';
import { threeMfBinary, type ThreeMfObject } from '../../export/threeMfExport';
import { getIcon } from '../../icons/catalog';
import { decoratorOutlineContours, mergedBlockGeometry, placedDecoratorGeometry, type DecoratorBlock } from './geometry';
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
 * The lettering is one piece: its sticks are merged into it, since they print in
 * the same filament and are embedded in the letters rather than sitting beside
 * them. The backing card is the second, and only when there is one — without it
 * this is a one-piece design, and the file says so.
 */
export function printObjects(block: TextBlock, config: CakeTopperConfig, decorators: DecoratorBlock[] = []): ThreeMfObject[] {
  const objects: ThreeMfObject[] = [{ name: 'Lettering', color: config.previewColor, geometry: mergedBlockGeometry(block, config) }];
  const outline = outlineGeometryFor(block, config, decorators);
  if (outline) {
    objects.push({ name: 'Backing card', color: config.outlineColor, geometry: outline });
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
