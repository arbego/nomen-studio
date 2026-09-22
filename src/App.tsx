import { useShallow } from 'zustand/react/shallow';
import { useTopperStore, selectTopperConfig } from './store/topperStore';
import { useTopperPicks } from './hooks/useTopperPicks';
import { AppShell } from './ui/Layout/AppShell';
import { ControlsPanel } from './ui/ControlsPanel';
import { TopperCanvas } from './scene/TopperCanvas';

function App() {
  const config = useTopperStore(useShallow(selectTopperConfig));
  const previewColor = useTopperStore((s) => s.previewColor);
  const setConfig = useTopperStore((s) => s.setConfig);
  const setStickOffset = useTopperStore((s) => s.setStickOffset);
  const { picks, loading, error } = useTopperPicks(config);

  return (
    <AppShell
      sidebar={<ControlsPanel config={config} onChange={setConfig} picks={picks} loading={loading} error={error} />}
      main={<TopperCanvas picks={picks} color={previewColor} onPickStickPosition={setStickOffset} />}
    />
  );
}

export default App;
