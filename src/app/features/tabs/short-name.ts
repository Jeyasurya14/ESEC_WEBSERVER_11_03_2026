const SHORT_NAMES: Readonly<Record<string, string>> = {
  DASHBOARD: 'Dash',
  'SOFTWARE DASHBOARD': 'SW Dash',
  COST: 'Cost',
  BILLING: 'Bill',
  'MY REPORTS': 'My Rpt',
  LICENSE: 'Lic',
  'ADDON LICENSE': 'Ad Lic',
  'CUSTOM LICENSE': 'CLic',
  'LICENSE MANAGER': 'LM',
  CLOUD: 'Cloud',
  PROCESS: 'Process',
  ASSET: 'Asset',
  COMPLIANCE: 'Comp',
  SOFTWARE: 'SW',
  'SOFTWARE REGISTER': 'Reg',
  HPC: 'HPC',
  'MULTI SITE': 'Multi',
  SPEND: 'Spend',
  PROJECT: 'Prj',
  CONCURRENT: 'CC',
  ADMIN: 'Adm',
  'EXCLUSIVE REPORT': 'Ex Rpt',
  'ESEC INFO': 'Info',
};

const MAX_UNLISTED_LENGTH = 5;

export function shortModuleName(name: string): string {
  const known = SHORT_NAMES[name.toUpperCase()];
  if (known) {
    return known;
  }

  const words = name.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((word) => word[0]).join('').toUpperCase();
  }
  return name.length > MAX_UNLISTED_LENGTH ? name.slice(0, MAX_UNLISTED_LENGTH - 1) : name;
}
