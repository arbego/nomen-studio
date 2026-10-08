import { useMemo, useState } from 'react';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import type { LicenseCatalog, LicenseComponent } from './types';

const linkClass = 'rounded underline decoration-dotted underline-offset-4 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:hover:text-stone-100';

function ComponentNotices({ component, catalog }: { component: LicenseComponent; catalog: LicenseCatalog }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-3">
      <summary className="w-fit cursor-pointer rounded text-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">License texts and notices</summary>
      {open && component.noticeIds.map((id) => (
        <div key={id} className="mt-4">
          <p className="mb-2 break-words text-xs text-stone-500 dark:text-stone-400">Source: {catalog.notices[id].source}</p>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-stone-100 p-4 text-xs leading-relaxed dark:bg-stone-950">{catalog.notices[id].text}</pre>
        </div>
      ))}
      {open && component.noticeIds.length === 0 && <p className="mt-3 text-sm">License declared by the upstream package. See its source for the full terms and copyright notices.</p>}
    </details>
  );
}

export function LicensePage({ catalog, downloadUrl }: { catalog: LicenseCatalog; downloadUrl: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All components');
  const [limit, setLimit] = useState(40);
  const entries = useMemo(() => {
    const fonts = catalog.components.filter((entry) => entry.category === 'On-demand fonts');
    if (fonts.length === 0) return catalog.components;
    const googleFonts: LicenseComponent = {
      id: 'google-fonts',
      name: 'Google Fonts',
      category: 'On-demand fonts',
      license: [...new Set(fonts.map((font) => font.license))].sort().join(' / '),
      sourceUrl: 'https://github.com/google/fonts#license',
      description: `${fonts.length.toLocaleString()} font families available on demand. Each family has its own license and copyright notices; the full JSON inventory links to those details.`,
      noticeIds: [...new Set(fonts.flatMap((font) => font.noticeIds))],
    };
    return [...catalog.components.filter((entry) => entry.category !== 'On-demand fonts'), googleFonts]
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [catalog]);
  const categories = useMemo(() => [...new Set(entries.map((entry) => entry.category))].sort(), [entries]);
  const filtered = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
      const text = `${entry.name} ${entry.version ?? ''} ${entry.license} ${entry.category}`.toLowerCase();
      return (category === 'All components' || entry.category === category) && words.every((word) => text.includes(word));
    });
  }, [entries, query, category]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-700 dark:bg-stone-950 dark:text-stone-300">
      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-16">
        <header className="mb-10 flex items-center justify-between gap-4">
          <a href={import.meta.env.BASE_URL} className="flex items-center gap-3 rounded font-semibold text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-stone-100">
            <Logo className="h-8 w-auto" /> Nomen Studio
          </a>
          <ThemeToggle />
        </header>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Open-source licenses</h1>
        <p className="mt-4 leading-relaxed">Nomen Studio is built with open-source software, fonts, icons, and data. Thank you to their authors and contributors.</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">This inventory covers software included in the browser app, bundled fonts and icons, catalog data, and fonts available on demand. Upstream links provide additional project and copyright information.</p>
        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <a className={linkClass} href={import.meta.env.BASE_URL}>← Back to studio</a>
          <a className={linkClass} href={downloadUrl} download="open-source-licenses.json">Download inventory (JSON)</a>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Search components or licenses
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(40); }} placeholder="React, OFL-1.1, MIT…" className="min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3 font-normal focus:outline-2 focus:outline-offset-2 dark:border-stone-700 dark:bg-stone-900" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Component type
            <select value={category} onChange={(event) => { setCategory(event.target.value); setLimit(40); }} className="rounded-xl border border-stone-300 bg-white px-4 py-3 font-normal focus:outline-2 focus:outline-offset-2 dark:border-stone-700 dark:bg-stone-900">
              <option>All components</option>
              {categories.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <p role="status" className="my-5 text-sm text-stone-500 dark:text-stone-400">Showing {Math.min(limit, filtered.length)} of {filtered.length} matching entries · {entries.length} total</p>
        <ul className="space-y-3">
          {filtered.slice(0, limit).map((entry) => (
            <li key={entry.id} className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="min-w-0 break-words font-semibold text-stone-900 dark:text-stone-100">{entry.name} {entry.version && <span className="font-normal text-stone-500 dark:text-stone-400">{entry.version}</span>}</h2>
                <span className="rounded bg-stone-100 px-2 py-1 text-xs dark:bg-stone-800">{entry.license}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{entry.category}{entry.direct ? ' · Direct dependency' : ''}{entry.optional ? ' · Optional' : ''}</p>
              {entry.description && <p className="mt-2 text-sm">{entry.description}</p>}
              <a className={`mt-3 inline-block text-sm ${linkClass}`} href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Upstream source ↗</a>
              {entry.id === 'google-fonts' && <a className={`mt-3 block w-fit text-sm ${linkClass}`} href={downloadUrl} download="open-source-licenses.json">Full inventory with per-font details (JSON)</a>}
              <ComponentNotices component={entry} catalog={catalog} />
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="rounded-xl border border-stone-200 p-8 text-center dark:border-stone-800">No matching components. Try another name or license.</p>}
        {filtered.length > limit && <button type="button" onClick={() => setLimit((count) => count + 40)} className="mt-6 w-full rounded-xl border border-stone-300 px-4 py-3 font-medium hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-stone-700 dark:hover:bg-stone-800">Show more components</button>}
      </main>
    </div>
  );
}
