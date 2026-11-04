import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResult, LoginType, UserDetailRow, UserDetails, UserMenu } from '../models';
import { ApiService, sqlString } from '../api/api.service';
import { sidebarMenuNames } from '../menu/menu';
import { MenuService } from '../menu/menu.service';

export type { LoginType } from '../models';

type CredentialReply = 0 | 1 | string;

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly api = inject(ApiService);
  private readonly menuService = inject(MenuService);

  private readonly currentUser = signal<UserDetails | null>(null);
  private readonly allowedMenus = signal<UserMenu[]>([]);
  private readonly licenceChecked = signal(false);

  readonly user = this.currentUser.asReadonly();
  readonly menus = this.allowedMenus.asReadonly();
  readonly licenceReady = this.licenceChecked.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);

  readonly mainMenuNames = computed(() => sidebarMenuNames(this.menus()));

  setLicenceReady(ready: boolean): void {
    this.licenceChecked.set(ready);
    if (!ready) {
      this.clearSession();
    }
  }

  clearSession(): void {
    this.currentUser.set(null);
    this.allowedMenus.set([]);
  }

  async signInUser(loginType: LoginType, username: string, password: string): Promise<boolean> {
    this.clearSession();

    if (!this.licenceReady()) {
      throw new Error('Complete the application licence check before signing in.');
    }
    
    if (username.trim() === '' || password === '') {
      throw new Error('Enter your User ID and Password.');
    }

    const userId = await this.authenticate(loginType, username.trim(), password);
    if (userId === null) {
      return false;
    }

    const user = await this.loadProfile(userId);
    const menus = await this.menuService.loadMenu(loginType, userId);

    this.allowedMenus.set(menus);
    this.currentUser.set(user);
    return true;
  }

  private authenticate(type: LoginType, username: string, password: string): Promise<string | null> {
    switch (type) {
      case 'ESEC LOGIN':
        return this.signInWithEsec(username, password);
      case 'ADMIN':
        return this.signInAsAdmin(password);
      case 'AD LOGIN':
        return this.signInWithActiveDirectory(username, password);
    }
  }

  private async signInWithEsec(username: string, password: string): Promise<string> {
    if (this.api.getSetting('ESEC_LOGIN') !== 'TRUE') {
      throw new Error('ESEC login is not enabled.');
    }
    const userId = withoutDomain(username);

    const userCheck = await firstValueFrom(
      this.api.post<CredentialReply>('check_esec_user', { username: userId }),
    );
    requireAccepted(userCheck, 'Invalid User ID');

    const passwordCheck = await firstValueFrom(
      this.api.post<CredentialReply>('esec_login', { username: userId, password }),
    );
    requireAccepted(passwordCheck, 'Invalid Password');

    return userId;
  }

  private async signInAsAdmin(password: string): Promise<string> {
    const reply = await firstValueFrom(this.api.post<CredentialReply>('admin_login', { password }));
    requireAccepted(reply, 'Invalid User ID / Password');
    return 'ADMIN';
  }

  private async signInWithActiveDirectory(username: string, password: string): Promise<string | null> {
    const result = await firstValueFrom(
      this.api.post<{ type?: string; redirectUrl?: string } | string>('ad_login', { username, password }),
    );
    if (result?.status !== 'PASS') {
      throw new Error('Invalid User ID / Password or AD service unavailable.');
    }

    const reply = result.message;
    if (typeof reply === 'object' && reply?.type === 'AZURE') {
      redirectToAzure(reply.redirectUrl);
      return null;
    }
    return withoutDomain(username);
  }

  private async loadProfile(userId: string): Promise<UserDetails> {
    const fromUser = ` FROM esms.cltx_user WHERE USER_ID = ${sqlString(userId)}`;
    const sql =
      ['USER_ID', 'USER_NAME', 'USER_DEPT', 'USER_STATUS']
        .map((column) => `SELECT '${column}' AS _DESC, ${column} AS _VALUE${fromUser}`)
        .join(' UNION ALL ') + ';';
    console.log('[SQL]: ', sql)
    const result = await firstValueFrom(this.api.query<UserDetailRow[]>(sql));
    if (result?.status !== 'PASS' || !Array.isArray(result.message)) {
      throw new Error('Credentials were accepted, but user details could not be loaded.');
    }

    const rows = result.message;
    const valueOf = (column: string) => String(rows.find((row) => row?._DESC === column)?._VALUE ?? '');
    const user: UserDetails = {
      userId: valueOf('USER_ID'),
      userName: valueOf('USER_NAME'),
      department: valueOf('USER_DEPT'),
      status: valueOf('USER_STATUS'),
    };

    if (user.userId.trim() === '') {
      throw new Error('Credentials were accepted, but no user profile was found in cltx_user.');
    }
    return user;
  }

}

function withoutDomain(username: string): string {
  const name = (username.includes('\\') ? username.split('\\')[1] : username).trim();
  if (name === '') {
    throw new Error('Please enter a valid User ID.');
  }
  return name;
}


function requireAccepted(result: ApiResult<CredentialReply>, rejectedMessage: string): void {
  if (result?.status !== 'PASS') {
    const serverMessage = typeof result?.message === 'string' ? result.message : '';
    throw new Error(serverMessage || 'The server could not complete credential validation.');
  }
  if (result.message === 0) {
    throw new Error(rejectedMessage);
  }
  if (result.message !== 1) {
    throw new Error('The server returned an unexpected authentication response.');
  }
}

function redirectToAzure(redirectUrl: string | undefined): void {
  if (!redirectUrl) {
    throw new Error('The server did not return an Azure sign-in address.');
  }
  const target = new URL(redirectUrl);
  if (target.protocol !== 'https:') {
    throw new Error('The server returned an invalid Azure sign-in address.');
  }
  window.location.assign(target.href);
}
