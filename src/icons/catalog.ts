import rawMaterial from './materialIconsCatalog.json';
import rawPhosphor from './phosphorCatalog.json';
import rawEmoji from './notoEmojiCatalog.json';

/**
 * Which icon library an icon comes from.
 *
 * They are kept as separate sets rather than poured into one list because they
 * are separate fonts, and because they are good at different things — see
 * ICON_SETS below.
 */
export type IconSetId = 'material' | 'phosphor' | 'emoji';

/** The set every unqualified icon name belongs to — see `getIcon`. */
const DEFAULT_SET: IconSetId = 'material';

export interface IconSet {
  id: IconSetId;
  /** What the picker's tab says. */
  label: string;
  /** One line on what this set is for, since "which of these do I want" is not answerable from the name alone. */
  blurb: string;
  /** The font it is a glyph of, as fonts/registry.ts knows it. */
  fontId: string;
  /** The CSS class that renders it in the picker, as index.css declares it. */
  className: string;
  /**
   * How wide an ornament from this set starts out, in mm.
   *
   * A set of solid silhouettes reads at any size, but drawn line art is only as
   * printable as its thinnest stroke — so the sets whose icons are drawn rather
   * than filled arrive bigger, where those strokes are wide enough to come out.
   */
  defaultWidthMm: number;
}

export const ICON_SETS: IconSet[] = [
  {
    id: 'material',
    label: 'Material',
    blurb: 'Google’s set. Plain, legible symbols — the widest vocabulary of the three.',
    fontId: 'material-icons',
    className: 'icon-material',
    defaultWidthMm: 25,
  },
  {
    id: 'phosphor',
    label: 'Phosphor',
    blurb: 'Solid, rounded shapes. The chunkiest of the three, and the safest to print small.',
    fontId: 'phosphor-fill',
    className: 'icon-phosphor',
    defaultWidthMm: 25,
  },
  {
    id: 'emoji',
    label: 'Emoji',
    blurb: 'Drawn line art: animals, flowers, star signs, baby things. Finer strokes, so give these a little more width.',
    fontId: 'noto-emoji',
    className: 'icon-emoji',
    defaultWidthMm: 35,
  },
];

/** One icon of one of the self-hosted icon fonts — see scripts/generate-icon-catalog.mjs. */
export interface IconEntry {
  /**
   * How an icon is referred to everywhere outside this module — in a decorator,
   * in a saved project file, in the picker. Qualified by set (`emoji:cat_face`),
   * since the same name means different pictures in different sets.
   */
  id: string;
  set: IconSetId;
  /** The publisher's own name for the icon within its set, which is also what the picker searches. */
  name: string;
  /** Where its glyph lives in the font. Icons are addressed by codepoint rather than by ligature, since reading ligatures back out of GSUB is far more work for the same answer. */
  codepoint: number;
}

interface RawIcon {
  name: string;
  codepoint: number;
}

function load(raw: unknown, set: IconSetId): IconEntry[] {
  return (raw as RawIcon[])
    .map((icon) => ({ id: `${set}:${icon.name}`, set, name: icon.name, codepoint: icon.codepoint }))
    // Generated already sorted by name, but sorted here too so the ordering is a
    // property of this module rather than of whenever the file was last generated.
    .sort((a, b) => a.name.localeCompare(b.name));
}

const CATALOGS: Record<IconSetId, IconEntry[]> = {
  material: load(rawMaterial, 'material'),
  phosphor: load(rawPhosphor, 'phosphor'),
  emoji: load(rawEmoji, 'emoji'),
};

const BY_ID = new Map(ICON_SETS.flatMap((set) => CATALOGS[set.id]).map((icon) => [icon.id, icon]));

/** How many icons a set holds — or, with no set, the lot. For a picker offering to show them all. */
export function iconCount(set?: IconSetId): number {
  return set ? CATALOGS[set].length : BY_ID.size;
}

export function getIconSet(id: IconSetId): IconSet {
  const set = ICON_SETS.find((candidate) => candidate.id === id);
  if (!set) {
    throw new Error(`Unknown icon set: ${id}`);
  }
  return set;
}

/**
 * An icon by its id.
 *
 * A bare name with no set is read as a Material one: that is what every icon id
 * was before there were sets, so it is what a project file written back then
 * means.
 */
export function getIcon(id: string): IconEntry {
  const icon = BY_ID.get(id.includes(':') ? id : `${DEFAULT_SET}:${id}`);
  if (!icon) {
    throw new Error(`Unknown icon: ${id}`);
  }
  return icon;
}

/** The single character that renders this icon, both in the font-backed picker and as the "text" its glyph is built from. */
export function iconChar(id: string): string {
  return String.fromCodePoint(getIcon(id).codepoint);
}

/** The font this icon is a glyph of — what a geometry build has to load to extrude it. */
export function iconFontId(id: string): string {
  return getIconSet(getIcon(id).set).fontId;
}

/** How wide this icon should start out as an ornament — its set's answer; see IconSet.defaultWidthMm. */
export function iconDefaultWidthMm(id: string): number {
  return getIconSet(getIcon(id).set).defaultWidthMm;
}

/** How many results a picker shows before it offers to show the lot. */
export const DEFAULT_RESULT_LIMIT = 90;

/**
 * Searches one set, or all of them, by name.
 *
 * Matches are ranked exact, then prefix, then merely containing, and only
 * within a rank by set and then alphabetically. Ranking has to come first
 * because the sets are so differently sized: grouping by set instead would bury
 * Phosphor's `cat` under every Material name that merely contains "cat", and
 * the thing you typed exactly would be nowhere near the top. Within a rank,
 * keeping a set's icons together matters because a shared prefix means a shared
 * family — `favorite` beside `favorite_border`.
 *
 * With nothing typed there is nothing to rank, so the sets simply follow one
 * another in order, which is what makes browsing read as one style at a time.
 *
 * Capped at `limit` by default, since no one browses five thousand icons at
 * once — but the cap is only a default, and a picker that offers to show
 * everything passes `Infinity` to lift it.
 */
export function searchIcons(query: string, set?: IconSetId, limit: number = DEFAULT_RESULT_LIMIT): IconEntry[] {
  const sets = set ? [set] : ICON_SETS.map((candidate) => candidate.id);
  const normalized = query.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (!normalized) {
    return sets.flatMap((setId) => CATALOGS[setId]).slice(0, limit);
  }

  const exact: IconEntry[] = [];
  const prefix: IconEntry[] = [];
  const substring: IconEntry[] = [];
  for (const setId of sets) {
    for (const icon of CATALOGS[setId]) {
      if (icon.name === normalized) {
        exact.push(icon);
      } else if (icon.name.startsWith(normalized)) {
        prefix.push(icon);
      } else if (icon.name.includes(normalized)) {
        substring.push(icon);
      }
    }
  }
  return [...exact, ...prefix, ...substring].slice(0, limit);
}

/**
 * A handful of icons that suit a name display, offered before the user has
 * searched for anything.
 *
 * Drawn from all three sets on purpose: the first thing the picker shows is also
 * the only hint that there is more than one style to choose from.
 */
export const SUGGESTED_ICONS = [
  'material:favorite',
  'phosphor:star_four',
  'phosphor:cat',
  'phosphor:baby_carriage',
  'emoji:footprints',
  'emoji:teddy_bear',
  'emoji:aries',
  'emoji:cherry_blossom',
  'phosphor:crown_simple',
  'phosphor:butterfly',
  'emoji:straight_ruler',
  'material:cake',
];
