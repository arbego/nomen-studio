import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCakeTopperBlocks, buildCakeTopperDecorators, decoratorOutlineContours, letteringGeometry, mergedBlockGeometry } from './geometry';
import { detectOutlineHoleCandidates } from '../../geometry/outline';
import type { CakeTopperConfig } from './config';
import { combined3mfBinary, printObjects } from './export';
import { slugifyFilename } from '../../export/filename';

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
  outlineEnabled: false,
  outlineGrowMm: 3,
  outlineColor: '#f7f5f2',
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},
};

function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

async function block(overrides: Partial<CakeTopperConfig> = {}) {
  const merged = { ...config, ...overrides };
  const blocks = await buildCakeTopperBlocks(merged);
  return { block: blocks[0], config: merged };
}

describe('what the cake topper puts in the file', () => {
  it('exports the lettering as one piece, its sticks merged into it', async () => {
    // The sticks print in the same filament and are embedded in the letters
    // rather than sitting beside them, so they are not a part of their own.
    const { block: word, config: used } = await block();
    const objects = printObjects(word, used);

    expect(objects.map((o) => o.name)).toEqual(['Lettering']);
    expect(objects[0].color).toBe('#f0c6d0');
    expect(triangleCount(objects[0].geometry)).toBe(triangleCount(mergedBlockGeometry(word, used)));
  }, 30000);

  it('adds the backing card as a second piece, in its own color', async () => {
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const objects = printObjects(word, used);

    expect(objects.map((o) => o.name)).toEqual(['Lettering', 'Backing card']);
    expect(objects[1].color).toBe('#f7f5f2');
    // The card is grown out from under the letters, so it is wider than they are.
    objects.forEach((o) => o.geometry.computeBoundingBox());
    expect(objects[1].geometry.boundingBox!.min.x).toBeLessThan(objects[0].geometry.boundingBox!.min.x);
  }, 30000);

  it('hands the sticks to the backing card once there is one, and not to the lettering', async () => {
    // A stick is cut to the card's thickness and sunk into it, and the preview
    // already shows it in the card's filament. Left in the lettering it would be
    // a lettering-colored part buried inside a card-colored one.
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const [lettering, card] = printObjects(word, used);
    [lettering, card].forEach((o) => o.geometry.computeBoundingBox());

    // The lettering now stops where the letters do; the stick's 70mm reaches far
    // below either of them, and it is the card that carries it.
    const letters = letteringGeometry(word, used);
    letters.computeBoundingBox();
    expect(lettering.geometry.boundingBox!.min.y).toBeCloseTo(letters.boundingBox!.min.y, 5);
    expect(card.geometry.boundingBox!.min.y).toBeLessThan(letters.boundingBox!.min.y - 40);
    expect(triangleCount(lettering.geometry)).toBe(triangleCount(letters));
    // And the stick's own triangles are in the card part: the same design with
    // no picks on it writes a smaller card.
    const [, pickless] = printObjects(word, { ...used, stickOffsets: { word: [] } });
    expect(triangleCount(card.geometry)).toBeGreaterThan(triangleCount(pickless.geometry));
  }, 30000);

  it('still merges them into the lettering when there is no card to take them', async () => {
    const { block: word, config: used } = await block();
    const [lettering] = printObjects(word, used);
    lettering.geometry.computeBoundingBox();
    const letters = letteringGeometry(word, used);
    letters.computeBoundingBox();
    // Without a card the lettering is the only piece there is, so the sticks
    // belong to it — and reach well below the letters.
    expect(lettering.geometry.boundingBox!.min.y).toBeLessThan(letters.boundingBox!.min.y - 40);
  }, 30000);

  it('stands the lettering on the card rather than burying the card inside it', async () => {
    // Sharing a back face put the card's whole thickness inside the letters —
    // two parts in two filaments in the same volume, for the slicer to resolve
    // by part order. Seated, every layer belongs to one part.
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const [lettering, card] = printObjects(word, used);
    [lettering, card].forEach((o) => o.geometry.computeBoundingBox());

    expect(card.geometry.boundingBox!.min.z).toBeCloseTo(0, 5);
    expect(card.geometry.boundingBox!.max.z).toBeCloseTo(used.outlineDepthMm, 5);
    // The card's front face is the lettering's back face: they meet across it,
    // which is contact enough to fuse, and share no volume at all.
    expect(lettering.geometry.boundingBox!.min.z).toBeCloseTo(used.outlineDepthMm, 5);
    expect(lettering.geometry.boundingBox!.max.z).toBeCloseTo(used.outlineDepthMm + used.extrudeDepthMm, 5);
  }, 30000);

  it('keeps the sticks within the card they are sunk into', async () => {
    // They are cut to its thickness, so carrying them cannot make the card part
    // any deeper than the card.
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const card = printObjects(word, used)[1];
    card.geometry.computeBoundingBox();
    expect(card.geometry.boundingBox!.max.z).toBeCloseTo(used.outlineDepthMm, 5);
  }, 30000);

  it('leaves the lettering on the bed when there is no card under it', async () => {
    const { block: word, config: used } = await block();
    const [lettering] = printObjects(word, used);
    lettering.geometry.computeBoundingBox();
    expect(lettering.geometry.boundingBox!.min.z).toBeCloseTo(0, 5);
  }, 30000);

  it('leaves the card out entirely when it is switched off, rather than exporting an empty part', async () => {
    const { block: word, config: used } = await block();
    expect(printObjects(word, used)).toHaveLength(1);
  }, 30000);

  it('exports the letter-gap overrides, not the natural layout', async () => {
    const { block: word, config: used } = await block();
    const tightened = { ...used, letterGapsMm: [[-5, 0, 0]] };

    const natural = combined3mfBinary(word, used, 'Emma');
    const moved = combined3mfBinary(word, tightened, 'Emma');
    // Same letters and stick, just moved: the same mesh, written differently.
    expect(moved.length).not.toBe(0);
    expect(moved).not.toEqual(natural);
    expect(triangleCount(printObjects(word, tightened)[0].geometry)).toBe(triangleCount(printObjects(word, used)[0].geometry));
  }, 30000);

  it('writes a package carrying both part names', async () => {
    // Entries are stored rather than deflated, so the text is in the bytes
    // verbatim — enough to confirm end to end that the pieces reached the file.
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const text = new TextDecoder().decode(combined3mfBinary(word, used, 'Emma'));

    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('3D/3dmodel.model');
    expect(text).toContain('value="Lettering"');
    expect(text).toContain('value="Backing card"');
    expect(text).toContain('value="Emma"');
  }, 30000);
});

