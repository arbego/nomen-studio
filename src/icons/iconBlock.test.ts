import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildIconBlock } from './iconBlock';
import { getIcon, iconChar, iconCount, iconFontId, ICON_SETS, loadIconKeywords, searchIcons, SUGGESTED_ICONS } from './catalog';

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

describe('icon sets', () => {
  it('reads a bare name as a Material one, which is what every saved icon used to be', () => {
    // Project files written before there were sets say `favorite`, and have to
    // keep meaning the icon they meant then.
    expect(getIcon('favorite').set).toBe('material');
    expect(getIcon('favorite')).toEqual(getIcon('material:favorite'));
  });

  it('tells apart the same name in two different sets', () => {
    // `star` exists in more than one set and is a different drawing in each,
    // which is the whole reason ids are qualified.
    expect(getIcon('phosphor:star').codepoint).not.toBe(getIcon('material:star').codepoint);
    expect(getIcon('phosphor:star').set).toBe('phosphor');
  });

  it('builds each set from its own font', () => {
    expect(iconFontId('material:favorite')).toBe('material-icons');
    expect(iconFontId('phosphor:cat')).toBe('phosphor-fill');
    expect(iconFontId('emoji:aries')).toBe('noto-emoji');
  });

  it('searches one set at a time, or all of them at once', () => {
    for (const set of ICON_SETS) {
      const results = searchIcons('', set.id, Number.POSITIVE_INFINITY);
      expect(results.length).toBe(iconCount(set.id));
      expect(results.every((icon) => icon.set === set.id)).toBe(true);
    }

    const everything = searchIcons('', undefined, Number.POSITIVE_INFINITY);
    expect(everything.length).toBe(iconCount());
    expect(new Set(everything.map((icon) => icon.set)).size).toBe(ICON_SETS.length);
  });

  it('browses one set at a time, rather than interleaving three styles', () => {
    const results = searchIcons('', undefined, Number.POSITIVE_INFINITY);
    const runs = results.map((icon) => icon.set).filter((set, i, all) => set !== all[i - 1]);
    expect(runs).toEqual([...new Set(runs)]);
  });

  it('puts what you actually typed first, whichever set it is in', () => {
    // Material has 50-odd names merely containing "cat" (`category`,
    // `add_location`); Phosphor has one called exactly that. Grouping by set
    // before ranking would bury it past the end of the first page.
    const results = searchIcons('cat', undefined, Number.POSITIVE_INFINITY);
    expect(results[0].id).toBe('phosphor:cat');
    expect(results.findIndex((icon) => icon.id === 'emoji:cat')).toBeLessThan(results.findIndex((icon) => icon.id === 'material:category'));
  });

  it('finds icons by what they are, not only by what they are called', async () => {
    // Nothing in any set is *named* "zodiac" — it is what Unicode files the
    // star signs under, which is exactly the kind of word someone types.
    expect(searchIcons('zodiac', undefined, Number.POSITIVE_INFINITY)).toHaveLength(0);

    await loadIconKeywords();
    const signs = searchIcons('zodiac', 'emoji', Number.POSITIVE_INFINITY).map((icon) => icon.name);
    for (const sign of ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']) {
      expect(signs, sign).toContain(sign);
    }

    // The same applies across the sets: a word people use, for a thing named
    // something else.
    expect(searchIcons('kitten', undefined, Number.POSITIVE_INFINITY).map((icon) => icon.id)).toContain('phosphor:cat');
    expect(searchIcons('horoscope', 'emoji', Number.POSITIVE_INFINITY).map((icon) => icon.name)).toContain('aries');
  });

  it('ranks a keyword match below every kind of name match', async () => {
    await loadIconKeywords();
    const results = searchIcons('star', undefined, Number.POSITIVE_INFINITY);
    const lastNamed = results.map((icon) => icon.name.includes('star')).lastIndexOf(true);
    const firstKeyword = results.findIndex((icon) => !icon.name.includes('star'));
    // Everything called "star" comes before everything merely tagged with it.
    expect(firstKeyword).toBeGreaterThan(lastNamed);
  });

  it('matches whole keywords, so a word that merely contains the query is not a match', async () => {
    await loadIconKeywords();
    const results = searchIcons('cat', undefined, Number.POSITIVE_INFINITY).map((icon) => icon.id);
    expect(results).toContain('phosphor:cat');
    // Hundreds of icons are tagged "communication", "education" or
    // "notification". Matching those on "cat" would bury every actual cat.
    expect(results).not.toContain('phosphor:address_book');
    expect(results).not.toContain('emoji:backpack');
  });

  it('has the vocabulary a birth-stat letter is actually made of', () => {
    // The things in the reference piece this feature exists for: a star sign, a
    // clock, baby feet, a ruler, an animal. If a set stops carrying these there
    // is no point in it being here.
    for (const id of ['emoji:aries', 'emoji:alarm_clock', 'emoji:footprints', 'emoji:straight_ruler', 'emoji:cat_face', 'phosphor:cat', 'phosphor:baby', 'phosphor:ruler']) {
      expect(() => getIcon(id), id).not.toThrow();
    }
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

  it.each([
    ['material:favorite', 'material'],
    ['phosphor:cat', 'phosphor'],
    ['emoji:aries', 'emoji'],
  ])('builds %s from the %s font, at the width asked for', async (iconName) => {
    // Each set is a different file that has to parse, scale and extrude — the
    // one thing a second and third library could get wrong on its own.
    const block = await buildIconBlock({ id: 'd1', iconName, widthMm: 30, extrudeDepthMm: 4 });
    const box = bounds(block);
    expect(box.max.x - box.min.x).toBeCloseTo(30, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(4, 3);
    expect(block.lines[0].letters[0].contours.length).toBeGreaterThan(0);
  }, 30000);

  it('carries contours for every icon, which is what the pocket boolean cuts from', async () => {
    const block = await buildIconBlock({ id: 'd1', iconName: 'pets', widthMm: 25, extrudeDepthMm: 3 });
    const contours = block.lines[0].letters[0].contours;
    expect(contours.length).toBeGreaterThan(0);
    expect(contours[0].outer.length).toBeGreaterThan(2);
  }, 30000);
});
