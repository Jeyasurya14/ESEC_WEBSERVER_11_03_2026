import { apiRequest } from '../api/api-request';
import { Injectable, inject, DestroyRef } from '@angular/core';

import { LoginType, MenuDefinition, MenuPermissionRow, UserMenu } from '../models';
import { ApiService, sqlString } from '../api/api.service';
import { adminMenus, resolvePermittedMenus } from './menu-rules';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly api = inject(ApiService);

  async loadMenu(loginType: LoginType, userId: string): Promise<UserMenu[]> {
    if (loginType === 'ADMIN') {
      return adminMenus();
    }

    const menuCatalog = await this.loadCatalog();
    const permissionList = await this.loadPermissions(userId);
    return resolvePermittedMenus(menuCatalog, permissionList);
  }

  private async loadCatalog(): Promise<MenuDefinition[]> {
    const menuCatalog = this.api.isCentralized
      ? this.api.centralMenus
      : await this.api.loadAsset<MenuDefinition[]>('assets/menu.json');

    if (!Array.isArray(menuCatalog) || menuCatalog.length === 0) {
      throw new Error('Application menu configuration is missing.');
    }
    return menuCatalog;
  }

  private async loadPermissions(userId: string): Promise<string> {
    const permissionQuery = `SELECT RT_A_LIST FROM esms.cltx_user_rt_a WHERE RT_A_ID=${sqlString(userId)}`;
    const permissionResponse = await apiRequest(
      this.api.query<MenuPermissionRow[]>(permissionQuery),
      this.destroyRef,
    );

    if (permissionResponse?.status !== 'PASS' || !Array.isArray(permissionResponse.message)) {
      throw new Error('User details loaded, but menu permissions could not be loaded.');
    }
    return permissionResponse.message[0]?.RT_A_LIST ?? '';
  }
}
