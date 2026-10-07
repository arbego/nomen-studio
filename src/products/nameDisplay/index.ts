import type { ProductDefinition } from '../types';
import { NameDisplayControls } from './Controls';
import { NameDisplaySceneContent } from './SceneContent';
import { NameDisplayExport } from './ExportAction';
import { NameDisplayProvider } from './Provider';
import { NameDisplayWarnings } from './Warnings';
import { LidPreviewButton } from './LidPreviewButton';
import { NameDisplayThumbnail } from './Thumbnail';
import { nameDisplayProjectIO } from './project';
import { nameDisplayHistory } from './store';

export const nameDisplayProduct: ProductDefinition = {
  id: 'name-display',
  label: 'Name Display',
  tagline: 'A big initial with the name inlaid across it.',
  Thumbnail: NameDisplayThumbnail,
  Controls: NameDisplayControls,
  SceneContent: NameDisplaySceneContent,
  Export: NameDisplayExport,
  Warnings: NameDisplayWarnings,
  ViewControls: LidPreviewButton,
  Provider: NameDisplayProvider,
  project: nameDisplayProjectIO,
  history: nameDisplayHistory,
};
