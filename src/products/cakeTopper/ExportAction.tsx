import { useShallow } from 'zustand/react/shallow';
import { slugifyFilename } from '../../export/filename';
import { threeMfBlob } from '../../export/threeMfExport';
import { ExportButton, type ExportFile } from '../../ui/ExportButton';
import { combined3mfBinary } from './export';
import { useCakeTopperGeometry } from './geometryContext';
import { selectCakeTopperConfig, useCakeTopperStore } from './store';

/** One file for the whole topper, the lettering and its backing card as two colored parts — see export.ts. */
export function CakeTopperExport() {
  const config = useCakeTopperStore(useShallow(selectCakeTopperConfig));
  const { blocks, loading, error } = useCakeTopperGeometry();

  const block = blocks[0];
  const designName = config.lines.join(' ');
  const build =
    block && !loading && !error
      ? (): ExportFile => ({
          blob: threeMfBlob(combined3mfBinary(block, config, designName)),
          filename: `${slugifyFilename(designName, 'topper')}-topper.3mf`,
        })
      : null;

  return <ExportButton build={build} failureMessage="Nothing to export. Check the lettering isn't empty." />;
}
