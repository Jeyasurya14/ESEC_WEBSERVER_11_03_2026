import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../core/api/api.service';
import { LoginService } from '../core/auth/login.service';
import { BrowserStorage, StorageKey } from '../core/storage/browser-storage.service';
import { ReportSettingsService, workingHours } from './report-settings.service';

describe('report settings', () => {
  function setUp(settings: Record<string, string>) {
    const api = {
      getSetting: vi.fn((name: string) => settings[name] ?? ''),
      query: vi.fn().mockReturnValue(
        of({
          status: 'PASS',
          message: [
            { _DESC: 'HOUR_START_USAGE', _VALUE: '09:00:00' },
            { _DESC: 'HOUR_END_USAGE', _VALUE: '18:30:00' },
          ],
        }),
      ),
    };
    const user = signal<{ userId: string } | null>({ userId: 'john' });
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: LoginService, useValue: { user } },
      ],
    });
    return { service: TestBed.inject(ReportSettingsService), api, user };
  }

  it('reads band limits and defaults from the app settings, and working hours from the database', async () => {
    const { service } = setUp({
      CBAND_1_VALUE: '40',
      CBAND_2_VALUE: '70',
      DASHBOARD_OPTION_V3: 'WP',
    });

    expect(await service.load()).toMatchObject({
      lowBelow: 40,
      highFrom: 70,
      defaultOption: 'WP',
      workingHoursPerDay: 9.5,
    });
  });

  it('reads the heatmap colour scale from the app settings, falling back to the built-in scale', async () => {
    const { service } = setUp({ HEATMAP_0_50: '#abcdef' });

    const settings = await service.load();
    expect(settings.heatmapColors.from0To50).toBe('#abcdef');
    expect(settings.heatmapColors.at100).toBe('#FF0000'); // not overridden: falls back to the default
  });

  it('keeps copies in the browser and starts the report parameters at their defaults', async () => {
    localStorage.clear();
    const { service } = setUp({ CBAND_1_VALUE: '40', CBAND_2_VALUE: '70' });
    await service.load();

    const stored = (key: StorageKey) => TestBed.inject(BrowserStorage).get(key);
    expect(stored(StorageKey.bandLowBelow)).toBe('40');
    expect(stored(StorageKey.workingHoursPerDay)).toBe('9.5');
    expect(stored(StorageKey.workingHourStart)).toBe('09:00:00');
    expect(stored(StorageKey.licenseHoursPerDay)).toBe('9.5');
    expect(stored(StorageKey.percentile)).toBe('95');
  });

  it('loads once for every report that asks', async () => {
    const { service, api } = setUp({});
    await Promise.all([service.load(), service.load()]);
    expect(api.query).toHaveBeenCalledOnce();
  });

  it('writes the browser copies again after sign-out and a new sign-in, even as the same user', async () => {
    const { service, api, user } = setUp({});
    const storage = TestBed.inject(BrowserStorage);
    await service.load();

    user.set(null);
    storage.clearOnSignOut();
    user.set({ userId: 'john' });
    await service.load();

    expect(api.query).toHaveBeenCalledTimes(2);
    expect(storage.get(StorageKey.workingHourStart)).toBe('09:00:00');
  });

  it('works out working hours, falling back to a full day', () => {
    expect(workingHours('09:00', '17:45')).toBe(8.75);
    expect(workingHours('', '17:00')).toBe(24);
    expect(workingHours('18:00', '09:00')).toBe(24);
  });
});
