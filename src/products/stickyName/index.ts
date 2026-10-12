import type { ProductDefinition } from '../types';
import { StickyNameControls } from './Controls';
import { StickyNameSceneContent, StickyNameViewControls, StickyNameWarnings } from './SceneContent';
import { StickyNameProvider } from './Provider';
import { StickyNameExport } from './ExportAction';
import { stickyNameProjectIO } from './project';
import { stickyNameHistory } from './store';
import { StickyNameThumbnail } from './Thumbnail';

export const stickyNameProduct: ProductDefinition = {
  id: 'sticky-name', label: 'Sticky Name', tagline: 'Puffy letters with hidden magnets.',
  Thumbnail: StickyNameThumbnail, Controls: StickyNameControls, SceneContent: StickyNameSceneContent,
  Provider: StickyNameProvider, Export: StickyNameExport, Warnings: StickyNameWarnings,
  ViewControls: StickyNameViewControls, project: stickyNameProjectIO, history: stickyNameHistory,
};
