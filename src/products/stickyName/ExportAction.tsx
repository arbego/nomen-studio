import { useShallow } from 'zustand/react/shallow';
import { threeMfBlob } from '../../export/threeMfExport';
import { slugifyFilename } from '../../export/filename';
import { ExportButton } from '../../ui/ExportButton';
import { useStickyNameGeometry } from './geometryContext';
import { selectStickyNameConfig, useStickyNameStore } from './store';
import { stickyName3mf } from './export';

export function StickyNameExport() {
  const config = useStickyNameStore(useShallow(selectStickyNameConfig));
  const { result, loading, error } = useStickyNameGeometry();
  return <ExportButton build={result?.canExport && !loading && !error ? () => ({
    blob: threeMfBlob(stickyName3mf(result, config)), filename: `${slugifyFilename(config.name, 'name')}-sticky-name.3mf`,
  }) : null} failureMessage="Enter a name and resolve magnet placement warnings to export." />;
}
