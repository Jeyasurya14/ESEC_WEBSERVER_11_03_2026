import { instance } from '../../../../testing/instances';
import { literal } from '../../../core/utils/data';
import { organizationRow } from '../../../../testing/report-fixtures';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { LoginService } from '../../../core/auth/login.service';
import { BrowserStorage } from '../../../core/storage/browser-storage.service';
import { ReportHandle, TAB_ID, TabService } from '../../../features/tabs/tab.service';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportChart } from '../../../shared/report-chart/report-chart';
import { LicenseRecord } from '../report-helpers';

import { LicenseDetail, DEFAULT_DETAIL_SETTINGS } from './license-detail';
import { DetailView } from './detail-queries';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-data-grid',
  template: '',
})
class GridStub {
  readonly rows = input<LicenseRecord[]>([]);
  readonly columns = input<unknown[]>([]);
  readonly loading = input(false);
  readonly emptyText = input('');
  readonly search = input('');
  readonly filtersCleared = output<void>();
  readonly rowSelected = output<LicenseRecord>();
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-report-chart',
  template: '',
})
class ChartStub {
  readonly source = input<unknown>();
  readonly options = input<unknown>();
  readonly label = input('');
  readonly retry = output<void>();
}

describe('Shared License detail workspace', () => {
  let call: ReturnType<typeof vi.fn>;
  let setReportHandle: ReturnType<
    typeof vi.fn<(tabId: number, handle: ReportHandle | null) => void>
  >;
  beforeEach(() => {
    call = vi.fn(() =>
      of({
        status: 'PASS',
        message: [{ server: 'srv', lic: 'CAD', user_id: 'u1', du: 3, qty_dp: 4, qty_i: 5 }],
      }),
    );
    setReportHandle = vi.fn<(tabId: number, handle: ReportHandle | null) => void>();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { call } },
        { provide: LoginService, useValue: { user: signal({ userId: 'u' }) } },
        { provide: BrowserStorage, useValue: { get: () => null } },
        { provide: TAB_ID, useValue: 6 },
        { provide: TabService, useValue: { setReportHandle } },
      ],
    });
    TestBed.overrideComponent(LicenseDetail, {
      remove: { imports: [DataGrid, ReportChart] },
      add: { imports: [GridStub, ChartStub] },
    });
  });
  async function open(view: DetailView, waitForData = true) {
    const fixture = TestBed.createComponent(LicenseDetail);
    fixture.componentRef.setInput('view', view);
    fixture.componentRef.setInput('row', organizationRow({ server: 'srv', lic: 'CAD' }));
    fixture.componentRef.setInput('range', {
      startDate: new Date(2026, 10, 1),
      endDate: new Date(2026, 10, 15),
      workingDaysOnly: false,
    });
    fixture.componentRef.setInput('settings', {
      ...DEFAULT_DETAIL_SETTINGS,
      workingHoursPerDay: 7,
    });
    if (waitForData) await fixture.whenStable();
    else TestBed.tick();
    return fixture;
  }
  function choose(element: HTMLElement, label: string, value: string): void {
    const fieldLabel = [...element.querySelectorAll('label')].find(
      (item) => item.querySelector('.filter-label')?.textContent?.trim() === label,
    );
    const input =
      fieldLabel?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select') ??
      element.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  it('ignores a select value outside the declared report options', async () => {
    const fixture = await open('utilization');
    const calls = call.mock.calls.length;
    const element: HTMLElement = fixture.nativeElement;
    choose(element, 'Period', 'invalid-period');
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(calls);
  });
  it('changes utilization period queries while display-only controls do not fetch again', async () => {
    const fixture = await open('utilization');
    const element: HTMLElement = fixture.nativeElement;
    expect(call).toHaveBeenCalledTimes(1);
    choose(element, 'Period', 'week');
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][0]).toContain('utilization_week(');
    const percentage = [...element.querySelectorAll('app-check-filter')].find(
      (item) => item.textContent?.trim() === 'Percentage',
    )!;
    percentage.querySelector<HTMLInputElement>('input')!.click();
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('connects status-bar date and time edits to the same report state and one refreshed query', async () => {
    const fixture = await open('utilization');
    const handle = setReportHandle.mock.calls[0][1]!;
    const controls = handle.controls!();
    controls.dates!.set({ start: '2026-11-05', end: '2026-11-10' });
    controls.times!.set({ startTime: '10:00', endTime: '17:00' });
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls.at(-1)![0]).toBe(
      "call esms_m.r_organization_utilization_date('srv','CAD','2026-11-05','2026-11-10','10:00','17:00');",
    );
    expect(
      instance(fixture.nativeElement.querySelector('input[type="time"]'), HTMLInputElement).value,
    ).toBe('10:00');
  });
  it('keeps percentile edits local and hides unsupported heatmap time/parameter controls', async () => {
    const history = await open('history');
    const historyHandle = setReportHandle.mock.calls[0][1]!;
    const count = call.mock.calls.length;
    historyHandle.controls!().parameters!.set({ percentile: 90 });
    await history.whenStable();
    expect(call).toHaveBeenCalledTimes(count);
    const percentile = [...instance(history.nativeElement, HTMLElement).querySelectorAll('label')]
      .find((label) => label.textContent?.trim().startsWith('Percentile'))!
      .querySelector('input')!;
    expect(percentile.value).toBe('90');
    history.destroy();
    await open('heatmap');
    const heatmapHandle = setReportHandle.mock.calls.at(-1)![1]!;
    expect(heatmapHandle.controls!().dates).toBeDefined();
    expect(heatmapHandle.controls!().times).toBeUndefined();
    expect(heatmapHandle.controls!().parameters).toBeUndefined();
  });
  it('never sends invalid calendar dates or reversed time windows to the backend', async () => {
    const fixture = await open('utilization');
    const element: HTMLElement = fixture.nativeElement;
    choose(element, 'From', '2027-01-01');
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Choose valid dates');
    choose(element, 'From', '2026-11-02');
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('opens Usage Daywise Summary for the selected user and allows clearing that selection', async () => {
    const fixture = await open('usage');
    const grid: GridStub = fixture.debugElement.query(By.directive(GridStub)).componentInstance;
    grid.rowSelected.emit(grid.rows()[0]);
    await fixture.whenStable();
    expect(call.mock.calls.at(-1)![0]).toContain('organization_usage_1(');
    expect(fixture.nativeElement.textContent).toContain('Clear user: u1');
  });
  it('keeps Usage rows scoped to the selected license', async () => {
    call.mockReturnValue(
      of({
        status: 'PASS',
        message: [
          { lic: 'CAD', user_id: 'cad-user' },
          { lic: 'OTHER', user_id: 'other-user' },
        ],
      }),
    );
    const fixture = await open('usage');
    const grid: GridStub = fixture.debugElement.query(By.directive(GridStub)).componentInstance;
    expect(grid.rows()).toEqual([{ lic: 'CAD', user_id: 'cad-user' }]);
  });
  it.each(literal(['utilization', 'heatmap', 'qos', 'hours', 'longDuration']))(
    'uses the visible native field labels without conflicting ARIA names in %s',
    async (view) => {
      const fixture = await open(view);
      const element: HTMLElement = fixture.nativeElement;
      const controls = element.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'label input, label select',
      );
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(Array.from(control.labels ?? [])).toContain(control.closest('label'));
        if (!control.closest('label')?.textContent?.trim()) continue;
        expect(control.hasAttribute('aria-label')).toBe(false);
        expect(control.hasAttribute('aria-labelledby')).toBe(false);
      }
    },
  );
  it('loads debug session details for the clicked license only', async () => {
    const fixture = await open('debugData');
    const grid: GridStub = fixture.debugElement.query(By.directive(GridStub)).componentInstance;
    grid.rowSelected.emit({ server: 'audit', lic: 'OTHER' });
    await fixture.whenStable();
    expect(call.mock.calls.at(-1)![0]).toBe(
      "call esms_m.r_license_debug_data_1('audit','OTHER','2026-11-01','2026-11-15');",
    );
  });
  it('maintains independent grid/chart requests and cancels all of them on destruction', async () => {
    const responses: Subject<unknown>[] = [];
    call.mockImplementation(() => {
      const response = new Subject<unknown>();
      responses.push(response);
      return response;
    });
    const fixture = await open('utilizationHours', false);
    expect(responses).toHaveLength(2);
    expect(call.mock.calls[0][0]).toContain('date_2(');
    expect(call.mock.calls[1][0]).toContain('month_1(');
    fixture.destroy();
    expect(responses.every((response) => !response.observed)).toBe(true);
    expect(setReportHandle).toHaveBeenLastCalledWith(6, null);
  });
});