describe('slugifyFilename', () => {
  it('lowercases, strips accents/punctuation, and hyphenates', () => {
    expect(slugifyFilename('Emma-6')).toBe('emma-6');
    expect(slugifyFilename('  Théo!! ')).toBe('th-o');
  });

  it('falls back to the caller-supplied name for an empty/unusable one', () => {
    // The cake topper passes 'topper' (see ExportButtons); each product names its own fallback.
    expect(slugifyFilename('', 'topper')).toBe('topper');
    expect(slugifyFilename('!!!', 'topper')).toBe('topper');
    expect(slugifyFilename('')).toBe('design');
  });
});

describe('ornaments on a topper', () => {
  const decorated: CakeTopperConfig = {
    ...config,
    decorators: [{ id: 'd1', iconName: 'star', widthMm: 20, depthMm: 3 }],
    decoratorPlacements: { d1: { offset: { x: 30, y: 25 }, angleDeg: 0 } },
    decoratorColors: { d1: '#b7c4ac' },
  };

  it('prints each one as its own named part, in its own filament', async () => {
    const [block] = await buildCakeTopperBlocks(decorated);
    const decorators = await buildCakeTopperDecorators(decorated);

    const objects = printObjects(block, decorated, decorators);
    const ornament = objects[objects.length - 1];
    expect(objects).toHaveLength(2); // the lettering, and the one ornament
    expect(ornament.name).toBe('star');
    expect(ornament.color).toBe('#b7c4ac');
    expect(ornament.geometry.getAttribute('position').count).toBeGreaterThan(0);
  }, 30000);

  it('puts it where it was dragged, by exactly how far it was dragged', async () => {
    const [block] = await buildCakeTopperBlocks(decorated);
    const atRest = { ...decorated, decoratorPlacements: { d1: { offset: { x: 0, y: 0 }, angleDeg: 0 } } };

    const centreOf = async (config: CakeTopperConfig) => {
      const placed = printObjects(block, config, await buildCakeTopperDecorators(config))[1].geometry;
      placed.computeBoundingBox();
      const box = placed.boundingBox!;
      return { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, minZ: box.min.z, maxZ: box.max.z };
    };

    const before = await centreOf(atRest);
    const after = await centreOf(decorated);

    // An offset moves the ornament from where it would naturally sit — it does
    // not teleport its centre to the offset, the same as the name's does.
    expect(after.x - before.x).toBeCloseTo(30, 4);
    expect(after.y - before.y).toBeCloseTo(25, 4);
    // Seated on the same back face as the letters and the card, so a thinner
    // ornament sits flush at the back rather than floating inside the piece.
    expect(after.minZ).toBeCloseTo(0, 5);
    expect(after.maxZ).toBeCloseTo(3, 5);
  }, 30000);

  it('falls back to the lettering filament for one never given a colour of its own', async () => {
    const uncoloured = { ...decorated, decoratorColors: {} };
    const [block] = await buildCakeTopperBlocks(uncoloured);
    const decorators = await buildCakeTopperDecorators(uncoloured);

    expect(printObjects(block, uncoloured, decorators)[1].color).toBe(uncoloured.previewColor);
  }, 30000);
});

