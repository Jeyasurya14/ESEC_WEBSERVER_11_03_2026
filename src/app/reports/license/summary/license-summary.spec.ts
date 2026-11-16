import { instance } from '../../../../testing/instances';
import { reportSettings, organizationRow } from '../../../../testing/report-fixtures';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Options } from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { LoginService } from '../../../core/auth/login.service';
import { TAB_ID, TabService } from '../../../features/tabs/tab.service';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportChart } from '../../../shared/report-chart/report-chart';

import { LicenseSummary } from './license-summary';
import { LicenseSummaryChart } from './license-summary-chart';
import { SummaryLoader } from './summary-loader';
import { SummaryIndicator } from './license-summary.data';
import { LicenseScope } from '../grouped-reports';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-data-grid',
  template: '',
})
class GridStub {
  readonly rows = input<SummaryIndicator[]>([]);
  readonly columns = input<unknown[]>([]);
  readonly loading = input(false);
  readonly emptyText = input('');
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'highcharts-chart',
  template: '',
})
class ChartStub {
  readonly options = input.required<Options>();
}

const settings = reportSettings({ lowBelow: 60, highFrom: 80, workingHoursPerDay: 7 });
const row = organizationRow({
  server: 'srv',
  lic: 'CAD',
  divn: 'Engineering',
  dept: 'Design',
  g_type: 'Team',
  g_name: 'Alpha',
});

