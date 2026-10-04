import { useShallow } from 'zustand/react/shallow';
import { TextField } from '../../ui/controls/TextField';
import { FontPicker } from '../../ui/controls/FontPicker';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { StandControls } from '../../ui/controls/StandControls';
import { DecoratorControls } from './DecoratorControls';
import { useNameDisplayStore, selectNameDisplayConfig } from './store';
import { useNameDisplayGeometry } from './geometryContext';
import { effectivePocketDepthMm } from './geometry';

const SECTION = 'border-t border-stone-100 dark:border-stone-800 pt-5';

export function NameDisplayControls() {
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const onChange = useNameDisplayStore((s) => s.setConfig);
  const setStandMode = useNameDisplayStore((s) => s.setStandMode);
  const resetNameLetterGaps = useNameDisplayStore((s) => s.resetNameLetterGaps);
  const addDecorator = useNameDisplayStore((s) => s.addDecorator);
  const updateDecorator = useNameDisplayStore((s) => s.updateDecorator);
  const removeDecorator = useNameDisplayStore((s) => s.removeDecorator);
  const setDecoratorAngle = useNameDisplayStore((s) => s.setDecoratorAngle);
  const setDecoratorColor = useNameDisplayStore((s) => s.setDecoratorColor);
  const { assembly, loading, error } = useNameDisplayGeometry();

  const hasCustomGaps = config.nameLetterGapsMm.some((gap) => gap !== 0);
  const pocketDepth = effectivePocketDepthMm(config);
  const pocketCapped = pocketDepth < config.pocketDepthMm;
  // Computed once in the provider's assembly rather than re-running the
  // Clipper intersection on every render of this panel.
  const detached = assembly ? !assembly.overlapsInitial : false;
  const detachedDecoratorIds = assembly ? assembly.decorators.filter((decorator) => !decorator.overlapsInitial).map((decorator) => decorator.id) : [];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <TextField label="Initial" value={config.initial} onChange={(initial) => onChange({ initial: initial.slice(0, 1) })} maxLength={1} placeholder="L" />
          <FontPicker label="Initial font" value={config.initialFontId} onChange={(initialFontId) => onChange({ initialFontId })} previewText={config.initial || 'L'} />
          <SliderField label="Height" value={config.initialHeightMm} onChange={(initialHeightMm) => onChange({ initialHeightMm })} min={60} max={250} />
          <SliderField
            label="Thickness"
            value={config.initialDepthMm}
            onChange={(initialDepthMm) => onChange({ initialDepthMm })}
            min={5}
            max={30}
            step={0.5}
            hint="The initial is the structural piece — it holds the name and keeps the display upright."
          />
          <ColorSwatchPicker value={config.initialColor} onChange={(initialColor) => onChange({ initialColor })} label="Initial color" variant="field" />
        </div>

        <div className={`flex flex-col gap-4 ${SECTION}`}>
          <TextField label="Name" value={config.name} onChange={(name) => onChange({ name })} maxLength={20} placeholder="Liam" />
          <FontPicker label="Name font" value={config.nameFontId} onChange={(nameFontId) => onChange({ nameFontId })} previewText={config.name || 'Liam'} />
          <SliderField label="Width" value={config.nameWidthMm} onChange={(nameWidthMm) => onChange({ nameWidthMm })} min={60} max={300} />
          <SliderField label="Thickness" value={config.nameDepthMm} onChange={(nameDepthMm) => onChange({ nameDepthMm })} min={2} max={15} step={0.5} />
          <SliderField
            label="Angle"
            value={config.nameAngleDeg}
            onChange={(nameAngleDeg) => onChange({ nameAngleDeg })}
            min={-45}
            max={45}
            unit="°"
            hint="Tilts the name across the initial, turning about its own center. The pocket follows it."
          />
          <ColorSwatchPicker value={config.nameColor} onChange={(nameColor) => onChange({ nameColor })} label="Name color" variant="field" />
          <p className="flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
            <span>Drag the name in the preview to move it, or any later letter to close its gap.</span>
            {hasCustomGaps && (
              <button type="button" onClick={resetNameLetterGaps} className="shrink-0 text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
                Reset spacing
              </button>
            )}
          </p>
          {detached && <p className="text-xs text-amber-700 dark:text-amber-400">The name doesn't overlap the initial, so nothing holds it — drag it back over the letter.</p>}
        </div>

        <div className={`flex flex-col gap-3 ${SECTION}`}>
          <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">Inlay</span>
          <p className="text-xs text-stone-400 dark:text-stone-500">The name is recessed into the initial's face, so the two pieces lock together. Print them in different filaments.</p>
          <SliderField
            label="Pocket depth"
            value={config.pocketDepthMm}
            onChange={(pocketDepthMm) => onChange({ pocketDepthMm })}
            min={0}
            max={10}
            step={0.25}
            hint={
              pocketCapped
                ? `Capped at ${pocketDepth.toFixed(2)} mm — it can't exceed the name's thickness or cut through the initial.`
                : `The name stands ${(config.nameDepthMm - pocketDepth).toFixed(2)} mm proud of the initial.`
            }
          />
          <SliderField
            label="Fit clearance"
            value={config.pocketClearanceMm}
            onChange={(pocketClearanceMm) => onChange({ pocketClearanceMm })}
            min={0}
            max={1}
            step={0.05}
            hint="How much larger the pocket is cut than the name, so the printed pieces actually go together."
          />
        </div>

        <DecoratorControls
          className={SECTION}
          decorators={config.decorators}
          placements={config.decoratorPlacements}
          colors={config.decoratorColors}
          fallbackColor={config.nameColor}
          pocketDepthMm={pocketDepth}
          detachedIds={detachedDecoratorIds}
          onAdd={addDecorator}
          onUpdate={updateDecorator}
          onRemove={removeDecorator}
          onChangeAngle={setDecoratorAngle}
          onChangeColor={setDecoratorColor}
        />

        <StandControls
          className={SECTION}
          hint="Applies to the initial — it's the piece that stands. The name needs no foot of its own: the pocket holds it."
          mode={config.standMode}
          onChangeMode={setStandMode}
          railHeightMm={config.railHeightMm}
          onChangeRailHeight={(railHeightMm) => onChange({ railHeightMm })}
          railDepthMm={config.railDepthMm}
          onChangeRailDepth={(railDepthMm) => onChange({ railDepthMm })}
          railSocketDepthMm={config.railSocketDepthMm}
          onChangeRailSocketDepth={(railSocketDepthMm) => onChange({ railSocketDepthMm })}
          trimOffsetMm={config.trimOffsetMm}
          onChangeTrimOffset={(trimOffsetMm) => onChange({ trimOffsetMm })}
          color={config.standColor}
          onChangeColor={(standColor) => onChange({ standColor })}
        />
      </div>

      {/* Only ever present while there is something to say — exporting moved to
          the preview, so an always-on footer would be an empty rule. */}
      {(error || loading) && (
        <div className="mt-auto border-t border-stone-200 dark:border-stone-700 pt-4">
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-500">Generating geometry…</p>
          )}
        </div>
      )}
    </div>
  );
}
