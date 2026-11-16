import { instance } from '../../../../testing/instances';
import { literal } from '../../../core/utils/data';
import { reportSettings, organizationRow } from '../../../../testing/report-fixtures';
import { GaugeTile } from '../../../shared/gauge/gauge-tile';
import { DataGrid } from '../../../shared/grid/data-grid';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { LoginService } from '../../../core/auth/login.service';
import { TAB_ID, TabService } from '../../../features/tabs/tab.service';

import { Organization } from './organization';
import {
  OrganizationRow,
  organizationCall,
  organizationColumns,
  prepareRows,
  visibleRows,
} from './organization.data';

const settings = reportSettings({ lowBelow: 50, highFrom: 80, workingHoursPerDay: 12 });

function row(values: Partial<OrganizationRow>): OrganizationRow {
  return organizationRow({
    status: 'Installed',
    expiry: '2099-01-01',
    p_dp: 60,
    tlh_24: 24,
    tot_du_q: 6,
    ...values,
  });
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
      option: literal('DP'),
      bands: [literal('medium')],
    };

    expect(visibleRows(rows, filters, settings, new Date(2026, 0, 1)).map((row) => row.sw)).toEqual(
      ['kept'],
    );
  });

  it('makes the Software column a clickable link only when given a selection callback', () => {
    const onSelect = vi.fn();
    const softwareColumnClass = (columns: ReturnType<typeof organizationColumns>) => {
      const column = columns.find((candidate) => 'field' in candidate && candidate.field === 'sw');
      return column && 'cellClass' in column ? column.cellClass : undefined;
    };

    expect(softwareColumnClass(organizationColumns(settings))).toBeUndefined();
    expect(softwareColumnClass(organizationColumns(settings, onSelect))).toBe('link-cell');
  });
});