describe('the backing card and an ornament', () => {
  const carded: CakeTopperConfig = {
    ...config,
    outlineEnabled: true,
    outlineGrowMm: 4,
    decorators: [{ id: 'd1', iconName: 'star', widthMm: 20, depthMm: 3 }],
    // Just off the end of the lettering, so the card has to reach out to it.
    decoratorPlacements: { d1: { offset: { x: 70, y: 20 }, angleDeg: 0 } },
    decoratorColors: {},
  };

  it('grows the card around the ornament, not only around the letters', async () => {
    const [block] = await buildCakeTopperBlocks(carded);
    const decorators = await buildCakeTopperDecorators(carded);

    const withOrnament = printObjects(block, carded, decorators).find((o) => o.name === 'Backing card')!.geometry;
    const lettersOnly = printObjects(block, { ...carded, decorators: [] }, []).find((o) => o.name === 'Backing card')!.geometry;
    withOrnament.computeBoundingBox();
    lettersOnly.computeBoundingBox();

    // The card now reaches out past where the lettering alone would have taken
    // it — which is what holds a piece placed off the end of the word.
    expect(withOrnament.boundingBox!.max.x).toBeGreaterThan(lettersOnly.boundingBox!.max.x);
  }, 30000);

  it('stands the ornament on the card too, not half-sunk into it', async () => {
    const [block] = await buildCakeTopperBlocks(carded);
    const decorators = await buildCakeTopperDecorators(carded);
    const ornament = printObjects(block, carded, decorators).find((o) => o.name === 'star')!.geometry;
    ornament.computeBoundingBox();

    expect(ornament.boundingBox!.min.z).toBeCloseTo(carded.outlineDepthMm, 5);
    expect(ornament.boundingBox!.max.z).toBeCloseTo(carded.outlineDepthMm + carded.decorators[0].depthMm, 5);
  }, 30000);

  it('leaves an ornament solid, however the card is grown around it', async () => {
    // A gap inside a symbol is part of the drawing, not somewhere anyone meant
    // to see through the piece — so it is never offered in the checklist and
    // never left open in the card.
    const ringed: CakeTopperConfig = { ...carded, decorators: [{ id: 'd1', iconName: 'favorite_border', widthMm: 30, depthMm: 3 }] };
    const [block] = await buildCakeTopperBlocks(ringed);
    const decorators = await buildCakeTopperDecorators(ringed);
    const contours = decoratorOutlineContours(decorators, ringed);

    const candidates = detectOutlineHoleCandidates(block, ringed.letterGapsMm, ringed.lineOffsets, ringed.outlineGrowMm, contours);
    const ornamentBounds = new THREE.Box2().setFromPoints(contours.flatMap((c) => [...c]));
    for (const candidate of candidates) {
      const centre = new THREE.Vector2(
        candidate.points.reduce((sum, p) => sum + p.x, 0) / candidate.points.length,
        candidate.points.reduce((sum, p) => sum + p.y, 0) / candidate.points.length,
      );
      expect(ornamentBounds.containsPoint(centre), `${candidate.char} hole sits inside the ornament`).toBe(false);
    }
  }, 30000);
});
