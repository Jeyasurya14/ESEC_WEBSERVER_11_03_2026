import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { LoginService } from '../../../core/auth/login.service';
import { TAB_ID, TabService } from '../../../features/tabs/tab.service';
import { ReportSettings } from '../../../shared/report-settings.service';
import { Organization } from './organization';
import { OrganizationRow, organizationCall, prepareRows, visibleRows } from './organization.data';

const settings = { lowBelow: 50, highFrom: 80, workingHoursPerDay: 12 } as ReportSettings;

function row(values: Partial<OrganizationRow>): OrganizationRow {
  return {
    status: 'Installed',
    expiry: '2099-01-01',
    p_dp: 60,
    tlh_24: 24,
    tot_du_q: 6,
    ...values,
  } as OrganizationRow;
}

describe('Organization data rules', () => {
  it('calls the organization procedure for the range and feature group', () => {
    expect(
      organizationCall('john', { kind: 'quarter', quarter: 1, year: 2026 }, 'Primary Feature'),
    ).toBe("call esms_m.r_organization_grid_qtr_year('john','1','2026','Pri');");
  });

  it('rescales available hours to working hours and works out the percentage used', () => {
    const [prepared] = prepareRows([row({ tlh_24: 48, tot_du_q: 6 })], 12);
    expect(prepared.tlh_24).toBe(24);
    expect(prepared.per_tot_du_q).toBe(25);
  });

  it('keeps 0% when no hours are available', () => {
    expect(prepareRows([row({ tlh_24: 0 })], 12)[0].per_tot_du_q).toBe(0);
  });

  it('applies server status, expiry and usage-band filters together', () => {
    const rows = [
      row({ sw: 'kept' }),
      row({ sw: 'inactive', status: 'Uninstalled' }),
      row({ sw: 'expired', expiry: '2020-01-01' }),
      row({ sw: 'high usage', p_dp: 95 }),
    ];
    const filters = {
      serverStatus: { active: true, inactive: false },
      notExpired: true,
      option: 'DP' as const,
      bands: ['medium' as const],
    };

    expect(visibleRows(rows, filters, settings, new Date(2026, 0, 1)).map((r) => r.sw)).toEqual([
      'kept',
    ]);
  });
});

// Renders the real grid; its first render in jsdom can take several seconds while all test files run at once.
describe('Organization report', { timeout: 20_000 }, () => {
  let api: Record<'getSetting' | 'query' | 'call' | 'write', ReturnType<typeof vi.fn>>;
  let reportReply: unknown;
  let savedChoices: object;

  beforeEach(() => {
    reportReply = {
      status: 'PASS',
      message: [row({ sw: 'CATIA', status: 'Installed' }), row({ status: 'Uninstalled' })],
    };
    savedChoices = {};
    api = {
      getSetting: vi.fn(
        (name: string) =>
          ({ DASHBOARD_SELECT_OPTION_DEFAULT: 'YTD', MY_FEATURE: 'Primary Feature' })[name] ?? '',
      ),
      query: vi.fn().mockReturnValue(of({ status: 'PASS', message: [] })),
      call: vi.fn((sql: string) => {
        if (sql.includes('MF_LOAD'))
          return of({ status: 'PASS', message: [{ COLLECTION_NAME: 'CATIA' }] });
        if (sql.includes('a_user_pref_load'))
          return of({ status: 'PASS', message: [{ pref: JSON.stringify([savedChoices]) }] });
        return of(reportReply);
      }),
      write: vi.fn().mockReturnValue(of({ status: 'PASS', message: '' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: LoginService, useValue: { user: signal({ userId: 'john' }) } },
      ],
    });
  });

  async function open() {
    const fixture = TestBed.createComponent(Organization);
    fixture.componentRef.setInput('menu', { mainMenuName: 'LICENSE', subMenuName: 'Organization' });
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const reportCalls = () =>
    api.call.mock.calls.map(([sql]) => sql as string).filter((sql) => sql.includes('organization'));

  it('loads once with the default range and feature group, and shows active servers only', async () => {
    const fixture = await open();

    expect(reportCalls()).toEqual(["call esms_m.r_organization_grid('john','YTD','Pri');"]);
    expect(fixture.componentInstance.rows().map((r) => r.sw)).toEqual(['CATIA']);
    expect(fixture.nativeElement.querySelector('.report-toolbar')).not.toBeNull();
  });

  it('briefly shows the gauge view as not-ready, so a click repaints before the tiles build', async () => {
    const fixture = await open();

    vi.useFakeTimers();
    try {
      expect(fixture.componentInstance.gaugeReady()).toBe(true);
      fixture.componentInstance.toggleView();
      expect(fixture.componentInstance.view()).toBe('gauge');
      expect(fixture.componentInstance.gaugeReady()).toBe(false);

      vi.runAllTimers();
      expect(fixture.componentInstance.gaugeReady()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reloads when the range changes, but not when a browser-side filter changes', async () => {
    const fixture = await open();

    fixture.componentInstance.filters.serverStatus.set({ active: true, inactive: true });
    await fixture.whenStable();
    expect(reportCalls()).toHaveLength(1);
    expect(fixture.componentInstance.rows()).toHaveLength(2);

    fixture.componentInstance.filters.range.set({ kind: 'year', year: 2025 });
    await fixture.whenStable();
    expect(reportCalls().at(-1)).toBe("call esms_m.r_organization_grid_year('john','2025','Pri');");
  });

  it('starts from the choices the user saved last time, and saves a change', async () => {
    savedChoices = { range_main: 'Mar-2026', my_feature: 'CATIA', landing_page: 'Dashboard' };
    const fixture = await open();

    expect(reportCalls()).toEqual([
      "call esms_m.r_organization_grid_month_year('john','3','2026','CATIA');",
    ]);

    fixture.componentInstance.filters.notExpired.set(false);
    await fixture.whenStable();

    const saved = (api.write.mock.calls.at(-1) as [string])[0];
    expect(saved).toContain('"not_expired":"N"');
    expect(saved).toContain('"landing_page":"Dashboard"');
  });

  it("shows the server's message when there is no data", async () => {
    reportReply = { status: 'FAIL', message: 'No data for the selected period' };
    const fixture = await open();

    expect(fixture.componentInstance.rows()).toEqual([]);
    expect(fixture.componentInstance.data.error()).toBe('No data for the selected period');
    expect(fixture.componentInstance.data.loading()).toBe(false);
  });

  it("puts its refresh handle in the status bar under its own tab's id, and clears it on destroy", async () => {
    TestBed.configureTestingModule({ providers: [TabService, { provide: TAB_ID, useValue: 42 }] });
    const tabs = TestBed.inject(TabService);
    tabs.activate(42);

    const fixture = await open();
    expect(tabs.activeRefreshHandle()?.loading()).toBe(false);
    expect(tabs.activeRefreshHandle()?.asOn()).toBe(fixture.componentInstance.data.asOn());
    expect(tabs.activeRefreshHandle()?.asOn()).not.toBe('');

    const callsBefore = reportCalls().length;
    tabs.activeRefreshHandle()?.refresh();
    await fixture.whenStable();
    expect(reportCalls().length).toBeGreaterThan(callsBefore);

    fixture.destroy();
    expect(tabs.activeRefreshHandle()).toBeNull();
  });
});
