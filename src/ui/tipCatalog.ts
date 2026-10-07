export interface StudioTip {
  id: string;
  message: string;
  /** Omitted for tips that apply to every product. */
  productId?: string;
}

/** Hints about existing editor features, kept together so wording and product scope are easy to review. */
export const STUDIO_TIPS: readonly StudioTip[] = [
  { id: 'preview-controls', message: 'Click a part in the 3D preview to jump to its controls in the left panel.' },
  { id: 'undo', message: 'Try an edit freely: Ctrl+Z or ⌘Z undoes the last design change.' },
  { id: 'redo', message: 'Ctrl+Shift+Z or ⌘⇧Z brings back an edit you just undid.' },
  { id: 'font-arrows', message: 'In the font selector, use Up and Down to try the previous or next font.' },
  { id: 'font-preview', message: 'Font search results preview your own text, so you can compare styles before choosing.' },
  { id: 'icon-search', message: 'Search decorators by name, or browse Material, Phosphor, and Emoji for different icon styles.' },
  { id: 'panel-width', message: 'Drag the small handle between the panel and preview to give your controls more room.' },
  { id: 'preview-color', message: 'Preview colors help plan your design. Choose the actual filament colors in your slicer.' },
  { id: 'save-project', message: 'Save project keeps an editable JSON file. Open it from the start page to continue later.' },
  { id: 'export-parts', message: 'Export creates a 3MF with named parts, so you can assign their filaments in your slicer.' },
  { id: 'scale-reference', message: 'Use the coin button in the preview to compare your design with a 2 euro coin.' },
  { id: 'reset-view', message: 'The home button returns to the front view and fits the whole design on screen.' },
  { id: 'shadows', message: 'Toggle shadows in the preview to compare the depth of your pieces or inspect their outlines.' },
  { id: 'topper-spacing', productId: 'cake-topper', message: 'Drag a letter in the preview to adjust its gap. Drag the first letter to move the whole line.' },
  { id: 'topper-sticks', productId: 'cake-topper', message: 'Drag a stick in the 3D preview to reposition it under the lettering.' },
  { id: 'topper-backing', productId: 'cake-topper', message: 'A backing card can hold separated letters and decorators together. Grow it until the pieces connect.' },
  { id: 'topper-lines', productId: 'cake-topper', message: 'A cake topper can have up to three lines of lettering, each with its own position.' },
  { id: 'display-placement', productId: 'name-display', message: 'Drag the name to move it across the initial, or drag a later letter to adjust its spacing.' },
  { id: 'display-pocket', productId: 'name-display', message: 'Moving or tilting the name also moves its pocket in the initial.' },
  { id: 'display-overlap', productId: 'name-display', message: 'Keep the name and decorators over the initial: the pockets cut into it are what hold them.' },
  { id: 'display-clearance', productId: 'name-display', message: 'Fit clearance makes the pocket slightly larger than the inlay to help the printed pieces fit together.' },
];

export function tipsForProduct(productId: string): StudioTip[] {
  return STUDIO_TIPS.filter((tip) => !tip.productId || tip.productId === productId);
}
