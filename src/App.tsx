import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTopperStore, selectTopperConfig, selectMainGeometryConfig } from './store/topperStore';
import { useTopperPicks } from './hooks/useTopperPicks';
import { AppShell } from './ui/Layout/AppShell';
import { ControlsPanel } from './ui/ControlsPanel';
import { TopperCanvas } from './scene/TopperCanvas';

function App() {
  const config = useTopperStore(useShallow(selectTopperConfig));
  const mainConfig = useTopperStore(useShallow(selectMainGeometryConfig));
  const setConfig = useTopperStore((s) => s.setConfig);
  const setStickOffset = useTopperStore((s) => s.setStickOffset);
  const addStick = useTopperStore((s) => s.addStick);
  const removeStick = useTopperStore((s) => s.removeStick);
  const setLineText = useTopperStore((s) => s.setLineText);
  const addLine = useTopperStore((s) => s.addLine);
  const removeLine = useTopperStore((s) => s.removeLine);
  const setLineOffset = useTopperStore((s) => s.setLineOffset);
  const setLetterGap = useTopperStore((s) => s.setLetterGap);
  const resetLetterGaps = useTopperStore((s) => s.resetLetterGaps);
  const toggleClosedOutlineHole = useTopperStore((s) => s.toggleClosedOutlineHole);
  const { picks, loading, error } = useTopperPicks(mainConfig);

  // A stick is embedded into the outline card when there is one, so it reads
  // as (and is sized/colored like) part of that piece rather than the
  // lettering — matches buildTopper.ts's stickThicknessMm, used at export time.
  const stickThicknessMm = config.outlineEnabled ? config.outlineDepthMm : config.extrudeDepthMm;
  const stickColor = config.outlineEnabled ? config.outlineColor : config.previewColor;

  const stick = useMemo(
    () => ({
      lengthMm: config.stickLengthMm,
      widthMm: config.stickWidthMm,
      embedMm: config.stickEmbedMm,
      thicknessMm: stickThicknessMm,
    }),
    [config.stickLengthMm, config.stickWidthMm, config.stickEmbedMm, stickThicknessMm],
  );

  return (
    <AppShell
      sidebar={
        <ControlsPanel
          config={config}
          onChange={setConfig}
          picks={picks}
          loading={loading}
          error={error}
          onAddStick={addStick}
          onRemoveStick={removeStick}
          onChangeLine={setLineText}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onResetLetterGaps={resetLetterGaps}
          onToggleClosedOutlineHole={toggleClosedOutlineHole}
        />
      }
      main={
        <TopperCanvas
          picks={picks}
          color={config.previewColor}
          stick={stick}
          stickColor={stickColor}
          stickOffsets={config.stickOffsets}
          onStickOffsetCommit={setStickOffset}
          letterGapsMm={config.letterGapsMm}
          onLetterGapCommit={(_pickId, lineIndex, gapIndex, gapMm) => setLetterGap(lineIndex, gapIndex, gapMm)}
          lineOffsets={config.lineOffsets}
          onLineOffsetCommit={(_pickId, lineIndex, offset) => setLineOffset(lineIndex, offset)}
          outlineEnabled={config.outlineEnabled}
          outlineGrowMm={config.outlineGrowMm}
          outlineColor={config.outlineColor}
          outlineDepthMm={config.outlineDepthMm}
          closedOutlineHoles={config.closedOutlineHoles}
        />
      }
    />
  );
}

export default App;
