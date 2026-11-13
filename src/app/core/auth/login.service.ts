import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResult, LoginType, UserDetailRow, UserDetails, UserMenu } from '../models';
import { ApiService, sqlString } from '../api/api.service';
import { sidebarMenuNames } from '../menu/menu';
import { MenuService } from '../menu/menu.service';
import { BrowserStorage, StorageKey } from '../storage/browser-storage.service';

export type { LoginType } from '../models';

type CredentialReply = 0 | 1 | string;

const LOGIN_TYPES: ReadonlySet<LoginType> = new Set(['AD LOGIN', 'ESEC LOGIN', 'ADMIN']);

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly api = inject(ApiService);
  private readonly menuService = inject(MenuService);
  private readonly storage = inject(BrowserStorage);

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

  /** Ends the session and forgets everything remembered in the browser. */
  signOut(): void {
    this.clearSession();
    this.storage.clearOnSignOut();
  }

  /**
   * Picks up the session remembered in the browser after a page reload (user ID and login type,
   * never the password). Returns false, and forgets it, if there is none or it no longer works.
   */
  async restoreSession(): Promise<boolean> {
    const userId = this.storage.getHidden(StorageKey.userId);
    const loginType = this.storage.getHidden(StorageKey.loginType) as LoginType | null;
    if (!userId || !loginType || !LOGIN_TYPES.has(loginType)) {
      return false;
    }

    try {
      await this.startSession(loginType, userId);
      return true;
    } catch {
      this.storage.clearOnSignOut();
      return false;
    }
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

    await this.startSession(loginType, userId);

    // Remember who signed in, so a page reload keeps the session.
    this.storage.setHidden(StorageKey.userId, userId);
    this.storage.setHidden(StorageKey.loginType, loginType);
    if (loginType === 'AD LOGIN') {
      this.storage.setHidden(StorageKey.adUserName, username.trim());
    }
    return true;
  }

  /** Loads the user's profile and menus, then publishes the session; nothing is published if either fails. */
  private async startSession(loginType: LoginType, userId: string): Promise<void> {
    const user = await this.loadProfile(userId);
    const menus = await this.menuService.loadMenu(loginType, userId);

    this.allowedMenus.set(menus);
    this.currentUser.set(user);
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

    await this.checkCredentials('check_esec_user', { username: userId }, 'Invalid User ID');
    await this.checkCredentials(
      'esec_login',
      { username: userId, password },
      'Invalid Password',
    );

    return userId;
  }

  private async signInAsAdmin(password: string): Promise<string> {
    await this.checkCredentials('admin_login', { password }, 'Invalid User ID / Password');
    return 'ADMIN';
  }

  private async checkCredentials(
    endpoint: string,
    body: object,
    rejectedMessage: string,
  ): Promise<void> {
    const credentialResponse = await firstValueFrom(this.api.post<CredentialReply>(endpoint, body));
    requireAccepted(credentialResponse, rejectedMessage);
  }

  private async signInWithActiveDirectory(username: string, password: string): Promise<string | null> {
    const adLoginResponse = await firstValueFrom(
      this.api.post<{ type?: string; redirectUrl?: string } | string>('ad_login', { username, password }),
    );
    if (adLoginResponse?.status !== 'PASS') {
      throw new Error('Invalid User ID / Password or AD service unavailable.');
    }

    const loginDetails = adLoginResponse.message;
    if (typeof loginDetails === 'object' && loginDetails?.type === 'AZURE') {
      redirectToAzure(loginDetails.redirectUrl);
      return null;
    }
    return withoutDomain(username);
  }

  private async loadProfile(userId: string): Promise<UserDetails> {
    const profileSource = `FROM esms.cltx_user WHERE USER_ID = ${sqlString(userId)}`;
    const profileQuery =
      ['USER_ID', 'USER_NAME', 'USER_DEPT', 'USER_STATUS']
        .map((fieldName) => `SELECT '${fieldName}' AS _DESC, ${fieldName} AS _VALUE ${profileSource}`)
        .join(' UNION ALL ') + ';';
    const profileResponse = await firstValueFrom(this.api.query<UserDetailRow[]>(profileQuery));
    if (profileResponse?.status !== 'PASS' || !Array.isArray(profileResponse.message)) {
      throw new Error('Credentials were accepted, but user details could not be loaded.');
    }

    const profileRows = profileResponse.message;
    const profileValue = (fieldName: string) =>
      String(profileRows.find((row) => row?._DESC === fieldName)?._VALUE ?? '');
    const user: UserDetails = {
      userId: profileValue('USER_ID'),
      userName: profileValue('USER_NAME'),
      department: profileValue('USER_DEPT'),
      status: profileValue('USER_STATUS'),
    };

    if (user.userId.trim() === '') {
      throw new Error('Credentials were accepted, but no user profile was found in cltx_user.');
    }
    return user;
  }

}

function withoutDomain(username: string): string {
  const userId = (username.includes('\\') ? username.split('\\')[1] : username).trim();
  if (userId === '') {
    throw new Error('Please enter a valid User ID.');
  }
  return userId;
}


function requireAccepted(
  credentialResponse: ApiResult<CredentialReply>,
  rejectedMessage: string,
): void {
  if (credentialResponse?.status !== 'PASS') {
    const serverMessage =
      typeof credentialResponse?.message === 'string' ? credentialResponse.message : '';
    throw new Error(serverMessage || 'The server could not complete credential validation.');
  }
  if (credentialResponse.message === 0) {
    throw new Error(rejectedMessage);
  }
  if (credentialResponse.message !== 1) {
    throw new Error('The server returned an unexpected authentication response.');
  }
}

function redirectToAzure(redirectUrl: string | undefined): void {
  if (!redirectUrl) {
    throw new Error('The server did not return an Azure sign-in address.');
  }
  const redirectTarget = new URL(redirectUrl);
  if (redirectTarget.protocol !== 'https:') {
    throw new Error('The server returned an invalid Azure sign-in address.');
  }
  window.location.assign(redirectTarget.href);
}
