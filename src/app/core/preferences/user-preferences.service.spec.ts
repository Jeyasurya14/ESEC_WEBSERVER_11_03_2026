import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { LoginService } from '../auth/login.service';
import { UserPreferencesService } from './user-preferences.service';

describe('user preferences', () => {
  function setUp(loadReply: unknown) {
    const api = {
      call: vi.fn(() => (loadReply instanceof Error ? throwError(() => loadReply) : of(loadReply))),
      write: vi.fn(() => of({ status: 'PASS', message: '' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: LoginService, useValue: { user: signal({ userId: 'john' }) } },
      ],
    });
    return { service: TestBed.inject(UserPreferencesService), api };
  }

  const saved = (prefs: object) => ({ status: 'PASS', message: [{ pref: JSON.stringify([prefs]) }] });
  const writtenPreferences = (api: ReturnType<typeof setUp>['api'], call = 0) => {
    const sql = (api.write.mock.calls[call] as unknown as [string])[0];
    return JSON.parse(sql.slice(sql.indexOf(", '") + 3, sql.lastIndexOf("')")).replaceAll("''", "'"))[0];
  };

  it('reads the saved choices the company app stores', async () => {
    const { service, api } = setUp(saved({ range_main: '90', option: 'WP' }));

    expect(await service.load()).toEqual({ range_main: '90', option: 'WP' });
    expect(api.call).toHaveBeenCalledWith("call esms_m.a_user_pref_load('john');");
  });

  it('starts empty when nothing is saved or the load fails, instead of blocking the report', async () => {
    expect(await setUp({ status: 'PASS', message: [] }).service.load()).toEqual({});
    TestBed.resetTestingModule();
    expect(await setUp(new Error('offline')).service.load()).toEqual({});
  });

  it('saves the whole set, keeping keys this app does not use, and never the password', async () => {
    const { service, api } = setUp(saved({ landing_page: 'Dashboard', password: 'secret', option: 'DP' }));

    await service.save({ option: 'WAM' });

    expect(writtenPreferences(api)).toEqual({ landing_page: 'Dashboard', option: 'WAM' });
  });

  it("quotes the saved text, so a feature group named O'Neil cannot break the SQL", async () => {
    const { service, api } = setUp(saved({}));

    await service.save({ my_feature: "O'Neil" });

    expect(api.write.mock.calls[0]).toEqual([
      `call esms_m.a_user_pref_insert('john', '[{"my_feature":"O''Neil"}]');`,
    ]);
  });

  it('writes rapid changes as few saves, ending with the latest choices', async () => {
    const { service, api } = setUp(saved({}));

    await Promise.all([service.save({ option: 'DA' }), service.save({ option: 'WA' }), service.save({ not_expired: 'N' })]);

    expect(api.write.mock.calls.length).toBeLessThan(3);
    expect(writtenPreferences(api, api.write.mock.calls.length - 1)).toEqual({ option: 'WA', not_expired: 'N' });
  });
});
