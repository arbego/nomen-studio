interface BundleItem {
  type: string;
  modules?: Record<string, { renderedLength: number }>;
}

export function browserPackagePaths(root: string, bundle: Record<string, BundleItem> | BundleItem[]): string[];

export function verifyBrowserLicenses(root: string): {
  name: string;
  configResolved(config: { build: { write: boolean } }): void;
  generateBundle(options: unknown, bundle: Record<string, BundleItem>): void;
};
