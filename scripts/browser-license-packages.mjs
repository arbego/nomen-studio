import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Packages that contribute code to emitted chunks, including lazy chunks. */
export function browserPackagePaths(root, bundle) {
  const paths = new Set();
  const prefix = `${root.replaceAll('\\', '/')}/node_modules/`;
  for (const chunk of Object.values(bundle)) {
    if (chunk.type !== 'chunk') continue;
    for (const [moduleId, info] of Object.entries(chunk.modules)) {
      if (info.renderedLength === 0) continue;
      const id = moduleId.replaceAll('\\', '/');
      const start = id.indexOf(prefix);
      if (start < 0) continue;
      const path = id.slice(start + prefix.length - 'node_modules/'.length)
        .match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/)?.[1];
      if (path) paths.add(path);
    }
  }
  return [...paths].sort();
}

/** Verify real production builds; inventory generation uses write: false. */
export function verifyBrowserLicenses(root) {
  let verify = false;
  return {
    name: 'verify-browser-licenses',
    configResolved(config) { verify = config.build.write; },
    generateBundle(_options, bundle) {
      if (!verify) return;
      const catalog = JSON.parse(readFileSync(resolve(root, 'licenses/open-source-licenses.json'), 'utf8'));
      if (JSON.stringify(catalog.bundledPackages) !== JSON.stringify(browserPackagePaths(root, bundle))) {
        throw new Error('Browser dependencies changed. Run npm run licenses:catalog and review the inventory.');
      }
    },
  };
}
