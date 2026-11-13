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

export function shortModuleName(moduleName: string): string {
  const knownShortName = SHORT_NAMES[moduleName.toUpperCase()];
  if (knownShortName) {
    return knownShortName;
  }

  const nameParts = moduleName.trim().split(/\s+/);
  if (nameParts.length > 1) {
    return nameParts.map((part) => part[0]).join('').toUpperCase();
  }
  return moduleName.length > MAX_UNLISTED_LENGTH
    ? moduleName.slice(0, MAX_UNLISTED_LENGTH - 1)
    : moduleName;
}
