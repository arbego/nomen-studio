import type * as THREE from 'three';
import { zipStore } from './zip';

/**
 * 3MF, for designs that are more than one piece.
 *
 * STL is a bag of triangles with no notion of an object, so a design made of
 * two pieces arrives as one undifferentiated mesh — and splitting it in a
 * slicer splits by connected shell, which on a pocketed letter means a dozen
 * slabs and loose letters rather than the two pieces anyone meant. 3MF keeps
 * named objects with their own colors, so the pieces arrive as the pieces, in
 * their assembled positions, ready for a filament each.
 */
export interface ThreeMfObject {
  /** Shown in the slicer's object list. */
  name: string;
  /** `#rrggbb`, used as the object's display color. */
  color: string;
  /** In millimeters, already positioned relative to the other objects. */
  geometry: THREE.BufferGeometry;
}

export interface ThreeMfOptions {
  /** Independently printable pieces that a slicer can arrange on the plate. */
  separateModels?: boolean;
  /** Pieces printed in one filament, even when there are many of them. */
  singleFilament?: boolean;
  /** Preserve indexed topology and tiny edges, including coincident tangencies. */
  preserveVertexPrecision?: boolean;
}

const MODEL_PATH = '3D/3dmodel.model';

/**
 * Where PrusaSlicer-derived slicers — Bambu Studio, Orca — look for the names
 * and filament assignments of an object's parts.
 */
const SETTINGS_PATH = 'Metadata/model_settings.config';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/xml"/>
</Types>`;

const RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/${MODEL_PATH}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

/** Shortest exact text for a coordinate, rounded to a tenth of a micron — far finer than any printer, and it keeps the file from doubling in size. */
function mm(value: number): string {
  return String(Math.round(value * 1e4) / 1e4);
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`);
}

/** `#rrggbb` as 3MF wants it: uppercase, with an explicit opaque alpha. */
function displayColor(color: string): string {
  const hex = color.replace('#', '').toUpperCase();
  return `#${hex.length === 6 ? hex : 'CCCCCC'}FF`;
}

/**
 * One object's `<mesh>`, with vertices welded by position.
 *
 * Geometry arriving from combine.ts is non-indexed — every triangle carrying
 * its own three vertices — and 3MF indexes into a vertex list, so welding is
 * what the format wants anyway; it roughly halves the file. An indexed geometry
 * is read through its index rather than straight down the position buffer,
 * which would otherwise silently emit a mesh of nonsense triangles.
 */
