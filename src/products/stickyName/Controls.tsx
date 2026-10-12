import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ControlPane } from '../../ui/controls/ControlPane';
import { TextField } from '../../ui/controls/TextField';
import { FontField } from '../../ui/controls/FontField';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { CollapsibleSection } from '../../ui/controls/CollapsibleSection';
import { selectStickyNameConfig, useStickyNameStore } from './store';
import { useStickyNameGeometry } from './geometryContext';
import { useStickyNameUI } from './uiStore';
import { LETTER_THEMES } from './themes/registry';
import { MAX_LETTERS, MAX_MAGNETS } from './config';

const SECTION = 'border-t border-stone-100 dark:border-stone-800 pt-5';
const HINT = 'text-xs text-stone-500 dark:text-stone-400';

export function StickyNameControls() {
  const config = useStickyNameStore(useShallow(selectStickyNameConfig));
  const setConfig = useStickyNameStore((s) => s.setConfig);
  const setCount = useStickyNameStore((s) => s.setMagnetCount);
  const update = useStickyNameStore((s) => s.updateMagnet);
  const autoPlace = useStickyNameStore((s) => s.autoPlaceMagnets);
  const selected = useStickyNameUI((s) => s.selectedLetter);
  const select = useStickyNameUI((s) => s.select);
  const { result, loading, error } = useStickyNameGeometry();
  const [fontOpen, setFontOpen] = useState(false);
  const [activeMagnet, setActiveMagnet] = useState(0);
  const characters = Array.from(config.name);
  const index = characters[selected] && !/\s/u.test(characters[selected]) ? selected : characters.findIndex((c) => !/\s/u.test(c));
  const letter = result?.letters.find((l) => l.index === index);
  const magnets = config.magnets[index] ?? [];
  const currentMagnet = Math.min(activeMagnet, magnets.length - 1);
  const bounds = letter?.geometry.boundingBox;
  const pad = 3;
  const viewWidth = (letter?.width ?? 45) + pad * 2;
  const viewHeight = (letter?.height ?? 45) + pad * 2;
  return <ControlPane loading={loading} error={error}>
    <div className="flex flex-col gap-5">
      <CollapsibleSection id="sticky-text" title="Name" defaultOpen summary={config.name}>
        <TextField label="Name" value={config.name} onChange={(name) => setConfig({ name })} maxLength={MAX_LETTERS} placeholder="EMMA" />
        <FontField label="Font" value={config.fontId} onChange={(fontId) => setConfig({ fontId })} previewText={config.name || 'EMMA'} open={fontOpen} onOpenChange={setFontOpen} browseKey="sticky-name" />
        <div className="flex flex-wrap gap-2">{[['coiny', 'Coiny'], ['lilita-one', 'Lilita One'], ['calistoga', 'Calistoga']].map(([id, label]) => <button key={id} type="button" className="control-action" aria-pressed={config.fontId === id} onClick={() => setConfig({ fontId: id })}>{label}</button>)}</div>
        <p className={HINT}>Start with a bold, rounded font. Each character becomes a separate printable letter. Editing the name clears magnets; changing font or height repositions them automatically.</p>
      </CollapsibleSection>
      <CollapsibleSection id="sticky-theme" title="Theme" defaultOpen summary="Bubble" className={SECTION}>
        <label className="text-sm text-stone-600 dark:text-stone-400">Style
          <select className="ml-3 rounded border border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-900" value={config.theme} onChange={(e) => setConfig({ theme: e.target.value as 'bubble' })}>
            {LETTER_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
        </label>
        <SliderField label="Bubbliness" value={Math.round(config.bubble.inflation * 100)} min={20} max={100} unit="%" onChange={(value) => setConfig({ bubble: { ...config.bubble, inflation: value / 100 } })} hint="Higher values create a fuller dome across each stroke." />
        <SliderField label="Contour rounding" value={config.bubble.roundnessMm} min={0} max={4} step={0.1} onChange={(roundnessMm) => setConfig({ bubble: { ...config.bubble, roundnessMm } })} />
      </CollapsibleSection>
      <CollapsibleSection id="sticky-size" title="Size" summary={`${config.letterHeightMm} mm letters, ${config.depthMm} mm thick`} className={SECTION}>
        <SliderField label="Letter height" value={config.letterHeightMm} min={20} max={120} onChange={(letterHeightMm) => setConfig({ letterHeightMm })} hint="Based on the font's capital H. Lowercase letters and accents keep their proportions." />
        <SliderField label="Letter thickness" value={config.depthMm} min={4} max={30} step={0.5} onChange={(depthMm) => setConfig({ depthMm })} />
        <SliderField label="Letter spacing" value={config.spacingMm} min={2} max={30} onChange={(spacingMm) => setConfig({ spacingMm })} />
      </CollapsibleSection>
      <ColorSwatchPicker label="Color" value={config.previewColor} onChange={(previewColor) => setConfig({ previewColor })} />
      <CollapsibleSection id="sticky-magnets" title="In-print magnets" defaultOpen summary={`${config.magnets.flat().length} magnets`} className={SECTION}>
        <p className={HINT}>Select a letter here or in the preview. Cavities are sealed into the letter; pause printing to insert magnets before their roofs close.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select letter">{characters.map((char, i) => /\s/u.test(char) ? null : <button key={i} type="button" aria-label={`Edit letter ${i + 1}: ${char}`} aria-pressed={index === i} onClick={() => { select(i); setActiveMagnet(0); }} className={`rounded-lg border px-3 py-2 text-sm ${index === i ? 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100' : 'border-stone-200 dark:border-stone-700'}`}>
          {char}<span className="ml-1 text-xs opacity-50">{i + 1}</span>
        </button>)}</div>
        {index >= 0 && <>
          <SliderField label="Magnet count" value={magnets.length} min={0} max={MAX_MAGNETS} unit="" onChange={(count) => setCount(index, count)} />
          {magnets.length > 0 && <>
            <button type="button" className="control-action self-start" onClick={() => autoPlace(index)}>Auto-place magnets in this letter</button>
            {letter && bounds && <>
              <svg role="img" aria-label={`Magnet positions in letter ${index + 1}: ${characters[index]}`} viewBox={`${bounds.min.x - pad} ${-pad} ${viewWidth} ${viewHeight}`} className="h-48 w-full cursor-crosshair rounded-lg bg-stone-100 dark:bg-stone-800" onPointerDown={(event) => {
                const svg = event.currentTarget;
                const matrix = svg.getScreenCTM();
                if (!matrix || currentMagnet < 0) return;
                const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
                update(index, currentMagnet, { position: { x: Math.round(p.x * 100) / 100, y: Math.round((bounds.max.y - p.y) * 100) / 100 } });
              }}>
                <g transform={`translate(0,${bounds.max.y}) scale(1,-1)`}>
                  <path d={letter.outline} fill={config.previewColor} fillRule="evenodd" />
                  {letter.magnets.map((m, i) => <circle key={i} cx={m.position.x} cy={m.position.y} r={(m.diameterMm + config.clearanceMm) / 2} fill={m.valid ? '#268bb580' : '#e2514580'} stroke={i === currentMagnet ? '#0c4a6e' : '#ffffff'} strokeWidth={0.5} />)}
                </g>
              </svg>
              <p className={HINT}>Front view. Select a magnet below, then click the letter to position it. X runs right, Y runs up from the letter's lower-left corner.</p>
            </>}
            {magnets.map((m, i) => {
              const placed = letter?.magnets[i];
              const position = m.position ?? placed?.position;
              return <fieldset key={i} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <legend className="px-1"><button type="button" aria-pressed={i === currentMagnet} onClick={() => setActiveMagnet(i)} className="control-action">Magnet {i + 1}{i === currentMagnet ? ' · selected' : ''}</button></legend>
                <SliderField label={`Magnet ${i + 1} diameter`} value={m.diameterMm} min={1} max={30} step={0.5} onChange={(diameterMm) => update(index, i, { diameterMm })} />
                <SliderField label={`Magnet ${i + 1} thickness`} value={m.thicknessMm} min={0.5} max={10} step={0.1} onChange={(thicknessMm) => update(index, i, { thicknessMm })} />
                <SliderField label={`Magnet ${i + 1} height above back`} value={m.heightMm} min={0.8} max={30} step={0.1} onChange={(heightMm) => update(index, i, { heightMm })} />
                {position && <>
                  <SliderField label={`Magnet ${i + 1} X`} value={position.x} min={-5} max={Math.max(120, position.x)} step={0.1} onChange={(x) => update(index, i, { position: { ...position, x } })} />
                  <SliderField label={`Magnet ${i + 1} Y`} value={position.y} min={-5} max={Math.max(150, position.y)} step={0.1} onChange={(y) => update(index, i, { position: { ...position, y } })} />
                </>}
                {placed?.message && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{placed.message}</p>}
                {placed?.valid && <p className={HINT}>Cavity roof: {placed.pauseHeightMm.toFixed(2)} mm. Insert before printing the layer that covers this height.</p>}
              </fieldset>;
            })}
          </>}
        </>}
        <SliderField label="Cavity clearance" value={config.clearanceMm} min={0} max={0.6} step={0.05} onChange={(clearanceMm) => setConfig({ clearanceMm })} hint="Added to diameter and thickness. A minimum 0.8 mm shell is checked around every cavity." />
        {result?.warnings.map((warning, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>)}
        <p className={HINT}>The 3MF contains real cavities and roof heights in part names. Set pauses in your slicer and check the roof bridging in its layer preview. Pause commands are not added automatically.</p>
      </CollapsibleSection>
    </div>
  </ControlPane>;
}
