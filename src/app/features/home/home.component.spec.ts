import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { LoginService } from '../../core/auth/login.service';

// Test-only view data. Runtime authentication and permissions are unchanged.
describe('reference header and sidebar UI', () => {
  const menus = [
    { mainMenuName: 'DASHBOARD', subMenuName: 'Configuration' },
    { mainMenuName: 'DASHBOARD', subMenuName: 'Department' },
    { mainMenuName: 'LICENSE MANAGER', subMenuName: 'Vendor' },
    { mainMenuName: 'SOFTWARE', subMenuName: 'Actcad' },
    { mainMenuName: 'CUSTOM LICENSE', subMenuName: 'Software' },
  ];
  let signOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signOut = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LoginService,
          useValue: {
            user: signal({
              userId: 'john',
              userName: 'John',
              department: 'Engineering',
              status: 'INACTIVE',
            }),
            menus: signal(menus),
            mainMenuNames: signal(['DASHBOARD', 'SOFTWARE', 'CUSTOM LICENSE']),
            signOut,
          },
        },
      ],
    });
  });

  function createHome() {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  function click(element: HTMLElement, selector: string): void {
    const button = element.querySelector(selector) as HTMLButtonElement;
    button.click();
  }

  it('renders the supplied header title, logo, avatar and module rail', () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.header-title')?.textContent).toBe('License Monitoring System');
    expect(element.querySelector('.logo-image')?.getAttribute('src')).toBe('company_logo.png');
    expect(element.querySelector('.avatar')?.textContent?.trim()).toBe('J');
    expect(element.querySelectorAll('app-sidebar .menu-item')).toHaveLength(3);
    expect(element.querySelector('app-sidebar button[aria-label="ADMIN"]')).toBeNull();
    expect(element.querySelector('.menu-item[aria-label="LICENSE MANAGER"]')).toBeNull();
    expect(element.querySelector('.menu-item[aria-label="SOFTWARE"]')).not.toBeNull();
    expect(element.querySelector('.menu-item[aria-label="CUSTOM LICENSE"]')).not.toBeNull();
  });

  it('opens, filters and selects only the permitted screens in a module', async () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    click(element, 'button[aria-label="DASHBOARD"]');
    fixture.detectChanges();
    const input = element.querySelector('.filter-input') as HTMLInputElement;
    input.value = 'department';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelectorAll('.action-chip')).toHaveLength(1);
    click(element, '.action-chip');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedMenu()?.subMenuName).toBe('Department');
    expect(element.querySelector('#sidebar-panel')).toBeNull();
    expect(element.querySelector('main h1')?.textContent).toContain('Department');
  });

  it('shows an empty filter state and clears it when a module is reopened', () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    click(element, 'button[aria-label="DASHBOARD"]');
    fixture.detectChanges();
    const input = element.querySelector('.filter-input') as HTMLInputElement;
    input.value = 'not-a-report';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.empty-message')?.textContent).toContain('No matching screens');
    click(element, '.close-btn');
    fixture.detectChanges();
    click(element, 'button[aria-label="DASHBOARD"]');
    fixture.detectChanges();
    expect((element.querySelector('.filter-input') as HTMLInputElement).value).toBe('');
  });

  it('closes on Escape and returns focus to the module button', () => {
    const fixture = createHome();
    document.body.appendChild(fixture.nativeElement);
    const button = fixture.nativeElement.querySelector(
      'button[aria-label="DASHBOARD"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#sidebar-panel')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('hides the sidebar with the header control without changing selected permissions', () => {
    const fixture = createHome();
    click(fixture.nativeElement, 'button[aria-label="Toggle sidebar"]');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sidebar')).toBeNull();
    expect(fixture.componentInstance.loginService.menus()).toEqual(menus);
  });

  it('opens the profile and closes it on outside click', () => {
    const fixture = createHome();
    click(fixture.nativeElement, 'button[aria-label="Open user settings"]');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#user-settings')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('#user-settings button')).toHaveLength(4);
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#user-settings')).toBeNull();
  });

  it('keeps unimplemented profile actions explicit and logout uses the existing clear-session flow', () => {
    const fixture = createHome();
    click(fixture.nativeElement, 'button[aria-label="Open user settings"]');
    fixture.detectChanges();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('#user-settings button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('My Feature'))?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.notice()).toContain('not available');
    click(fixture.nativeElement, 'button[aria-label="Open user settings"]');
    fixture.detectChanges();
    const profileButtons = Array.from(
      fixture.nativeElement.querySelectorAll('#user-settings button'),
    ) as HTMLButtonElement[];
    const logout = profileButtons.find((button) => {
      return button.textContent?.trim() === 'Logout';
    }) as HTMLButtonElement;
    logout.click();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('only enables letter shortcuts supported by License Manager permissions', async () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    expect(
      (element.querySelector('.menu-textitem[aria-label="Vendor"]') as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (element.querySelector('.menu-textitem[aria-label="Bentley"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    click(element, '.menu-textitem[aria-label="Vendor"]');
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedMenu()?.subMenuName).toBe('Vendor');
  });

  it('opens and closes the same module with its sidebar button', () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector('button[aria-label="DASHBOARD"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('#sidebar-panel')).not.toBeNull();
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#sidebar-panel')).toBeNull();
  });

  it('closes the panel when clicking outside the sidebar', () => {
    const fixture = createHome();
    click(fixture.nativeElement, 'button[aria-label="DASHBOARD"]');
    fixture.detectChanges();
    click(fixture.nativeElement, 'main h1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#sidebar-panel')).toBeNull();
  });

  it('restores the selected module highlight after hiding and showing the rail', async () => {
    const fixture = createHome();
    const element: HTMLElement = fixture.nativeElement;
    click(element, '.menu-textitem[aria-label="Vendor"]');
    await fixture.whenStable();
    fixture.detectChanges();
    click(element, 'button[aria-label="Toggle sidebar"]');
    fixture.detectChanges();
    click(element, 'button[aria-label="Toggle sidebar"]');
    fixture.detectChanges();
    const moduleButton = element.querySelector('.menu-textitem[aria-label="Vendor"]');
    expect(moduleButton?.classList.contains('selected')).toBe(true);
  });
});