function meshXml(geometry: THREE.BufferGeometry, preservePrecision = false): string {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : position.count;
  const cornerAt = (i: number) => (index ? index.getX(i) : i);
  const seen = new Map<string, number>();
  const vertices: string[] = [];
  const triangles: string[] = [];
  const coordinate = preservePrecision ? String : mm;

  function vertexIndex(i: number): number {
    const coordinates = `${coordinate(position.getX(i))} ${coordinate(position.getY(i))} ${coordinate(position.getZ(i))}`;
    // Indexed solid meshes already describe connectivity. Welding coincident
    // vertices can join two tangent surfaces into a non-manifold edge.
    const key = preservePrecision && index ? `vertex-${i}` : coordinates;
    const existing = seen.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const [x, y, z] = coordinates.split(' ');
    const vertexId = vertices.length;
    vertices.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
    seen.set(key, vertexId);
    return vertexId;
  }

  for (let i = 0; i < cornerCount; i += 3) {
    const v1 = vertexIndex(cornerAt(i));
    const v2 = vertexIndex(cornerAt(i + 1));
    const v3 = vertexIndex(cornerAt(i + 2));
    // A triangle whose corners collapsed onto each other encloses no volume and
    // is rejected outright by stricter readers, so it is dropped rather than
    // written out.
    if (v1 === v2 || v2 === v3 || v1 === v3) {
      continue;
    }
    triangles.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`;
}

// Ids are shared across every resource in the file: the materials take 1, each
// piece counts on from there, and the assembly that groups them comes last,
// because 3MF requires an object to be defined before it is referenced.
const MATERIALS_ID = 1;
const partId = (index: number) => MATERIALS_ID + 1 + index;
const assemblyId = (count: number) => partId(count);

/**
 * One object holding the pieces as components, rather than one object per piece.
 *
 * Separate top-level objects are separate *models* to a slicer, which then has
 * to ask whether they are really one thing — Bambu Studio puts up a "multi-part
 * object detected" prompt and, answered wrongly, scatters the pieces across the
 * plate and loses the fit they were exported for. As components of a single
 * object they arrive as one model with named parts, no question asked, each
 * still selectable and assignable to its own filament.
 */
function modelXml(objects: ThreeMfObject[], title: string, options: ThreeMfOptions): string {
  const bases = objects.map((o) => `<base name="${escapeXml(o.name)}" displaycolor="${displayColor(o.color)}"/>`).join('');
  const parts = objects
    .map((o, i) => `<object id="${partId(i)}" type="model" name="${escapeXml(o.name)}" pid="${MATERIALS_ID}" pindex="${i}">${meshXml(o.geometry, options.preserveVertexPrecision)}</object>`)
    .join('');
  // No transform on a component: each piece already carries the coordinates it
  // was designed at, which is what keeps them fitted together.
  const components = objects.map((_, i) => `<component objectid="${partId(i)}"/>`).join('');
  const assembly = options.separateModels ? '' : `<object id="${assemblyId(objects.length)}" type="model" name="${escapeXml(title)}"><components>${components}</components></object>`;
  const build = options.separateModels ? objects.map((_, i) => `<item objectid="${partId(i)}"/>`).join('') : `<item objectid="${assemblyId(objects.length)}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${escapeXml(title)}</metadata>
<metadata name="Application">Nomen Studio</metadata>
<resources><basematerials id="${MATERIALS_ID}">${bases}</basematerials>${parts}${assembly}</resources>
<build>${build}</build>
</model>`;
}

/**
 * The part names and filament assignments, in the dialect PrusaSlicer-derived
 * slicers read. Without it the parts arrive unnamed and all on one filament,
 * which for a design whose whole point is two colors is most of the way back to
 * an STL.
 */
function settingsXml(objects: ThreeMfObject[], title: string, options: ThreeMfOptions): string {
  if (options.separateModels) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${objects.map((o, i) =>
      `<object id="${partId(i)}"><metadata key="name" value="${escapeXml(o.name)}"/><metadata key="extruder" value="${options.singleFilament ? 1 : i + 1}"/><part id="${partId(i)}" subtype="normal_part"><metadata key="name" value="${escapeXml(o.name)}"/><metadata key="extruder" value="${options.singleFilament ? 1 : i + 1}"/></part></object>`,
    ).join('\n')}\n</config>`;
  }
  const parts = objects
    .map(
      (o, i) =>
        `  <part id="${partId(i)}" subtype="normal_part">\n` +
        `    <metadata key="name" value="${escapeXml(o.name)}"/>\n` +
        // One filament per piece, numbered in order — the design is two-color by
        // construction, so it arrives ready to print that way.
        `    <metadata key="extruder" value="${options.singleFilament ? 1 : i + 1}"/>\n` +
        `  </part>\n`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${assemblyId(objects.length)}">
    <metadata key="name" value="${escapeXml(title)}"/>
${parts}  </object>
</config>`;
}

/** A complete .3mf package: the named pieces, each in its own color, as parts of one model. */
export function threeMfBinary(objects: ThreeMfObject[], title: string, options: ThreeMfOptions = {}): Uint8Array {
  const encoder = new TextEncoder();
  return zipStore([
    { path: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { path: '_rels/.rels', data: encoder.encode(RELATIONSHIPS) },
    { path: MODEL_PATH, data: encoder.encode(modelXml(objects, title, options)) },
    { path: SETTINGS_PATH, data: encoder.encode(settingsXml(objects, title, options)) },
  ]);
}

export function threeMfBlob(data: Uint8Array): Blob {
  return new Blob([data as unknown as BlobPart], { type: 'model/3mf' });
}
