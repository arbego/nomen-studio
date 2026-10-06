import { describe, expect, it } from 'vitest';
import { rectRegion } from './clipper';
import { loosePieceIds, type SolidPiece } from './connectivity';

/** A slab of a given footprint, spanning the whole depth unless told otherwise — the shape almost every piece of a design is. */
function slab(id: string, minX: number, maxX: number, zRange: readonly [number, number] = [0, 3], extra: Partial<SolidPiece> = {}): SolidPiece {
  return { id, region: rectRegion(minX, 0, maxX, 10), zRange, ...extra };
}

describe('what a design is held together by', () => {
  it('says nothing about a design whose pieces all overlap', () => {
    expect(loosePieceIds([slab('a', 0, 10), slab('b', 9, 20), slab('c', 19, 30)])).toEqual([]);
  });

  it('names the piece standing on its own', () => {
    expect(loosePieceIds([slab('body', 0, 50), slab('crumb', 80, 85)])).toEqual(['crumb']);
  });

  it('keeps the larger group and loses the smaller, rather than the other way round', () => {
    // Nothing is marked as the anchor here, so which group is "the design" is
    // decided by area — the alternative being to report the body as loose from
    // the crumb, which is true and useless.
    const loose = loosePieceIds([slab('crumb', 80, 85), slab('body', 0, 50), slab('more-body', 40, 70)]);
    expect(loose).toEqual(['crumb']);
  });

  it('holds a piece that only reaches the design through another piece', () => {
    // a—b—c in a row, a and c nowhere near each other. All one object once
    // printed, which is what 'chain' means.
    expect(loosePieceIds([slab('a', 0, 10), slab('b', 9, 20), slab('c', 19, 30)], 'chain')).toEqual([]);
  });

  it('counts a bare touch as held, since two walls that meet fuse in the print', () => {
    // Exactly adjacent: an intersection with no tolerance is empty here, and
    // calling this loose would be wrong about every letter resting on a card.
    expect(loosePieceIds([slab('a', 0, 10), slab('b', 10, 20)])).toEqual([]);
    // A gap wider than a nozzle is a gap, though.
    expect(loosePieceIds([slab('a', 0, 10), slab('b', 11, 20)])).toEqual(['b']);
  });

  it('does not call two pieces joined when they pass each other at different depths', () => {
    // Same ground, but one is in front of the other with clear air between — an
    // ornament floating off the front face of the piece it is drawn over.
    expect(loosePieceIds([slab('back', 0, 20, [0, 3]), slab('front', 5, 15, [8, 11])])).toEqual(['front']);
    // Flush against it, which is how an inlay actually seats.
    expect(loosePieceIds([slab('back', 0, 20, [0, 3]), slab('front', 5, 15, [3, 6])])).toEqual([]);
  });

  it('reports nothing for a design that is one piece, or none', () => {
    expect(loosePieceIds([slab('only', 0, 10)])).toEqual([]);
    expect(loosePieceIds([])).toEqual([]);
  });

  it('asks after each separate solid of a piece, not only the piece', () => {
    // A piece is one printed part, not one solid: the dot and the stem of an "i",
    // the flames and the body of a rocket. A solid standing on nothing is loose
    // however firmly the rest of its part is held.
    const stemOnTheBody = rectRegion(10, 0, 15, 10);
    const dotOutInTheOpen = rectRegion(70, 0, 75, 10);
    const letter: SolidPiece = { id: 'i', region: [...stemOnTheBody, ...dotOutInTheOpen], zRange: [0, 3] };
    expect(loosePieceIds([slab('body', 0, 50), letter])).toEqual(['i']);
  });

  it('passes over a piece with no footprint rather than calling it loose', () => {
    // A letter a flat-bottom trim cut away entirely, or an ornament whose text
    // was cleared: not a piece that came off, a piece that isn't there.
    expect(loosePieceIds([slab('body', 0, 50), { id: 'nothing', region: [], zRange: [0, 3] }])).toEqual([]);
  });

  it('names a piece once however many of its parts are loose', () => {
    const loose = loosePieceIds([slab('body', 0, 50), slab('card', 80, 85), slab('card', 90, 95)]);
    expect(loose).toEqual(['card']);
  });
});

describe('pieces that are assembled rather than fused', () => {
  it('wants every piece seated on the anchor itself, not on each other', () => {
    // b is on the initial; c is only on b. Fused, c would be held; inlaid, c is
    // a separate print resting against another separate print, which holds
    // nothing at all.
    const pieces = [slab('initial', 0, 50, [0, 12], { anchor: true }), slab('name', 40, 70, [9, 14]), slab('ornament', 60, 80, [9, 14])];
    expect(loosePieceIds(pieces, 'anchor')).toEqual(['ornament']);
    // The very same design, printed as one fused object, holds.
    expect(loosePieceIds(pieces, 'chain')).toEqual([]);
  });

  it('lets a piece carry the parts of itself that hang off, since they print fused', () => {
    // Two solids of one piece, close enough to fuse but not overlapping — a
    // script name whose letters meet, cantilevered off the initial. The same two
    // as separate pieces are two prints resting on each other, which is the case
    // above.
    const initial = slab('initial', 0, 50, [0, 12], { anchor: true });
    const seated = rectRegion(30, 0, 60, 10);
    const overhanging = rectRegion(60.02, 0, 90, 10);
    // One piece is one printed part, however many solids it is made of.
    const asOnePart: SolidPiece = { id: 'name', region: [...seated, ...overhanging], zRange: [9, 14] };
    expect(loosePieceIds([initial, asOnePart], 'anchor')).toEqual([]);

    // The same two solids printed as two parts are two pieces resting on each
    // other, and the far one is seated on nothing.
    const asTwoParts: SolidPiece[] = [
      { id: 'name', region: seated, zRange: [9, 14] },
      { id: 'ornament', region: overhanging, zRange: [9, 14] },
    ];
    expect(loosePieceIds([initial, ...asTwoParts], 'anchor')).toEqual(['ornament']);
  });

  it('holds every piece that does reach the anchor', () => {
    const pieces = [slab('initial', 0, 50, [0, 12], { anchor: true }), slab('name', 20, 45, [9, 14]), slab('ornament', 5, 15, [9, 14])];
    expect(loosePieceIds(pieces, 'anchor')).toEqual([]);
  });

  it('declines to answer when there is no anchor to be loose from', () => {
    expect(loosePieceIds([slab('a', 0, 10), slab('b', 80, 90)], 'anchor')).toEqual([]);
  });

  it('takes the anchor as the design even when it is the smaller piece', () => {
    // 'chain' with an anchor present follows the anchor rather than the area: a
    // marked piece is an answer, and the area rule is only a guess in its
    // absence.
    expect(loosePieceIds([slab('post', 0, 5, [0, 3], { anchor: true }), slab('slab', 40, 90)], 'chain')).toEqual(['slab']);
  });
});
