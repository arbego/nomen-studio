import type { ComponentType, ReactNode } from 'react';
import type { DesignHistory } from '../store/designHistory';

/**
 * One designable product — a cake topper, a name display, whatever comes next.
 *
 * Deliberately just presentation: a product owns its own config, its own store
 * and its own geometry, and exposes only the two components the shell has to
 * place. Nothing here is generic over a config type, so the shell never has to
 * know any product's shape, and adding a product means adding one entry to the
 * registry rather than touching the shell at all. This mirrors how fonts are
 * registered (see fonts/registry.ts).
 */
/** What a product hands over to be written to a project file. */
export interface ProjectSnapshot {
  /** The design's own name, used for the download's filename. */
  name: string;
  /** The product's config, as plain JSON-safe data. */
  design: unknown;
}

/**
 * Saving and loading a product's design, as plain functions rather than hooks.
 *
 * A product's store is a zustand store, which is readable and writable outside
 * React, so the shell can save or load any product's design from a button that
 * knows nothing about it — including a product that isn't currently open, which
 * is what lets opening a file switch you to the studio it belongs to.
 */
export interface ProductProject {
  snapshot: () => ProjectSnapshot;
  /**
   * Replaces the design with one read from a file. The raw value is whatever
   * was in the file, so an implementation coerces every field rather than
   * trusting it — see project/coerce.ts.
   */
  load: (raw: unknown) => void;
}

export interface ProductDefinition {
  id: string;
  label: string;
  /** One line describing what you get, shown under the label on the picker card. */
  tagline: string;
  /** Inline SVG line-art for the picker card. Drawn in `currentColor` so it inherits the card's hover state. */
  Thumbnail: ComponentType;
  /** The sidebar panel. Reads and writes the product's own store directly. */
  Controls: ComponentType;
  /** Rendered inside the shared StudioCanvas. Reads the product's own store directly. */
  SceneContent: ComponentType;
  /**
   * The export button, pinned over the preview. A component rather than a
   * `() => Blob` because only the product's own hooks can reach its built
   * geometry, and whether there is anything to export yet is part of that.
   */
  Export: ComponentType;
  /**
   * Anything wrong with the design that is about the thing on screen rather than
   * about one control — above all, a part nothing holds (see ui/FloatWarning).
   * Pinned over the preview's bottom-right corner. A component for the same
   * reason `Export` is: only the product's own hooks reach its geometry.
   */
  Warnings?: ComponentType;
  /** Product-specific preview toggles, before the shared bottom-right view buttons. */
  ViewControls?: ComponentType;
  /** Reading and writing this product's designs as project files. */
  project: ProductProject;
  /** Shared undo/redo controller, attached once to the product's config store. */
  history: DesignHistory;
  /**
   * Optional wrapper placed around *both* Controls and SceneContent. They are
   * mounted in separate subtrees (sidebar and canvas), so anything they must
   * share — above all the one async geometry build that feeds both — is hoisted
   * into a provider here instead of being run twice.
   */
  Provider?: ComponentType<{ children: ReactNode }>;
}
