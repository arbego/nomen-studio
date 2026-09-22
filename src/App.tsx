import { useTopperStore, selectTopperConfig } from './store/topperStore';
import { useTopperPicks } from './hooks/useTopperPicks';
import { AppShell } from './ui/Layout/AppShell';
import { ControlsPanel } from './ui/ControlsPanel';
import { TopperCanvas } from './scene/TopperCanvas';

function App() {
  const config = useTopperStore(selectTopperConfig);
  const previewColor = useTopperStore((s) => s.previewColor);
  const setConfig = useTopperStore((s) => s.setConfig);
  const { picks, loading, error } = useTopperPicks(config);

  return (
    <AppShell
      sidebar={<ControlsPanel config={config} onChange={setConfig} picks={picks} loading={loading} error={error} />}
      main={<TopperCanvas picks={picks} color={previewColor} />}
    />
  );
}

export default App;
