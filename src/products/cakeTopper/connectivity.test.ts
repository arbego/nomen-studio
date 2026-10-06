import { describe, expect, it } from 'vitest';
import type { TextBlock } from '../../geometry/types';
import { buildCakeTopperBlocks, buildCakeTopperDecorators } from './geometry';
import { looseCakeTopperParts } from './connectivity';
import type { CakeTopperConfig } from './config';

const config: CakeTopperConfig = {
  lines: ['Emma'],
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  letterGapsMm: [[0, 0, 0]],
  lineOffsets: [{ x: 0, y: 0 }],
  previewColor: '#f0c6d0',
  outlineEnabled: true,
  outlineGrowMm: 3,
  outlineColor: '#f7f5f2',
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},
};

async function design(overrides: Partial<CakeTopperConfig> = {}) {
  const used = { ...config, ...overrides };
  const [block] = await buildCakeTopperBlocks(used);
  const decorators = await buildCakeTopperDecorators(used);
  return { loose: looseCakeTopperParts(block, decorators, used), block, used };
}

/** The x halfway between two letters' ink — where a stick can sit inside the block's bounds and still touch nothing. */
function gapCenterX(block: TextBlock, left: number, right: number): number {
  const edge = (index: number, pick: (xs: number[]) => number) =>
    pick(block.lines[0].letters[index].contours.flatMap(({ outer }) => outer.map((p) => p.x)));
  return (edge(left, (xs) => Math.max(...xs)) + edge(right, (xs) => Math.min(...xs))) / 2;
}

describe('whether the topper would come off the plate in one piece', () => {
  it('says nothing about the design as the studio hands it over', async () => {
    // The one that matters most: a false alarm on an untouched design would
    // teach the user to ignore the warning before they had ever earned one.
    expect((await design()).loose).toEqual([]);
  }, 30000);

  it('names a line that has been dragged off the rest', async () => {
    const { loose } = await design({
      outlineEnabled: false,
      lines: ['Emma', 'Bo'],
      letterGapsMm: [[0, 0, 0], [0]],
      lineOffsets: [
        { x: 0, y: 0 },
        { x: 0, y: -90 },
      ],
    });
    // By its name rather than as two loose letters, which is the same news told
    // twice and in a form nobody can act on.
    expect(loose).toContain('“Bo”');
    expect(loose).not.toContain('“Emma”');
  }, 30000);

  it('holds the same two lines once the card is switched back on', async () => {
    const apart = {
      lines: ['Emma', 'Bo'],
      letterGapsMm: [[0, 0, 0], [0]],
      lineOffsets: [
        { x: 0, y: 0 },
        { x: 0, y: -40 },
      ],
    };
    expect((await design({ ...apart, outlineEnabled: false })).loose.length).toBeGreaterThan(0);
    expect((await design({ ...apart, outlineGrowMm: 30 })).loose).toEqual([]);
  }, 30000);

  it('names the letter, and the line it is in, when one letter comes away', async () => {
    // A letter alone would not be findable — a topper can easily have three p's.
    const { loose } = await design({ outlineEnabled: false, letterGapsMm: [[0, 0, 40]] });
    expect(loose).toEqual(['“a” in “Emma”']);
  }, 30000);

  it('counts the letters rather than spelling them, when several of a line come away', async () => {
    // They need not be adjacent — the loose letters of "Happy" can be H, a, p and
    // y — so spelling them gives "Hapy", which reads as the design misspelled.
    const { loose } = await design({ outlineEnabled: false, lines: ['Happy'], letterGapsMm: [[0, 0, 30, 0]] });
    // How the gap divides the word is the font's business, so this is about the
    // wording and not the count.
    expect(loose).toHaveLength(1);
    expect(loose[0]).toMatch(/^[2-4] letters of “Happy”$/);
  }, 30000);

  it('reports a card that has grown into islands rather than one card', async () => {
    // A space wider than twice the grow leaves the two halves of the card
    // unjoined, and with them the letters standing on each.
    const { loose } = await design({ lines: ['A B'], outlineGrowMm: 1 });
    expect(loose).toContain('part of the backing card');
  }, 30000);

  it('reports a stick planted where there is nothing to hold it', async () => {
    // A stick is only clamped to the lettering's combined *bounds*, which is a
    // box: under a space it satisfies that and meets no letter at all.
    const { block } = await design({ lines: ['A B'] });
    const { loose } = await design({
      lines: ['A B'],
      outlineEnabled: false,
      letterGapsMm: [[0, 0]],
      stickOffsets: { word: [{ x: gapCenterX(block, 0, 2), y: 0 }] },
    });
    expect(loose).toContain('the stick');
  }, 30000);

  it('names an ornament dragged clear of the piece, and stops once it is back on it', async () => {
    const heart = { decorators: [{ id: 'd1', iconName: 'favorite', widthMm: 20, depthMm: 3 }] };
    const adrift = await design({ ...heart, decoratorPlacements: { d1: { offset: { x: 400, y: 400 }, angleDeg: 0 } } });
    // The card is reported with it, and rightly: it grows around the ornaments
    // too, so one dragged into the distance takes an island of card with it, and
    // that island is as loose as the ornament standing on it.
    expect(adrift.loose).toEqual(['part of the backing card', '“favorite”']);

    // Over the lettering, where the card grows around it and holds it.
    const seated = await design({ ...heart, decoratorPlacements: { d1: { offset: { x: 0, y: 0 }, angleDeg: 0 } } });
    expect(seated.loose).toEqual([]);
  }, 30000);
});
