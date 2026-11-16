import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../core/api/api.service';
import { LoginService } from '../core/auth/login.service';
import { ReportData } from './report-data';

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

  it('keeps the prepared rows and records when they loaded', async () => {
    const data = setUp(
      vi.fn().mockReturnValue(of({ status: 'PASS', message: [{ n: 1 }, { n: 2 }] })),
    );

    await data.load('call x();', (rows) => rows.filter((row) => row.n > 1));

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
    await data.load('call x();');
    expect(data.error()).toBe('No data for this period');

    TestBed.resetTestingModule();
    const failing = setUp(vi.fn().mockReturnValue(throwError(() => new Error('offline'))));
    await failing.load('call x();');
    expect(failing.error()).toContain('Unable to load the report');
    expect(failing.rows()).toEqual([]);
  });

  it('ignores an older reply that arrives after a newer one', async () => {
    const slow = new Subject<unknown>();
    const call = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockReturnValueOnce(of({ status: 'PASS', message: [{ n: 2 }] }));
    const data = setUp(call);

    const first = data.load('call old();');
    TestBed.tick();
    await data.load('call new();');
    slow.next({ status: 'PASS', message: [{ n: 1 }] });
    slow.complete();
    await first;

    expect(data.rows()).toEqual([{ n: 2 }]);
  });

  it('does not restore old rows after the parameter selection is cleared', async () => {
    const pending = new Subject<unknown>();
    const data = setUp(vi.fn().mockReturnValue(pending));
    const request = data.load('call old();');
    TestBed.tick();
    data.clear();
    pending.next({ status: 'PASS', message: [{ n: 1 }] });
    pending.complete();
    await request;
    expect(data.rows()).toEqual([]);
    expect(data.loading()).toBe(false);
    expect(data.loadedAt()).toBeNull();
  });

  it('unsubscribes the previous request when new filters are loaded', async () => {
    const cancelled = vi.fn();
    const pending = new Observable(() => cancelled);
    const data = setUp(
      vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockReturnValueOnce(of({ status: 'PASS', message: [{ n: 2 }] })),
    );
    const previous = data.load('call old();');
    TestBed.tick();
    await data.load('call latest();');
    await previous;
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(data.rows()).toEqual([{ n: 2 }]);
  });

  it('cancels pending requests when the report is destroyed', async () => {
    const cancelled = vi.fn();
    const data = setUp(vi.fn().mockReturnValue(new Observable(() => cancelled)));
    const pending = data.load('call pending();');
    TestBed.tick();
    TestBed.resetTestingModule();
    await pending;
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  describe('a bound query', () => {
    async function settle() {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }

    it('loads on its own, and again whenever a signal it reads changes', async () => {
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
  });

  it('does not present a failed request as successfully refreshed', async () => {
    const data = setUp(vi.fn().mockReturnValue(of({ status: 'FAIL', message: 'Unavailable' })));
    await data.load('call failed();');
    expect(data.loadedAt()).toBeNull();
    expect(data.lastUpdated()).toBe('');
  });
});
