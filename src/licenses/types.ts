export interface LicenseComponent {
  id: string;
  name: string;
  version?: string;
  category: string;
  license: string;
  sourceUrl: string;
  description?: string;
  direct?: boolean;
  optional?: boolean;
  noticeIds: string[];
}

export interface LicenseCatalog {
  schemaVersion: number;
  components: LicenseComponent[];
  notices: Record<string, { text: string; source: string }>;
}
