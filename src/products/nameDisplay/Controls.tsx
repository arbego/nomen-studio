import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TextField } from '../../ui/controls/TextField';
import { FontField } from '../../ui/controls/FontField';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { StandControls } from '../../ui/controls/StandControls';
import { FocusTarget } from '../../ui/FocusTarget';
import { DecoratorControls } from './DecoratorControls';
import { CollapsibleSection } from '../../ui/controls/CollapsibleSection';
import { INITIAL_FOCUS_KEY, NAME_FOCUS_KEY, SECTIONS } from './focus';
import { getFontDefinition } from '../../fonts/registry';
import { STAND_MODE_LABELS } from '../../ui/controls/standModes';
import { useNameDisplayStore, selectNameDisplayConfig } from './store';
import { useNameDisplayGeometry } from './geometryContext';
import { effectivePocketDepthMm } from './geometry';
import { inlayDepthsMm, minimumHollowDepthMm } from './config';
import { DesignInput } from '../../ui/DesignHistory';

const SECTION = 'border-t border-stone-100 dark:border-stone-800 pt-5';

export function NameDisplayControls() {
  // One picker open at a time: two tall search panels at once is exactly what
  // keeping them behind a link avoids.
  const [openFont, setOpenFont] = useState<'initial' | 'name' | null>(null);
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const onChange = useNameDisplayStore((s) => s.setConfig);
  const setStandMode = useNameDisplayStore((s) => s.setStandMode);
  const resetNameLetterGaps = useNameDisplayStore((s) => s.resetNameLetterGaps);
  const addDecorator = useNameDisplayStore((s) => s.addDecorator);
  const updateDecorator = useNameDisplayStore((s) => s.updateDecorator);
  const removeDecorator = useNameDisplayStore((s) => s.removeDecorator);
  const setDecoratorAngle = useNameDisplayStore((s) => s.setDecoratorAngle);
  const setDecoratorColor = useNameDisplayStore((s) => s.setDecoratorColor);
  const showLid = useNameDisplayStore((s) => s.showLid);
  const setShowLid = useNameDisplayStore((s) => s.setShowLid);
  const { assembly, loading, error } = useNameDisplayGeometry();

  const hasName = config.name.trim().length > 0;
  const hasInlays = inlayDepthsMm(config).length > 0;
  const hasCustomGaps = config.nameLetterGapsMm.some((gap) => gap !== 0);
  const pocketDepth = effectivePocketDepthMm(config);
  const pocketCapped = hasInlays && pocketDepth < config.pocketDepthMm;
  // Computed once in the provider's assembly rather than re-running the
  // Clipper intersection on every render of this panel.
  const detached = assembly ? !assembly.heldByInitial : false;
  const detachedDecoratorIds = assembly ? assembly.decorators.filter((decorator) => !decorator.heldByInitial).map((decorator) => decorator.id) : [];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <CollapsibleSection id={SECTIONS.initial} title="Initial" defaultOpen summary={`${config.initial} in ${getFontDefinition(config.initialFontId).family}`}>
          {/* The field alone, not the section: clicking the letter asks what
              that letter is, and washing over everything down to its color
              would say less, not more. Centering the field brings the rest of
              the section with it anyway. */}
          <FocusTarget focusKey={INITIAL_FOCUS_KEY} className="-mx-2 -my-1 px-2 py-1">
            <TextField label="Initial" value={config.initial} onChange={(initial) => onChange({ initial: initial.slice(0, 1) })} maxLength={1} placeholder="L" />
          </FocusTarget>
          <FontField
            label="Initial font"
            value={config.initialFontId}
            onChange={(initialFontId) => onChange({ initialFontId })}
            previewText={config.initial || 'L'}
            open={openFont === 'initial'}
            onOpenChange={(open) => setOpenFont(open ? 'initial' : null)}
          />
          <SliderField label="Height" value={config.initialHeightMm} onChange={(initialHeightMm) => onChange({ initialHeightMm })} min={60} max={250} />
          <SliderField
            label="Thickness"
            value={config.initialDepthMm}
            onChange={(initialDepthMm) => onChange({ initialDepthMm })}
            min={config.hollowEnabled ? Math.ceil(minimumHollowDepthMm(config)) : 5}
            max={100}
            step={1}
            hint={config.hollowEnabled ? 'Includes the floor, storage cavity and lid. Increase this for more space inside.' : 'The initial is the structural piece — it holds the name and keeps the display upright.'}
          />
          {!config.hollowEnabled && <ColorSwatchPicker value={config.initialColor} onChange={(initialColor) => onChange({ initialColor })} label="Initial color" variant="field" />}
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.hollow} title="Hollow initial" summary={config.hollowEnabled ? 'Bowl + lid' : 'Solid'} className={SECTION}>
          <label className="flex items-center justify-between gap-3 text-sm text-stone-600 dark:text-stone-400">
            <span>Hollow initial with lid</span>
            <DesignInput type="checkbox" checked={config.hollowEnabled} onChange={(event) => onChange({ hollowEnabled: event.target.checked })} className="h-4 w-4 accent-stone-800 dark:accent-stone-300" />
          </label>
          {config.hollowEnabled && (
            <>
              <p className="text-xs text-stone-400 dark:text-stone-500">A removable lid sits flush inside the rim on a 45° support ramp. Print the bowl back-down and the lid underside-down as separate pieces.</p>
              <SliderField label="Wall thickness" value={config.wallThicknessMm} onChange={(wallThicknessMm) => onChange({ wallThicknessMm })} min={0.8} max={10} step={0.2} hint="Applies to the bowl's walls and back floor. Narrow strokes stay solid." />
              <SliderField label="Lid thickness" value={config.lidThicknessMm} onChange={(lidThicknessMm) => onChange({ lidThicknessMm })} min={1} max={10} step={0.2} hint="Name and decorator pockets are limited to leave a solid lid underneath." />
              <SliderField label="Lid clearance" value={config.lidClearanceMm} onChange={(lidClearanceMm) => onChange({ lidClearanceMm })} min={0} max={1} step={0.05} hint="The gap all round the lid. Increase it for an easier fit." />
              <ColorSwatchPicker value={config.initialColor} onChange={(initialColor) => onChange({ initialColor })} label="Bowl color" variant="field" />
              <ColorSwatchPicker value={config.lidColor} onChange={(lidColor) => onChange({ lidColor })} label="Lid color" variant="field" />
              <label className="flex items-center justify-between gap-3 text-sm text-stone-600 dark:text-stone-400">
                <span>Show lid in preview</span>
                <input type="checkbox" checked={showLid} onChange={(event) => setShowLid(event.target.checked)} className="h-4 w-4 accent-stone-800 dark:accent-stone-300" />
              </label>
              {assembly?.lidGeometry && <p className="text-xs text-stone-400 dark:text-stone-500">{assembly.cavityDepthMm.toFixed(1)} mm inside from floor to lid. Hiding the lid also hides its lettering in the preview; export includes every part.</p>}
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.name} title="Name" summary={hasName ? config.name : 'No name'} className={SECTION}>
          <FocusTarget focusKey={NAME_FOCUS_KEY} className="-mx-2 -my-1 px-2 py-1">
            <TextField label="Name" value={config.name} onChange={(name) => onChange({ name })} maxLength={20} placeholder="Liam" />
          </FocusTarget>
          <p className="text-xs text-stone-400 dark:text-stone-500">Leave empty for an initial with optional decorators only.</p>
          {hasName && (
            <>
              <FontField
                label="Name font"
                value={config.nameFontId}
                onChange={(nameFontId) => onChange({ nameFontId })}
                previewText={config.name || 'Liam'}
                open={openFont === 'name'}
                onOpenChange={(open) => setOpenFont(open ? 'name' : null)}
              />
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
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.inlay} title="Inlay" summary={hasInlays ? `${pocketDepth.toFixed(2)} mm deep` : 'No inlays'} className={SECTION}>
          <p className="text-xs text-stone-400 dark:text-stone-500">Names and decorators are recessed into the initial's face, so the pieces lock together. Print them in different filaments.</p>
          <SliderField
            label="Pocket depth"
            value={config.pocketDepthMm}
            onChange={(pocketDepthMm) => onChange({ pocketDepthMm })}
            min={0}
            max={10}
            step={0.25}
            hint={
              pocketCapped
                ? `Capped at ${pocketDepth.toFixed(2)} mm — it can't exceed the thinnest inlay or cut through the ${config.hollowEnabled ? 'lid' : 'initial'}.`
                : hasName
                  ? `The name stands ${(config.nameDepthMm - pocketDepth).toFixed(2)} mm proud of the initial.`
                  : hasInlays
                    ? 'Sets how deeply the decorators sit in the initial.'
                    : 'Add a name or decorators to create inlay pockets.'
            }
          />
          <SliderField
            label="Fit clearance"
            value={config.pocketClearanceMm}
            onChange={(pocketClearanceMm) => onChange({ pocketClearanceMm })}
            min={0}
            max={1}
            step={0.05}
            hint="How much larger the inlay pockets and base socket are cut, so the printed pieces actually go together."
          />
        </CollapsibleSection>

        <CollapsibleSection
          id={SECTIONS.decorators}
          title="Decorators"
          summary={config.decorators.length === 0 ? 'None' : `${config.decorators.length}`}
          className={SECTION}
        >
          <DecoratorControls
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
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.standing} title="Standing" summary={STAND_MODE_LABELS[config.standMode]} className={SECTION}>
          <StandControls
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
        </CollapsibleSection>
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
