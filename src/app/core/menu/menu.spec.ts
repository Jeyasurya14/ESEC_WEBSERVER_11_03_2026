import { describe, expect, it } from 'vitest';
import { adminMenus, sidebarMenuNames, resolvePermittedMenus } from './menu';

describe('menu permissions', () => {
  const catalog = [
    { RT_M_REF_NO: 1, RT_M_NAME: 'Dashboard', RT_M_LIST: 'Configuration, Department, Report_With_Underscore' },
    { RT_M_REF_NO: 2, RT_M_NAME: 'Admin', RT_M_LIST: 'User, Department' },
  ];

  it('grants only keys that the master menu defines', () => {
    expect(resolvePermittedMenus(catalog, 'DASHBOARD_CONFIGURATION,ADMIN_UNKNOWN')).toEqual([
      { mainMenuName: 'DASHBOARD', subMenuName: 'Configuration' },
    ]);
  });

  it('does not grant a same-named screen in another menu', () => {
    expect(resolvePermittedMenus(catalog, 'DASHBOARD_DEPARTMENT')).toEqual([
      { mainMenuName: 'DASHBOARD', subMenuName: 'Department' },
    ]);
  });

  it('matches keys exactly, without case folding', () => {
    expect(resolvePermittedMenus(catalog, 'dashboard_configuration')).toEqual([]);
  });

  it('keeps underscores inside a screen name', () => {
    const [menu] = resolvePermittedMenus(catalog, 'DASHBOARD_REPORT_WITH_UNDERSCORE');
    expect(menu.subMenuName).toBe('Report_With_Underscore');
  });

  it('grants nothing for an empty list', () => {
    expect(resolvePermittedMenus(catalog, '')).toEqual([]);
  });

  it('limits the admin menu to Admin and Info', () => {
    const groups = new Set(adminMenus().map((menu) => menu.mainMenuName));
    expect([...groups].sort()).toEqual(['ADMIN', 'ESEC INFO']);
  });
});

describe('sidebar menu names', () => {
  const menu = (mainMenuName: string) => ({ mainMenuName, subMenuName: 'Any' });

  it('lists each top-level menu once, in order, with Admin last', () => {
    const menus = [menu('ADMIN'), menu('DASHBOARD'), menu('DASHBOARD'), menu('SOFTWARE')];
    expect(sidebarMenuNames(menus)).toEqual(['DASHBOARD', 'SOFTWARE', 'ADMIN']);
  });

  it('leaves out menus that are reached through the lettered shortcuts', () => {
    const menus = [menu('LICENSE MANAGER'), menu('PLANNER PORTAL'), menu('CLOUD')];
    expect(sidebarMenuNames(menus)).toEqual(['CLOUD']);
  });
});
