import { MenuDefinition, UserMenu } from '../models';

export function resolvePermittedMenus(
  catalog: MenuDefinition[],
  permissionList: string,
): UserMenu[] {
  const permittedKeys = new Set(permissionList.split(','));
  const permitted: UserMenu[] = [];
  const seen = new Set<string>();

  for (const menu of catalog) {
    const mainMenuName = menu.RT_M_NAME.trim().toUpperCase();

    for (const screenName of menu.RT_M_LIST.split(',')) {
      const subMenuName = screenName.trim();
      const permissionKey = `${mainMenuName}_${subMenuName.toUpperCase()}`;

      if (subMenuName !== '' && permittedKeys.has(permissionKey) && !seen.has(permissionKey)) {
        seen.add(permissionKey);
        permitted.push({ mainMenuName, subMenuName });
      }
    }
  }
  return permitted;
}

const ADMIN_SCREENS = [
  'Access Control',
  'User',
  'License',
  'Department Summary 1',
  'Teamcenter',
  'Cloud',
  'Agent',
  'Agent Install',
  'Cluster',
  'Multi Site',
  'Software Inventory',
  'Software Register',
  'Software Register 1',
  'Software Register 2',
  'Software Register 3',
  'Software Register 4',
  'Holiday',
  'HoneyWell',
  'ESEC Preferences',
  'Software Harvest',
  'Software Compliance',
  'Data Process',
  'Software Register 1 Cost',
  'Spend',
];

const INFO_SCREENS = ['Esec Query', 'Training Material', 'About'];


export function adminMenus(): UserMenu[] {
  return [
    ...ADMIN_SCREENS.map((subMenuName) => ({ mainMenuName: 'ADMIN', subMenuName })),
    ...INFO_SCREENS.map((subMenuName) => ({ mainMenuName: 'ESEC INFO', subMenuName })),
  ];
}


const MENUS_WITHOUT_SIDEBAR_ICON = new Set([
  'LICENSE MANAGER',
  'PLANNER PORTAL',
  'PROJECT PORTAL',
  'SOFTWARE RESERVATION',
]);

export function sidebarMenuNames(menus: UserMenu[]): string[] {
  const menuNames: string[] = [];

  for (const { mainMenuName } of menus) {
    const isAlreadyListed = menuNames.includes(mainMenuName);
    const hasNoSidebarIcon = MENUS_WITHOUT_SIDEBAR_ICON.has(mainMenuName);
    if (!isAlreadyListed && !hasNoSidebarIcon) {
      menuNames.push(mainMenuName);
    }
  }

  const nonAdminMenuNames = menuNames.filter((menuName) => menuName !== 'ADMIN');
  const includesAdminMenu = nonAdminMenuNames.length < menuNames.length;

  return includesAdminMenu ? [...nonAdminMenuNames, 'ADMIN'] : nonAdminMenuNames;
}