// Renders the real grid; its first render in jsdom can take several seconds while all test files run at once.
describe('Organization report', { timeout: 20_000 }, () => {
  let api: Record<'getSetting' | 'query' | 'call' | 'write', ReturnType<typeof vi.fn>>;
  let reportReply: unknown;
  let savedChoices: object;

  beforeEach(() => {
    TestBed.overrideComponent(GaugeTile, { set: { template: '' } });
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
        TabService,
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
    api.call.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('organization'));

  it('loads once with the default range and feature group, and shows active servers only', async () => {
    const fixture = await open();

    expect(reportCalls()).toEqual(["call esms_m.r_organization_grid('john','YTD','Pri');"]);
    expect(fixture.componentInstance.rows().map((row) => row.sw)).toEqual(['CATIA']);
    expect(fixture.nativeElement.querySelector('.report-toolbar')).not.toBeNull();
  });

  it('uses status-bar range and Usage Per Day controls for the active organization report', async () => {
    TestBed.overrideComponent(DataGrid, { set: { template: '' } });
    TestBed.configureTestingModule({ providers: [{ provide: TAB_ID, useValue: 1 }] });
    const tabs = TestBed.inject(TabService);
    tabs.activeTabId.set(1);
    const fixture = await open();
    const controls = tabs.activeReportHandle()!.controls!();
    controls.range!.set({ kind: 'year', year: 2025 });
    controls.parameters!.set({ usageHours: 8 });
    await fixture.whenStable();
    expect(reportCalls()).toHaveLength(2);
    expect(reportCalls().at(-1)).toBe("call esms_m.r_organization_grid_year('john','2025','Pri');");
    expect(fixture.componentInstance.reportData.rows()[0].tlh_24).toBe(8);
    expect(fixture.componentInstance.filters.range()).toEqual({ kind: 'year', year: 2025 });
  });
  it('scrolls through 3000 gauges with bounded cards and resets after filtering', async () => {
    TestBed.overrideComponent(DataGrid, { set: { template: '' } });
    reportReply = {
      status: 'PASS',
      message: Array.from({ length: 3000 }, (_, index) => row({ sw: `CAD${index}` })),
    };
    const fixture = await open();
    const report = fixture.componentInstance;
    report.viewMode.set('gauge');
    await fixture.whenStable();
    expect(report.gaugeCards()).toHaveLength(3000);
    const cards = () => fixture.debugElement.queryAll(By.directive(GaugeTile));
    expect(cards().length).toBeGreaterThan(0);
    expect(cards().length).toBeLessThanOrEqual(15);
    expect(fixture.nativeElement.querySelector('.gauge-pages')).toBeNull();
    const viewport = instance(fixture.nativeElement.querySelector('.gauge-viewport'), HTMLElement);
    Object.defineProperties(viewport, {
      clientWidth: { value: 960, configurable: true },
      clientHeight: { value: 780, configurable: true },
    });
    async function scrollTo(top: number) {
      viewport.scrollTop = top;
      viewport.dispatchEvent(new Event('scroll'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await fixture.whenStable();
    }
    await scrollTo(406 * 50);
    expect(cards().length).toBeLessThanOrEqual(15);
    expect(instance(cards()[0].componentInstance, GaugeTile).title()).toBe('CAD144');
    instance(fixture.nativeElement.querySelector('.gauge-card'), HTMLButtonElement).click();
    expect(report.selectedGauge()?.row).toBe(report.reportData.rows()[144]);
    await scrollTo(405984 + 40 - 780);
    expect(instance(cards().at(-1)!.componentInstance, GaugeTile).title()).toBe('CAD2999');
    expect(cards().length).toBeLessThanOrEqual(15);
    report.filters.search.set('CAD2999');
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(0);
    expect(cards()).toHaveLength(1);
    expect(instance(cards()[0].componentInstance, GaugeTile).title()).toBe('CAD2999');
  });

  it('briefly shows the gauge view as not-ready, so a click repaints before the tiles build', async () => {
    const fixture = await open();

    vi.useFakeTimers();
    try {
      expect(fixture.componentInstance.gaugesReady()).toBe(true);
      fixture.componentInstance.toggleView();
      expect(fixture.componentInstance.viewMode()).toBe('gauge');
      expect(fixture.componentInstance.gaugesReady()).toBe(false);

      vi.runAllTimers();
      expect(fixture.componentInstance.gaugesReady()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats every click on the same gauge as a new report request', async () => {
    const fixture = await open();
    const selected = fixture.componentInstance.gaugeCards()[0];
    fixture.componentInstance.openDrilldown(selected);
    const first = fixture.componentInstance.selectedGauge();
    fixture.componentInstance.openDrilldown(selected);
    const second = fixture.componentInstance.selectedGauge();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    await fixture.whenStable();
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

    const saved = String(api.write.mock.calls.at(-1)?.[0]);
    expect(saved).toContain('"not_expired":"N"');
    expect(saved).toContain('"landing_page":"Dashboard"');
  });

  it("shows the server's message when there is no data", async () => {
    reportReply = { status: 'FAIL', message: 'No data for the selected period' };
    const fixture = await open();

    expect(fixture.componentInstance.rows()).toEqual([]);
    expect(fixture.componentInstance.reportData.error()).toBe('No data for the selected period');
    expect(fixture.componentInstance.reportData.loading()).toBe(false);
  });

  it("puts its refresh handle in the status bar under its own tab's id, and clears it on destroy", async () => {
    TestBed.configureTestingModule({
      providers: [
        TabService,
        {
          provide: TAB_ID,
          useFactory: (tabs: TabService) => tabs.activeTabId(),
          deps: [TabService],
        },
      ],
    });
    const tabs = TestBed.inject(TabService);
    await tabs.open({ mainMenuName: 'DASHBOARD', subMenuName: 'Refresh test' });

    const fixture = await open();
    expect(tabs.activeReportHandle()?.loading()).toBe(false);
    expect(tabs.activeReportHandle()?.lastUpdated()).toBe(
      fixture.componentInstance.reportData.lastUpdated(),
    );
    expect(tabs.activeReportHandle()?.lastUpdated()).not.toBe('');

    const callsBefore = reportCalls().length;
    tabs.activeReportHandle()?.refresh();
    await fixture.whenStable();
    expect(reportCalls().length).toBeGreaterThan(callsBefore);

    fixture.destroy();
    expect(tabs.activeReportHandle()).toBeNull();
  });
});
