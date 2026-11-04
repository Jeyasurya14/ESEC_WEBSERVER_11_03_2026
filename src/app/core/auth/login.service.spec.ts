import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { LoginService } from './login.service';

// Only the server is faked; credential checks, profile and menu logic run for real.
describe('sign-in workflow and session state', () => {
  let loginService: LoginService;
  let permissions: string | null;
  let api: Record<string, ReturnType<typeof vi.fn> | boolean>;

  const profile = [
    { _DESC: 'USER_ID', _VALUE: 'john' },
    { _DESC: 'USER_NAME', _VALUE: 'John' },
    { _DESC: 'USER_DEPT', _VALUE: 'Engineering' },
    { _DESC: 'USER_STATUS', _VALUE: 'INACTIVE' },
  ];
  const catalog = [
    { RT_M_REF_NO: 1, RT_M_NAME: 'Dashboard', RT_M_LIST: 'Configuration' },
    { RT_M_REF_NO: 2, RT_M_NAME: 'Admin', RT_M_LIST: 'User' },
    { RT_M_REF_NO: 3, RT_M_NAME: 'License Manager', RT_M_LIST: 'Bentley' },
  ];

  const post = () => api['post'] as ReturnType<typeof vi.fn>;
  const query = () => api['query'] as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    permissions = 'DASHBOARD_CONFIGURATION';
    api = {
      centralized: false,
      getSetting: vi.fn().mockReturnValue('TRUE'),
      loadAsset: vi.fn().mockResolvedValue(catalog),
      post: vi.fn().mockReturnValue(of({ status: 'PASS', message: 1 })),
      query: vi.fn().mockImplementation((sql: string) => {
        const message = sql.includes('cltx_user_rt_a') ? [{ RT_A_LIST: permissions }] : profile;
        return of({ status: 'PASS', message });
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    loginService = TestBed.inject(LoginService);
    loginService.setLicenceReady(true);
  });

  it('loads user and menus after both ESEC checks, ignoring USER_STATUS for access', async () => {
    expect(await loginService.signInUser('ESEC LOGIN', 'john', 'test-password')).toBe(true);
    expect(post()).toHaveBeenCalledTimes(2);
    expect(loginService.user()?.status).toBe('INACTIVE');
    expect(loginService.isAuthenticated()).toBe(true);
    expect(loginService.menus()).toEqual([{ mainMenuName: 'DASHBOARD', subMenuName: 'Configuration' }]);
  });

  it('hides License Manager from the rail and puts Admin last', async () => {
    permissions = 'ADMIN_USER,LICENSE MANAGER_BENTLEY,DASHBOARD_CONFIGURATION';
    await loginService.signInUser('ESEC LOGIN', 'john', 'password');

    expect(loginService.mainMenuNames()).toEqual(['DASHBOARD', 'ADMIN']);
    expect(loginService.menus()).toContainEqual({ mainMenuName: 'LICENSE MANAGER', subMenuName: 'Bentley' });
  });

  it('does not request profile or menus after password failure', async () => {
    post()
      .mockReturnValueOnce(of({ status: 'PASS', message: 1 }))
      .mockReturnValueOnce(of({ status: 'PASS', message: 0 }));

    await expect(loginService.signInUser('ESEC LOGIN', 'john', 'wrong')).rejects.toThrow('Invalid Password');
    expect(query()).not.toHaveBeenCalled();
    expect(loginService.isAuthenticated()).toBe(false);
  });

  it('requires a licence check before making authentication requests', async () => {
    loginService.setLicenceReady(false);

    await expect(loginService.signInUser('ESEC LOGIN', 'john', 'password')).rejects.toThrow('licence check');
    expect(post()).not.toHaveBeenCalled();
  });

  it('does not publish a partial session when permission loading fails', async () => {
    query().mockImplementation((sql: string) => {
      return of({ status: sql.includes('cltx_user_rt_a') ? 'FAIL' : 'PASS', message: profile });
    });

    await expect(loginService.signInUser('ESEC LOGIN', 'john', 'password')).rejects.toThrow('menu permissions');
    expect(loginService.user()).toBeNull();
    expect(loginService.menus()).toEqual([]);
  });

  it('does not continue when the user profile is missing', async () => {
    query().mockReturnValue(of({ status: 'PASS', message: [] }));

    await expect(loginService.signInUser('ESEC LOGIN', 'john', 'password')).rejects.toThrow('no user profile');
  });

  it('strips the domain prefix and escapes quotes before SQL', async () => {
    await loginService.signInUser('ESEC LOGIN', "COMPANY\\o'brien", 'password');

    expect(post()).toHaveBeenNthCalledWith(1, 'check_esec_user', { username: "o'brien" });
    expect(query().mock.calls[0][0]).toContain("USER_ID = 'o''brien'");
  });

  it('gives Admin the fixed admin menu without reading permissions', async () => {
    await loginService.signInUser('ADMIN', 'admin', 'password');

    expect(loginService.mainMenuNames()).toEqual(['ESEC INFO', 'ADMIN']);
    expect(query().mock.calls.some(([sql]) => String(sql).includes('cltx_user_rt_a'))).toBe(false);
  });

  it('allows an empty permission list without granting any menu', async () => {
    permissions = null;
    await loginService.signInUser('ESEC LOGIN', 'john', 'password');

    expect(loginService.isAuthenticated()).toBe(true);
    expect(loginService.menus()).toEqual([]);
  });

  it('clears the session when the licence is no longer ready', async () => {
    await loginService.signInUser('ESEC LOGIN', 'john', 'password');
    loginService.setLicenceReady(false);

    expect(loginService.user()).toBeNull();
    expect(loginService.menus()).toEqual([]);
  });

  it('surfaces a server rejection as the error message', async () => {
    post().mockReturnValue(of({ status: 'FAIL', message: 'Account locked' }));

    await expect(loginService.signInUser('ESEC LOGIN', 'john', 'password')).rejects.toThrow('Account locked');
  });
});
