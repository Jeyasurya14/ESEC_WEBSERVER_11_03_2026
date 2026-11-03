import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../services/api.service';
import { encryptLicenseDate } from '../services/license.testing';
import { LoginService } from '../services/login.service';
import { OnstartComponent } from './onstart.component';

describe('startup licence gate', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let maintenance: string;

  /** Daily dates relative to today, so the tests never go stale. */
  function inDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function licenceReply(expiry: string) {
    return of({ status: 'PASS', message: [{ ESEC_VALUE: encryptLicenseDate(expiry) }] });
  }

  async function startUp() {
    const component = TestBed.runInInjectionContext(() => new OnstartComponent());
    await component.start();
    return component;
  }

  beforeEach(() => {
    maintenance = 'FALSE';
    api = {
      query: vi.fn().mockReturnValue(licenceReply(inDays(365))),
      loadSettings: vi.fn().mockResolvedValue(undefined),
      getSetting: vi.fn().mockImplementation((name: string) => {
        return name === 'UNDER_MAINTENANCE' ? maintenance : 'Back at noon';
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });

  it('opens the gate for a healthy licence', async () => {
    await startUp();
    expect(TestBed.inject(LoginService).licenceReady()).toBe(true);
  });

  it('blocks an expired licence', async () => {
    api["query"].mockReturnValue(licenceReply(inDays(-1)));
    const component = await startUp();

    expect(component.state()).toEqual({ kind: 'blocked', message: 'License Expired' });
    expect(TestBed.inject(LoginService).licenceReady()).toBe(false);
  });

  it('holds the gate shut until an expiring licence is acknowledged', async () => {
    api["query"].mockReturnValue(licenceReply(inDays(3)));
    const component = await startUp();

    expect(component.state().kind).toBe('renewal-reminder');
    expect(TestBed.inject(LoginService).licenceReady()).toBe(false);

    component.continueAfterReminder();
    expect(TestBed.inject(LoginService).licenceReady()).toBe(true);
  });

  it('blocks when the licence row is missing', async () => {
    api["query"].mockReturnValue(of({ status: 'PASS', message: [] }));
    const component = await startUp();

    expect(component.message()).toBe('Invalid License');
  });

  it('reports a database connection problem', async () => {
    api["query"].mockReturnValue(of({ status: 'FAIL', message: [] }));
    const component = await startUp();

    expect(component.message()).toBe('Database Server - Connection Error');
  });

  it('shows the maintenance message instead of opening the gate', async () => {
    maintenance = 'TRUE';
    const component = await startUp();

    expect(component.state()).toEqual({ kind: 'blocked', message: 'Back at noon' });
    expect(TestBed.inject(LoginService).licenceReady()).toBe(false);
  });

  it('reports configuration failures and allows a retry', async () => {
    api["loadSettings"].mockRejectedValueOnce(new Error('boom'));
    const component = await startUp();
    expect(component.message()).toBe('Unable to load configuration or connect to the Node server.');

    await component.start();
    expect(TestBed.inject(LoginService).licenceReady()).toBe(true);
  });
});
