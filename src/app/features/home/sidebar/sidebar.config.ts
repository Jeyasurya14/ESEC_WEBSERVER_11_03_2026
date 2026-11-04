export const MODULE_ICONS: Readonly<Record<string, string>> = {
  'SOFTWARE DASHBOARD': 'software-dashboard',
  'DASHBOARD': 'dashboard',
  'LICENSE': 'key',
  'LICENSE MANAGER': 'key',
  'CLOUD': 'cloud',
  'PROCESS': 'processor',
  'ASSET': 'computer',
  'SOFTWARE REGISTER': 'register',
  'COMPLIANCE': 'compliance',
  'ADMIN': 'settings',
  'ESEC INFO': 'information',
  'SPEND': 'money',
  'SOFTWARE': 'applications',
  'COST': 'money',
  'BILLING': 'money',
  'HPC': 'server',
  'MULTI SITE': 'network',
  'CUSTOM LICENSE': 'custom-license',
  'PLANNER PORTAL': 'planner',
  'SOFTWARE RESERVATION': 'reservation',
  'CHATBOT': 'chatbot',
  'PROJECT PORTAL': 'project',
};

export const DEFAULT_MODULE_ICON = 'folder';

export const LICENSE_MANAGER_MENU = 'LICENSE MANAGER';

export interface LicenseManagerShortcut {
  letter: string;
  title: string;
  screen: string;
}

export const LICENSE_MANAGER_SHORTCUTS: readonly LicenseManagerShortcut[] = [
  { letter: 'B', title: 'Bentley', screen: 'Bentley' },
  { letter: 'S', title: 'Service', screen: 'Service' },
  { letter: 'L', title: 'Logs', screen: 'Logs' },
  { letter: 'O', title: 'Opt File', screen: 'Opt' },
  { letter: 'D', title: 'Denial', screen: 'Denial' },
  { letter: 'E', title: 'Expiry', screen: 'Expiry' },
  { letter: 'C', title: 'Checkout', screen: 'Checkout' },
  { letter: 'F', title: 'Feature', screen: 'Feature' },
  { letter: 'V', title: 'Vendor', screen: 'Vendor' },
];

export const PANEL_HEIGHT_PX = 240;
export const PANEL_BOTTOM_GAP_PX = 8;
