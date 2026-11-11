import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoginType, MenuDefinition, MenuPermissionRow, UserMenu } from '../models';
import { ApiService, sqlString } from '../api/api.service';
import { adminMenus, resolvePermittedMenus } from './menu';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly api = inject(ApiService);

  async loadMenu(loginType: LoginType, userId: string): Promise<UserMenu[]> {
    if (loginType === 'ADMIN') {
      return adminMenus();
    }

    const catalog = await this.loadCatalog();
    const permissions = await this.loadPermissions(userId);
    return resolvePermittedMenus(catalog, permissions);
  }

  private async loadCatalog(): Promise<MenuDefinition[]> {
    const catalog = this.api.centralized
      ? this.api.centralMenus
      : await this.api.loadAsset<MenuDefinition[]>('assets/menu.json');

    if (!Array.isArray(catalog) || catalog.length === 0) {
      throw new Error('Application menu configuration is missing.');
    }
    return catalog;
  }

  private async loadPermissions(userId: string): Promise<string> {
    const sql = `SELECT RT_A_LIST FROM esms.cltx_user_rt_a WHERE RT_A_ID=${sqlString(userId)}`;
    const result = await firstValueFrom(this.api.query<MenuPermissionRow[]>(sql));

    if (result?.status !== 'PASS' || !Array.isArray(result.message)) {
      throw new Error('User details loaded, but menu permissions could not be loaded.');
    }
    return result.message[0]?.RT_A_LIST ?? '';
  }
}
