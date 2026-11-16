import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../core/api/api.service';
import { LoginService } from '../core/auth/login.service';
import { ReportData, combinedLastUpdated } from './report-data';

describe('combinedLastUpdated', () => {
  const source = (loadedAt: Date | null, loading = false, error = '') => ({
    loading: signal(loading),
    error: signal(error),
    loadedAt: signal(loadedAt),
  });

  it('is the oldest load time once every source has loaded', () => {
    const older = new Date(2026, 0, 1, 9, 0);
    const newer = new Date(2026, 0, 1, 10, 0);
    const label = combinedLastUpdated([source(newer), source(older)]);
    expect(label).toBe(combinedLastUpdated([source(older)]));
    expect(label).not.toBe('');
  });

  it('is empty while any source is loading, failed or has not loaded', () => {
    const loaded = source(new Date());
    expect(combinedLastUpdated([loaded, source(new Date(), true)])).toBe('');
    expect(combinedLastUpdated([loaded, source(new Date(), false, 'Failed')])).toBe('');
    expect(combinedLastUpdated([loaded, source(null)])).toBe('');
  });
});

describe('report data', () => {
  function setUp(call: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        ReportData,
        { provide: ApiService, useValue: { call } },
        { provide: LoginService, useValue: { user: signal({ userId: 'john' }) } },
      ],
    });
    return TestBed.inject<ReportData<{ n: number }>>(ReportData);
  }

  async function settle() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  it('keeps the prepared rows and records when they loaded', async () => {
    const data = setUp(
      vi.fn().mockReturnValue(of({ status: 'PASS', message: [{ n: 1 }, { n: 2 }] })),
    );

    data.bind(() => ({
      kind: 'load',
      sql: 'call x();',
      transform: (rows) => rows.filter((row) => row.n > 1),
    }));
    await settle();

    expect(data.rows()).toEqual([{ n: 2 }]);
    expect(data.loading()).toBe(false);
    expect(data.error()).toBe('');
    expect(data.lastUpdated()).not.toBe('');
    expect(data.userId()).toBe('john');
  });

  it("shows the server's message, or a generic one when the request fails", async () => {
    const data = setUp(
      vi.fn().mockReturnValue(of({ status: 'FAIL', message: 'No data for this period' })),
    );
    data.bind(() => ({ kind: 'load', sql: 'call x();' }));
    await settle();
    expect(data.error()).toBe('No data for this period');

    TestBed.resetTestingModule();
    const failing = setUp(vi.fn().mockReturnValue(throwError(() => new Error('offline'))));
    failing.bind(() => ({ kind: 'load', sql: 'call x();' }));
    await settle();
    expect(failing.error()).toContain('Unable to load the report');
    expect(failing.rows()).toEqual([]);
  });

  it('loads again whenever a signal its query reads changes', async () => {
    const call = vi.fn((sql: string) =>
      of({ status: 'PASS', message: [{ n: sql === 'call b();' ? 2 : 1 }] }),
    );
    const data = setUp(call);
    const sql = signal('call a();');

    data.bind(() => ({ kind: 'load', sql: sql() }));
    await settle();
    expect(data.rows()).toEqual([{ n: 1 }]);

    sql.set('call b();');
    await settle();
    expect(call).toHaveBeenLastCalledWith('call b();');
    expect(data.rows()).toEqual([{ n: 2 }]);
  });

  it('cancels the previous request when the query changes, so an old reply never shows', async () => {
    const cancelled = vi.fn();
    const call = vi
      .fn()
      .mockReturnValueOnce(new Observable(() => cancelled))
      .mockReturnValueOnce(of({ status: 'PASS', message: [{ n: 2 }] }));
    const data = setUp(call);
    const sql = signal('call old();');

    data.bind(() => ({ kind: 'load', sql: sql() }));
    await settle();
    sql.set('call latest();');
    await settle();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(data.rows()).toEqual([{ n: 2 }]);
  });

  it('cancels a pending request when the report is destroyed', async () => {
    const cancelled = vi.fn();
    const data = setUp(vi.fn().mockReturnValue(new Observable(() => cancelled)));
    data.bind(() => ({ kind: 'load', sql: 'call pending();' }));
    await settle();
    TestBed.resetTestingModule();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('stays loading until its prerequisites are ready', async () => {
    const call = vi.fn().mockReturnValue(of({ status: 'PASS', message: [] }));
    const data = setUp(call);

    data.bind(() => undefined);
    await settle();
    expect(data.loading()).toBe(true);
    expect(call).not.toHaveBeenCalled();
  });

  it('shows nothing for an idle query and the message for an invalid one, without a call', async () => {
    const call = vi.fn();
    const data = setUp(call);
    const valid = signal(false);

    data.bind(() => (valid() ? { kind: 'idle' } : { kind: 'invalid', message: 'Bad dates' }));
    await settle();
    expect(data.error()).toBe('Bad dates');

    valid.set(true);
    await settle();
    expect(data.error()).toBe('');
    expect(data.loading()).toBe(false);
    expect(data.rows()).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });

  it('keeps the current rows on screen while refreshing', async () => {
    const reply = new Subject<unknown>();
    const call = vi
      .fn()
      .mockReturnValueOnce(of({ status: 'PASS', message: [{ n: 1 }] }))
      .mockReturnValueOnce(reply);
    const data = setUp(call);

    data.bind(() => ({ kind: 'load', sql: 'call x();' }));
    await settle();
    data.refresh();
    await settle();

    expect(data.loading()).toBe(true);
    expect(data.rows()).toEqual([{ n: 1 }]);

    reply.next({ status: 'PASS', message: [{ n: 3 }] });
    reply.complete();
    await settle();
    expect(data.rows()).toEqual([{ n: 3 }]);
  });

  it('shows a failure from outside the query, such as settings not loading', async () => {
    const data = setUp(vi.fn());
    data.bind(() => undefined);
    data.fail('Unable to load the report settings.');
    await settle();
    expect(data.error()).toBe('Unable to load the report settings.');
    expect(data.loading()).toBe(false);
  });

  it('does not present a failed request as successfully refreshed', async () => {
    const data = setUp(vi.fn().mockReturnValue(of({ status: 'FAIL', message: 'Unavailable' })));
    data.bind(() => ({ kind: 'load', sql: 'call failed();' }));
    await settle();
    expect(data.loadedAt()).toBeNull();
    expect(data.lastUpdated()).toBe('');
  });
});
