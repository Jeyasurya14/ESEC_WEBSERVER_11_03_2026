import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { LoginService } from '../auth/login.service';
import { UserPreferencesService } from './user-preferences.service';

describe('user preferences', () => {
  function setUp(loadReply: unknown) {
    const user = signal({ userId: 'john' });
    const api = {
      call: vi.fn(() => (loadReply instanceof Error ? throwError(() => loadReply) : of(loadReply))),
      write: vi.fn((_sql: string) => of({ status: 'PASS', message: '' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: LoginService, useValue: { user } },
      ],
    });
    return { service: TestBed.inject(UserPreferencesService), api, user };
  }

  const saved = (prefs: object) => ({
    status: 'PASS',
    message: [{ pref: JSON.stringify([prefs]) }],
  });
  const writtenPreferences = (api: ReturnType<typeof setUp>['api'], call = 0) => {
    const sql = api.write.mock.calls[call][0];
    return JSON.parse(
      sql.slice(sql.indexOf(", '") + 3, sql.lastIndexOf("')")).replaceAll("''", "'"),
    )[0];
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
    const { service, api } = setUp(
      saved({ landing_page: 'Dashboard', password: 'secret', option: 'DP' }),
    );

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

    await Promise.all([
      service.save({ option: 'DA' }),
      service.save({ option: 'WA' }),
      service.save({ not_expired: 'N' }),
    ]);

    expect(api.write.mock.calls.length).toBeLessThan(3);
    expect(writtenPreferences(api, api.write.mock.calls.length - 1)).toEqual({
      option: 'WA',
      not_expired: 'N',
    });
  });

  it('does not overwrite saved preferences when the initial load fails', async () => {
    const { service, api } = setUp(new Error('offline'));
    await service.save({ option: 'DP' });
    expect(api.write).not.toHaveBeenCalled();
    expect(await service.load()).toEqual({ option: 'DP' });
  });

  it('keeps writes sequential and coalesces edits made while a request is pending', async () => {
    const { service, api } = setUp(saved({ landing_page: 'Dashboard' }));
    const firstReply = new Subject<{ status: string; message: string }>();
    const nextReply = new Subject<{ status: string; message: string }>();
    api.write.mockReturnValueOnce(firstReply).mockReturnValueOnce(nextReply);
    let firstFinished = false;
    let editsFinished = false;
    const first = service.save({ option: 'DA' }).then(() => {
      firstFinished = true;
    });
    await vi.waitFor(() => expect(api.write).toHaveBeenCalledTimes(1));
    const edits = Promise.all([
      service.save({ option: 'WA' }),
      service.save({ not_expired: 'N' }),
    ]).then(() => {
      editsFinished = true;
    });
    await Promise.resolve();
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(writtenPreferences(api)).toEqual({ landing_page: 'Dashboard', option: 'DA' });
    firstReply.next({ status: 'PASS', message: '' });
    firstReply.complete();
    await vi.waitFor(() => expect(api.write).toHaveBeenCalledTimes(2));
    expect(firstFinished).toBe(false);
    expect(editsFinished).toBe(false);
    expect(writtenPreferences(api, 1)).toEqual({
      landing_page: 'Dashboard',
      option: 'WA',
      not_expired: 'N',
    });
    nextReply.next({ status: 'PASS', message: '' });
    nextReply.complete();
    await Promise.all([first, edits]);
    expect(firstFinished && editsFinished).toBe(true);
    expect(api.write).toHaveBeenCalledTimes(2);
  });

  it('does not lose an edit arriving as the previous request finishes', async () => {
    const { service, api } = setUp(saved({}));
    const reply = new Subject<{ status: string; message: string }>();
    api.write.mockReturnValueOnce(reply);
    const first = service.save({ option: 'DP' });
    await vi.waitFor(() => expect(api.write).toHaveBeenCalledTimes(1));
    reply.next({ status: 'PASS', message: '' });
    reply.complete();
    const last = service.save({ option: 'WP' });
    await Promise.all([first, last]);
    expect(api.write).toHaveBeenCalledTimes(2);
    expect(writtenPreferences(api, 1)).toEqual({ option: 'WP' });
  });

  it('releases a failed writer and retries all current choices on the next edit', async () => {
    const { service, api } = setUp(saved({ landing_page: 'Dashboard' }));
    api.write.mockReturnValueOnce(throwError(() => new Error('offline')));
    await service.save({ option: 'WP' });
    await service.save({ not_expired: 'N' });
    expect(api.write).toHaveBeenCalledTimes(2);
    expect(writtenPreferences(api, 1)).toEqual({
      landing_page: 'Dashboard',
      option: 'WP',
      not_expired: 'N',
    });
  });

  it('drops queued old-session writes when the login changes during an active save', async () => {
    const { service, api, user } = setUp(saved({}));
    const reply = new Subject<{ status: string; message: string }>();
    api.write.mockReturnValueOnce(reply);
    const oldSave = service.save({ option: 'OLD' });
    await vi.waitFor(() => expect(api.write).toHaveBeenCalledTimes(1));
    const queuedEdit = service.save({ option: 'OLDER' });
    await Promise.resolve();
    user.set({ userId: 'mary' });
    await service.save({ option: 'NEW' });
    reply.next({ status: 'PASS', message: '' });
    reply.complete();
    await Promise.all([oldSave, queuedEdit]);
    expect(api.write).toHaveBeenCalledTimes(2);
    expect(api.write.mock.calls[1]).toEqual([
      `call esms_m.a_user_pref_insert('mary', '[{"option":"NEW"}]');`,
    ]);
  });

  it('does not save an old user edit under a new login when a response arrives late', async () => {
    const delayed = new Subject<unknown>();
    const user = signal<{ userId: string } | null>({ userId: 'john' });
    const api = {
      call: vi.fn((sql: string) => (sql.includes("'john'") ? delayed : of(saved({})))),
      write: vi.fn(() => of({ status: 'PASS', message: '' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: LoginService, useValue: { user } },
      ],
    });
    const service = TestBed.inject(UserPreferencesService);
    const oldSave = service.save({ option: 'OLD' });
    user.set({ userId: 'mary' });
    await service.save({ option: 'NEW' });
    delayed.next(saved({}));
    delayed.complete();
    await oldSave;
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(api.write.mock.calls[0]).toEqual([
      `call esms_m.a_user_pref_insert('mary', '[{"option":"NEW"}]');`,
    ]);
  });
});
