import type { ProductDefinition } from '../types';
import { CakeTopperControls } from './Controls';
import { CakeTopperSceneContent } from './SceneContent';
import { CakeTopperExport } from './ExportAction';
import { CakeTopperProvider } from './Provider';
import { CakeTopperThumbnail } from './Thumbnail';
import { cakeTopperProjectIO } from './project';

export const cakeTopperProduct: ProductDefinition = {
  id: 'cake-topper',
  label: 'Cake Topper',
  tagline: 'A name on picks, to stand in a cake.',
  Thumbnail: CakeTopperThumbnail,
  Controls: CakeTopperControls,
  SceneContent: CakeTopperSceneContent,
  Export: CakeTopperExport,
  Provider: CakeTopperProvider,
  project: cakeTopperProjectIO,
};