describe('License Summary dashboard', () => {
  let call: ReturnType<typeof vi.fn>;
  let setReportHandle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    call = vi.fn((sql: string) =>
      of({
        status: 'PASS',
        message: sql.includes('_indicator(')
          ? [{ type: '30', max_qty_i: 10, tlh_24: 48, tot_du_q: 7 }]
          : [
              {
                date: '15-Nov-2026',
                holi: 'n',
                qty_i: 10,
                qty_dp: 7,
                qty_wp: 5,
                p_dp: 70,
                p_wp: 50,
              },
            ],
      }),
    );
    setReportHandle = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { call, getSetting: () => '' } },
        { provide: LoginService, useValue: { user: signal({ userId: 'user' }) } },
        { provide: TAB_ID, useValue: 21 },
        { provide: TabService, useValue: { setReportHandle } },
      ],
    });
    TestBed.overrideComponent(LicenseSummary, {
      remove: { imports: [DataGrid] },
      add: { imports: [GridStub] },
    });
    TestBed.overrideComponent(ReportChart, {
      remove: { imports: [HighchartsChartComponent] },
      add: { imports: [ChartStub] },
    });
  });

  async function open(scope: LicenseScope = 'organization', waitForData = true) {
    const fixture = TestBed.createComponent(LicenseSummary);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('scope', scope);
    fixture.componentRef.setInput('title', 'CAD — srv');
    fixture.componentRef.setInput('settings', settings);
    if (waitForData) await fixture.whenStable();
    else TestBed.tick();
    return fixture;
  }

  it.each<LicenseScope>(['organization', 'division', 'department', 'group'])(
    'loads all five %s datasets and renders four charts plus indicators',
    async (scope) => {
      const fixture = await open(scope);
      const store = fixture.debugElement.injector.get(SummaryLoader);
      expect(call).toHaveBeenCalledTimes(5);
      expect(
        call.mock.calls.every(([sql]) => String(sql).startsWith(`call esms_m.r_${scope}_`)),
      ).toBe(true);
      expect(fixture.debugElement.queryAll(By.directive(LicenseSummaryChart))).toHaveLength(4);
      const grid: GridStub = fixture.debugElement.query(By.directive(GridStub)).componentInstance;
      expect(grid.rows().find((metric) => metric.description === 'Issued')?.['30']).toBe(10);
      if (scope === 'organization' || scope === 'group')
        expect(grid.rows().find((metric) => metric.percentage)?.['30']).toBe(50);
      expect(store.loading()).toBe(false);
      expect(store.lastUpdated()).not.toBe('');
      expect(setReportHandle).toHaveBeenCalledTimes(1);
    },
  );

  it('switches display mode and shared metrics without refetching any dataset', async () => {
    const fixture = await open();
    const element: HTMLElement = fixture.nativeElement;
    const mode = element.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    mode[1].click();
    await fixture.whenStable();
    const charts = fixture.debugElement.queryAll(By.directive(ChartStub));
    expect(charts).toHaveLength(4);
    expect(
      instance(charts[0].componentInstance, ChartStub)
        .options()
        .series?.some((series) => series.id === 'ISSUED'),
    ).toBe(false);
    const dayAverage = Array.from(
      element.querySelectorAll<HTMLElement>('.summary-toolbar app-check-filter'),
    ).find((filter) => filter.textContent?.trim() === 'Day Avg')!;
    dayAverage.querySelector<HTMLInputElement>('input')!.click();
    await fixture.whenStable();
    expect(
      instance(charts[0].componentInstance, ChartStub)
        .options()
        .series?.find((series) => series.id === 'DA')?.visible,
    ).toBe(true);
    expect(call).toHaveBeenCalledTimes(5);
  });

  it('expands and restores a panel without recreating data sources or making new requests', async () => {
    const fixture = await open();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('[aria-label="Expand 30 Days Utilization"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLElement>('.indicators-panel')!.hidden).toBe(true);
    expect(element.querySelectorAll('app-license-summary-chart:not([hidden])')).toHaveLength(1);
    element.querySelector<HTMLButtonElement>('[aria-label="Restore 30 Days Utilization"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLElement>('.indicators-panel')!.hidden).toBe(false);
    expect(call).toHaveBeenCalledTimes(5);
  });

  it('keeps successful panels available and retries only the failed chart', async () => {
    let failWeek = true;
    call.mockImplementation((sql: string) =>
      of(
        sql.includes('_chart_week(') && failWeek
          ? { status: 'FAIL', message: 'Week unavailable' }
          : {
              status: 'PASS',
              message: sql.includes('_indicator(')
                ? [{ type: '30', max_qty_i: 10 }]
                : [{ date: 'date', qty_dp: 4 }],
            },
      ),
    );
    const fixture = await open();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('highcharts-chart')).toHaveLength(3);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Week unavailable');
    expect(fixture.debugElement.injector.get(SummaryLoader).lastUpdated()).toBe('');
    failWeek = false;
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(6);
    expect(call.mock.calls.filter(([sql]) => String(sql).includes('_chart_week('))).toHaveLength(2);
    expect(element.querySelectorAll('highcharts-chart')).toHaveLength(4);
    expect(fixture.debugElement.injector.get(SummaryLoader).lastUpdated()).not.toBe('');
  });

  it('refreshes all five sources through one workspace handle and removes it on destroy', async () => {
    const fixture = await open();
    setReportHandle.mock.calls[0][1].refresh();
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(10);
    fixture.destroy();
    expect(setReportHandle).toHaveBeenLastCalledWith(21, null);
  });

  it('cancels requests when row context changes and when the dashboard is destroyed', async () => {
    const requests: Subject<unknown>[] = [];
    call.mockImplementation(() => {
      const response = new Subject<unknown>();
      requests.push(response);
      return response;
    });
    const fixture = await open('organization', false);
    expect(requests).toHaveLength(5);
    fixture.componentRef.setInput('row', { ...row, lic: 'OTHER' });
    TestBed.tick();
    expect(requests).toHaveLength(10);
    expect(requests.slice(0, 5).every((request) => !request.observed)).toBe(true);
    fixture.destroy();
    expect(requests.every((request) => !request.observed)).toBe(true);
  });

  it('isolates settings and radio groups between separately opened Summary tabs', async () => {
    const first = await open();
    const second = await open();
    const firstRadio = instance(
      first.nativeElement.querySelector('input[type="radio"]'),
      HTMLInputElement,
    );
    const secondRadio = instance(
      second.nativeElement.querySelector('input[type="radio"]'),
      HTMLInputElement,
    );
    expect(firstRadio.name).not.toBe(secondRadio.name);
    expect(first.debugElement.injector.get(SummaryLoader)).not.toBe(
      second.debugElement.injector.get(SummaryLoader),
    );
  });
});
