import { useShallow } from 'zustand/react/shallow';
import { FloatWarning } from '../../ui/FloatWarning';
import { PreviewWarning } from '../../ui/PreviewWarning';
import { getIcon } from '../../icons/catalog';
import { useNameDisplayGeometry } from './geometryContext';
import { selectNameDisplayConfig, useNameDisplayStore } from './store';
import type { DecoratorConfig } from './config';

function quote(text: string): string {
  return `“${text}”`;
}

/** An ornament as the panel names it: the symbol's own name, or the words themselves. */
function decoratorLabel(decorator: DecoratorConfig): string {
  return quote(decorator.kind === 'icon' ? getIcon(decorator.iconName).name : decorator.text);
}

/**
 * Loose inlays and cable-hole placement problems in the preview.
 *
 * Read straight off the assembly, which settled it while cutting the pocket from
 * those same regions — so this costs nothing beyond the lookup, and cannot
 * disagree with the recess that was actually cut.
 */
export function NameDisplayWarnings() {
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const { assembly } = useNameDisplayGeometry();
  if (!assembly) {
    return null;
  }

  const adrift = new Set(assembly.decorators.filter((decorator) => !decorator.heldByInitial).map((decorator) => decorator.id));
  const parts = [
    ...(config.name.trim() && !assembly.heldByInitial ? [quote(config.name)] : []),
    ...config.decorators.filter((decorator) => adrift.has(decorator.id)).map(decoratorLabel),
  ];

  const holeWarning = assembly.cableHole?.warning;
  if (parts.length === 0 && !holeWarning) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <FloatWarning parts={parts} remedy="Drag them back over the initial — the recess cut into it is what holds them." />
      {holeWarning && <PreviewWarning message="Cable hole needs adjustment." remedy={holeWarning} />}
    </div>
  );
}
