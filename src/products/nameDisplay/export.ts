import { threeMfBinary, type ThreeMfObject } from '../../export/threeMfExport';
import { initialRailGeometry, placedDecoratorGeometry, placedNameGeometry, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
import { decoratorColor, type NameDisplayConfig } from './config';

/**
 * Every piece of the design, each in its own color, positioned as they are
 * assembled — the pocketed initial, the base rail under it, and the name seated
 * in the recess cut for it.
 */
export function printObjects(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): ThreeMfObject[] {
  const rail = initialRailGeometry(blocks, config);
  return [
    { name: `${config.initial} (initial)`, color: config.initialColor, geometry: assembly.initialGeometry },
    // A piece in its own right: it has a socket cut into it that the initial
    // drops into, so the two are printed separately and assembled, exactly as
    // the name and its pocket are. Hence its own part and its own color.
    ...(rail ? [{ name: 'Base rail', color: config.standColor, geometry: rail }] : []),
    ...(blocks.name ? [{ name: `${config.name} (name)`, color: config.nameColor, geometry: placedNameGeometry(blocks, assembly, config) }] : []),
    // Each ornament prints as its own piece, dropping into its own recess, so
    // each is its own part rather than being merged into the name — and each
    // carries its own color, which is the whole point of being able to set one:
    // a slicer reads these as separate parts to assign filaments to.
    ...blocks.decorators.map((decorator) => ({
      name: `${decorator.block.label} (decorator)`,
      color: decoratorColor(config, decorator.id),
      geometry: placedDecoratorGeometry(decorator, assembly),
    })),
  ];
}

/**
 * The whole design as one .3mf: every piece a named object in its own color,
 * already fitted together.
 *
 * Not an STL, because an STL cannot say any of that. It has no objects and no
 * colors, and splitting one in a slicer splits by connected shell — which here
 * means the back slab, every island the pocket cut the front slab into, and
 * every letter of the name, a dozen-odd pieces to sort out by hand. The fit
 * between the two pieces is the one thing this app knows and the person at the
 * printer does not, so it is worth a format that can carry it.
 */
export function combined3mfBinary(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): Uint8Array {
  return threeMfBinary(printObjects(blocks, assembly, config), blocks.name ? `${config.initial} — ${config.name}` : config.initial);
}
