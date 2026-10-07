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
  { id: 'icon-search', message: 'Search decorators by name or keywords like “zodiac” and “kitten”, or browse Material, Phosphor, and Emoji styles.' },
  { id: 'panel-width', message: 'Drag the small handle between the panel and preview to give your controls more room.' },
  { id: 'preview-color', message: 'Preview colors help plan your design. Choose the actual filament colors in your slicer.' },
  { id: 'save-project', message: 'Use Save at the preview’s top right to keep an editable JSON project. Open it from the start page to continue later.' },
  { id: 'save-filename', message: 'When saving, you can change the suggested project filename before the file is written or downloaded.' },
  { id: 'save-status', message: 'Save becomes available when your design differs from the last save or the design you started with.' },
  { id: 'save-before-leaving', message: 'Returning to All products with unsaved changes offers Save and leave, so you can keep an editable copy.' },
  { id: 'share-project', message: 'Use Share next to Save to copy a link that opens an editable copy of your design. No upload is needed.' },
  { id: 'share-snapshot', message: 'A share link captures the design as it is now. Later edits need a new link, and sharing does not mark the project as saved.' },
  { id: 'export-parts', message: 'Export creates a 3MF with named parts, so you can assign their filaments in your slicer.' },
  { id: 'scale-reference', message: 'Use the coin button in the preview to compare your design with a 2 euro coin.' },
  { id: 'reset-view', message: 'The home button returns to the front view and fits the whole design on screen.' },
  { id: 'shadows', message: 'Toggle shadows in the preview to compare the depth of your pieces or inspect their outlines.' },
  { id: 'manual-tips', message: 'Click the lightbulb next to Undo for another tip. It glows orange while a tip is visible.' },
  { id: 'automatic-tips', message: 'Automatic tips include a “Disable automatic tips” checkbox. The choice is remembered, and the lightbulb still shows tips on demand.' },
  { id: 'tip-reading', message: 'Hover over a tip to pause its dismissal timer while you read. Move away to let the timer continue.' },
  { id: 'topper-spacing', productId: 'cake-topper', message: 'Drag a letter in the preview to adjust its gap. Drag the first letter to move the whole line.' },
  { id: 'topper-sticks', productId: 'cake-topper', message: 'Drag a stick in the 3D preview to reposition it under the lettering.' },
  { id: 'topper-backing', productId: 'cake-topper', message: 'A backing card can hold separated letters and decorators together. Grow it until the pieces connect.' },
  { id: 'topper-lines', productId: 'cake-topper', message: 'A cake topper can have up to three lines of lettering, each with its own position.' },
  { id: 'topper-backing-holes', productId: 'cake-topper', message: 'Hold Ctrl and click a hole in the backing card to fill it or reopen it. You can also use the checklist in its controls.' },
  { id: 'display-placement', productId: 'name-display', message: 'Drag the name to move it across the initial, or drag a later letter to adjust its spacing.' },
  { id: 'display-pocket', productId: 'name-display', message: 'Moving or tilting the name also moves its matching inlay pocket.' },
  { id: 'display-overlap', productId: 'name-display', message: 'Keep the name and decorators over the initial so their inlay pockets can hold them in place.' },
  { id: 'display-clearance', productId: 'name-display', message: 'Fit clearance makes the pocket slightly larger than the inlay to help the printed pieces fit together.' },
  { id: 'display-initial-only', productId: 'name-display', message: 'Leave the Name field empty to make an initial on its own, or add decorators without a name.' },
  { id: 'display-thickness', productId: 'name-display', message: 'The initial’s Thickness control goes up to 100 mm in 1 mm steps.' },
  { id: 'display-text-decorators', productId: 'name-display', message: 'Text decorators let you add a date, surname or short phrase, each with its own font and position.' },
  { id: 'display-hollow', productId: 'name-display', message: 'Enable Hollow initial with lid to turn the initial into a storage bowl with a removable lid.' },
  { id: 'display-hollow-colors', productId: 'name-display', message: 'Bowl color and Lid color are independent, so you can plan a different filament for each piece.' },
  { id: 'display-hollow-depth', productId: 'name-display', message: 'For more storage space in a hollow initial, increase the initial’s Thickness. Wall thickness also sets the back floor.' },
  { id: 'display-lid-preview', productId: 'name-display', message: 'Use the lid button at the bottom right, left of the shadow button, to make the lid and inlays 90% transparent. You can inspect the cavity and select the cable hole through them.' },
  { id: 'display-lid-fit', productId: 'name-display', message: 'Lid clearance controls the gap around the lid. Increase it for an easier fit; it is separate from the inlays’ Fit clearance.' },
  { id: 'display-hollow-printing', productId: 'name-display', message: 'Print the hollow bowl back-down and the lid underside-down as separate pieces. The bowl’s 45° ramp supports the lid.' },
  { id: 'display-cable-hole', productId: 'name-display', message: 'Enable Cable hole in the hollow controls to route a light’s cable through the bowl. Set Hole diameter to fit your cable or connector.' },
  { id: 'display-cable-hole-placement', productId: 'name-display', message: 'Click the cable hole to highlight it, then drag it across the back or side walls. Orbit the preview to reach another side.' },
  { id: 'display-cable-hole-reset', productId: 'name-display', message: 'Reset hole position returns the cable hole to a suitable spot near the bottom of the initial’s back.' },
  { id: 'display-cable-hole-warnings', productId: 'name-display', message: 'Cable-hole warnings appear at the preview’s bottom right. If the hole overlaps the floor or lid seat, move it or reduce its diameter.' },
];

export function tipsForProduct(productId: string): StudioTip[] {
  return STUDIO_TIPS.filter((tip) => !tip.productId || tip.productId === productId);
}
