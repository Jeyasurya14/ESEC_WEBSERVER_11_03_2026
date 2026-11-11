import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
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
    expect(data.asOn()).not.toBe('');
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
    await data.load('call new();');
    slow.next({ status: 'PASS', message: [{ n: 1 }] });
    slow.complete();
    await first;

    expect(data.rows()).toEqual([{ n: 2 }]);
  });
});
