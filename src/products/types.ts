import type { ComponentType, ReactNode } from 'react';

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
   * Optional wrapper placed around *both* Controls and SceneContent. They are
   * mounted in separate subtrees (sidebar and canvas), so anything they must
   * share — above all the one async geometry build that feeds both — is hoisted
   * into a provider here instead of being run twice.
   */
  Provider?: ComponentType<{ children: ReactNode }>;
}
