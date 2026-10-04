import type { IconSetId } from '../../icons/catalog';

/**
 * How an icon grid is currently being browsed: what has been typed, which set's
 * tab is on, and whether the result cap has been lifted.
 *
 * Lives apart from IconPicker because its owner is not the picker: a grid can
 * move mid-use — picking the first icon for a new ornament turns the add grid
 * into that ornament's own, which is a different place in the tree and so a
 * different React instance. Held inside the picker, the search and the chosen
 * tab would be thrown away at exactly the moment someone is browsing with them.
 */
export interface IconBrowse {
  query: string;
  /** undefined is the "All" tab. */
  set?: IconSetId;
  showAll: boolean;
}

/** A fresh browse — what a picker opens on. */
export const NEW_ICON_BROWSE: IconBrowse = { query: '', showAll: false };
