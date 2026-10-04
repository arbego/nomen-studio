import { useShallow } from 'zustand/react/shallow';
import { slugifyFilename } from '../../export/filename';
import { threeMfBlob } from '../../export/threeMfExport';
import { ExportButton, type ExportFile } from '../../ui/ExportButton';
import { combined3mfBinary } from './export';
import { useNameDisplayGeometry } from './geometryContext';
import { selectNameDisplayConfig, useNameDisplayStore } from './store';

/** One file for the whole design, every piece in it as its own colored part — see export.ts. */
export function NameDisplayExport() {
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const { blocks, assembly, loading, error } = useNameDisplayGeometry();

  const ready = blocks !== null && assembly !== null && !loading && !error;
  const build = ready
    ? (): ExportFile => ({
        blob: threeMfBlob(combined3mfBinary(blocks, assembly, config)),
        filename: `${slugifyFilename(config.name, 'name-display')}-display.3mf`,
      })
    : null;

  return (
    <ExportButton
      build={build}
      // Reachable with a flat cut set high enough to remove every letter, which
      // leaves nothing solid to write — a design problem, not a crash.
      failureMessage="Nothing to export. Check the standing cut isn't above the lettering."
    />
  );
}
