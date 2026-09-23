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
  const setLetterGap = useTopperStore((s) => s.setLetterGap);
  const resetLetterGaps = useTopperStore((s) => s.resetLetterGaps);
  const { picks, loading, error } = useTopperPicks(mainConfig);

  const stick = useMemo(
    () => ({
      lengthMm: config.stickLengthMm,
      widthMm: config.stickWidthMm,
      embedMm: config.stickEmbedMm,
      thicknessMm: config.extrudeDepthMm,
    }),
    [config.stickLengthMm, config.stickWidthMm, config.stickEmbedMm, config.extrudeDepthMm],
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
          onResetLetterGaps={resetLetterGaps}
        />
      }
      main={
        <TopperCanvas
          picks={picks}
          color={config.previewColor}
          stick={stick}
          stickOffsets={config.stickOffsets}
          onStickOffsetCommit={setStickOffset}
          letterGapsMm={config.letterGapsMm}
          onLetterGapCommit={(_pickId, index, gapMm) => setLetterGap(index, gapMm)}
          extrudeDepthMm={config.extrudeDepthMm}
          outlineEnabled={config.outlineEnabled}
          outlineGrowMm={config.outlineGrowMm}
          outlineColor={config.outlineColor}
        />
      }
    />
  );
}

export default App;
