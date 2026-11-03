import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppComponent } from '../app.component';
import { ApiService } from '../services/api.service';
import { LoginService } from '../services/login.service';
import { OnstartComponent } from '../onstart/onstart.component';
import { HomeComponent } from '../home/home.component';
import { LoginComponent } from './login.component';

describe('separate screens without URL routing', () => {
  beforeEach(() => {
    const catalog = [{ RT_M_REF_NO: 1, RT_M_NAME: 'Dashboard', RT_M_LIST: 'Configuration' }];
    const profile = [
      { _DESC: 'USER_ID', _VALUE: 'john' },
      { _DESC: 'USER_NAME', _VALUE: 'John' },
      { _DESC: 'USER_STATUS', _VALUE: 'INACTIVE' },
    ];
    const api = {
      centralized: false,
      getSetting: vi.fn().mockImplementation((name: string) => (name === 'ESEC_LOGIN' ? 'TRUE' : '')),
      loadAsset: vi.fn().mockResolvedValue(catalog),
      post: vi.fn().mockReturnValue(of({ status: 'PASS', message: 1 })),
      query: vi.fn().mockImplementation((sql: string) => {
        const message = sql.includes('cltx_user_rt_a') ? [{ RT_A_LIST: 'DASHBOARD_CONFIGURATION' }] : profile;
        return of({ status: 'PASS', message });
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    // Avoid real network startup in these screen-selection tests only.
    vi.spyOn(OnstartComponent.prototype, 'ngOnInit').mockImplementation(() => {});
  });

  it('starts with the licence component without changing the address', () => {
    const url = window.location.href;
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.currentScreen()).toBe('startup');
    expect(fixture.nativeElement.querySelector('app-onstart')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home')).toBeNull();
    expect(window.location.href).toBe(url);
  });

  it('shows a separate login component after the licence check', () => {
    const url = window.location.href;
    const fixture = TestBed.createComponent(AppComponent);
    TestBed.inject(LoginService).setLicenceReady(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home')).toBeNull();
    expect(window.location.href).toBe(url);
  });

  it('replaces login with a separate home component after successful sign-in', async () => {
    const url = window.location.href;
    const fixture = TestBed.createComponent(AppComponent);
    TestBed.inject(LoginService).setLicenceReady(true);
    fixture.detectChanges();
    const login = TestBed.runInInjectionContext(() => {
      return new LoginComponent();
    });
    login.form.setValue({ loginType: 'ESEC LOGIN', username: 'john', password: 'test-password' });
    await login.submitLoginForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-home')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-login')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    const moduleButton = fixture.nativeElement.querySelector('app-sidebar button[aria-label="DASHBOARD"]') as HTMLButtonElement;
    moduleButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sidebar-panel').textContent).toContain('Configuration');
    expect(window.location.href).toBe(url);
    expect(login.form.controls.password.value).toBe('');
  });

  it('returns to login and clears state without changing the address', async () => {
    const url = window.location.href;
    const loginService = TestBed.inject(LoginService);
    loginService.setLicenceReady(true);
    await loginService.signInUser('ESEC LOGIN', 'john', 'password');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const home = TestBed.createComponent(HomeComponent).componentInstance;
    await home.openReport({ mainMenuName: 'ADMIN', subMenuName: 'User' });
    expect(home.selectedMenu()).toBeNull();
    home.returnToLogin();
    fixture.detectChanges();

    expect(loginService.user()).toBeNull();
    expect(loginService.menus()).toEqual([]);
    expect(fixture.nativeElement.querySelector('app-login')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-home')).toBeNull();
    expect(window.location.href).toBe(url);
  });

  it('removes home immediately when licence readiness is cleared', async () => {
    const loginService = TestBed.inject(LoginService);
    loginService.setLicenceReady(true);
    await loginService.signInUser('ESEC LOGIN', 'john', 'password');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    loginService.setLicenceReady(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-home')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-onstart')).not.toBeNull();
  });
});

