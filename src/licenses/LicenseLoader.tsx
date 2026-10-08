import { useEffect, useState } from 'react';
import catalogUrl from '../../licenses/open-source-licenses.json?url';
import { LicensePage } from './LicensePage';
import type { LicenseCatalog } from './types';

export function LicenseLoader() {
  const [catalog, setCatalog] = useState<LicenseCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(catalogUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LicenseCatalog>;
      })
      .then((data) => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  if (catalog) return <LicensePage catalog={catalog} downloadUrl={catalogUrl} />;
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">Open-source licenses</h1>
      <p role={failed ? 'alert' : 'status'} className="mt-4">{failed ? 'The license inventory could not be loaded.' : 'Loading license inventory…'}</p>
      {failed && <button className="mt-4 rounded border px-4 py-2" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Try again</button>}
      <a className="mt-6 block underline" href={import.meta.env.BASE_URL}>Back to studio</a>
    </main>
  );
}
