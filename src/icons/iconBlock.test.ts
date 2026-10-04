import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildIconBlock } from './iconBlock';
import { getIcon, iconChar, searchIcons, SUGGESTED_ICONS } from './catalog';

function bounds(block: Awaited<ReturnType<typeof buildIconBlock>>): THREE.Box3 {
  const box = new THREE.Box3();
  for (const line of block.lines) {
    for (const letter of line.letters) {
      letter.geometry.computeBoundingBox();
      box.union(letter.geometry.boundingBox!);
    }
  }
  return box;
}

describe('icon catalogue', () => {
  it('resolves an icon to the single character its glyph lives at', () => {
    // The icons live in the private use area, so each is one BMP character.
    expect(iconChar('favorite')).toHaveLength(1);
    expect(iconChar('favorite').codePointAt(0)).toBe(getIcon('favorite').codepoint);
  });

  it('refuses an icon it does not have, rather than building a blank solid', () => {
    expect(() => getIcon('definitely_not_an_icon')).toThrow(/Unknown icon/);
  });

  it('ranks prefix matches above substring matches', () => {
    const results = searchIcons('favorite').map((i) => i.name);
    expect(results[0]).toBe('favorite');
    // `favorite_border` shares the prefix; `add_to_favorites`-style names merely contain it.
    const firstNonPrefix = results.findIndex((name) => !name.startsWith('favorite'));
    if (firstNonPrefix !== -1) {
      expect(results.slice(0, firstNonPrefix).every((name) => name.startsWith('favorite'))).toBe(true);
    }
  });

  it('searches on the names people type, not just the underscored ones', () => {
    expect(searchIcons('music note').map((i) => i.name)).toContain('music_note');
  });

  it('offers something before anything has been typed', () => {
    expect(searchIcons('').length).toBeGreaterThan(0);
    // Every suggestion has to actually exist, or the picker opens on a broken tile.
    for (const name of SUGGESTED_ICONS) expect(() => getIcon(name)).not.toThrow();
  });
});

describe('buildIconBlock', () => {
  it('builds a solid at the width asked for', async () => {
    const block = await buildIconBlock({ id: 'd1', iconName: 'favorite', widthMm: 30, extrudeDepthMm: 4 });
    const box = bounds(block);
    expect(box.max.x - box.min.x).toBeCloseTo(30, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(4, 3);
  }, 30000);

  it('scales with the width it is given', async () => {
    const small = bounds(await buildIconBlock({ id: 'd1', iconName: 'star', widthMm: 20, extrudeDepthMm: 3 }));
    const large = bounds(await buildIconBlock({ id: 'd1', iconName: 'star', widthMm: 60, extrudeDepthMm: 3 }));
    expect(large.max.x - large.min.x).toBeCloseTo(3 * (small.max.x - small.min.x), 1);
    // Thickness is set independently of size, so a bigger icon is not a thicker one.
    expect(large.max.z - large.min.z).toBeCloseTo(small.max.z - small.min.z, 3);
  }, 30000);

  it('keeps the icon roughly square, since the set is drawn on a square grid', async () => {
    const box = bounds(await buildIconBlock({ id: 'd1', iconName: 'favorite', widthMm: 30, extrudeDepthMm: 4 }));
    const height = box.max.y - box.min.y;
    expect(height).toBeGreaterThan(15);
    expect(height).toBeLessThan(45);
  }, 30000);

  it('keeps an icon with a counter hollow, so the pocket is cut hollow too', async () => {
    // `star_border` is an outline: filling its middle in would both print wrong
    // and cut a pocket the real piece could not drop into.
    const block = await buildIconBlock({ id: 'd1', iconName: 'star_border', widthMm: 30, extrudeDepthMm: 4 });
    const contours = block.lines[0].letters[0].contours;
    expect(contours.some((contour) => contour.holes.length > 0)).toBe(true);
  }, 30000);

  it('carries contours for every icon, which is what the pocket boolean cuts from', async () => {
    const block = await buildIconBlock({ id: 'd1', iconName: 'pets', widthMm: 25, extrudeDepthMm: 3 });
    const contours = block.lines[0].letters[0].contours;
    expect(contours.length).toBeGreaterThan(0);
    expect(contours[0].outer.length).toBeGreaterThan(2);
  }, 30000);
});
