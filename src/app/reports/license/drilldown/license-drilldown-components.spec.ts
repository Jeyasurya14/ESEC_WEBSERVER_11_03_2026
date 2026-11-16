import { literal } from '../../../core/utils/data';
import { reportSettings, organizationRow } from '../../../../testing/report-fixtures';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HighchartsChartComponent } from 'highcharts-angular';
import { Options } from 'highcharts';
import { ApiService } from '../../../core/api/api.service';
import { LoginService } from '../../../core/auth/login.service';
import { BrowserStorage, StorageKey } from '../../../core/storage/browser-storage.service';
import { TAB_ID, TabService } from '../../../features/tabs/tab.service';
import { DataGrid } from '../../../shared/grid/data-grid';
import { LicenseDetail } from '../detail/license-detail';
import { ReportSettingsService } from '../../../shared/report-settings.service';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import { FeatureGroupsService } from '../../../shared/filters/feature-group-filter';
import { ReportChart } from '../../../shared/report-chart/report-chart';
import { DEFAULT_HEATMAP_COLORS } from '../../../shared/report-settings.service';

import { GroupDetails } from '../group-details/group-details';
import { LicenseActionId } from './license-actions';
import { loadLicenseDrilldown } from './license-drilldown-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-data-grid',
  template: '',
})
class GridStub {
  readonly rows = input<unknown[]>([]);
  readonly columns = input<unknown[]>([]);
  readonly loading = input(false);
  readonly emptyText = input('');
  readonly search = input('');
  readonly rowCount = output<string>();
  readonly filtersCleared = output<void>();
  readonly rowSelected = output<Record<string, unknown>>();
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'highcharts-chart',
  template: '',
})
class ChartStub {
  readonly options = input.required<Options>();
}

const settings = reportSettings({
  lowBelow: 60,
  highFrom: 80,
  workingHoursPerDay: 7,
  heatmapColors: DEFAULT_HEATMAP_COLORS,
  divisionLabel: 'Division',
  departmentLabel: 'Department',
});
const row = organizationRow({ server: 'srv', lic: 'CAD', lic_name: 'CAD Feature', sw: 'CAD' });
const reports: [LicenseActionId, string][] = [
  ['utilization', 'r_organization_utilization_date'],
  ['history', 'r_organization_history'],
  ['qos', 'r_organization_qos'],
  ['heatmap', 'r_organization_utilization_hour'],
  ['month', 'r_organization_month'],
  ['date', 'r_organization_date'],
  ['hours', 'r_organization_usage_month'],
  ['usage', 'r_organization_usage'],
  ['utilizationHours', 'r_organization_usage_utilization_date_2'],
  ['checkoutUser', 'r_organization_users_checkout_list_date'],
  ['checkoutCount', 'r_organization_users_checkout_date'],
  ['longDuration', 'r_organization_users_checkout_list_duration'],
  ['denial', 'r_organization_users_denial_users'],
  ['borrow', 'r_organization_users_borrow'],
  ['division', 'r_organization_groups_division_grid'],
  ['department', 'r_organization_groups_department_grid'],
  ['reservation', 'r_organization_groups_group_grid'],
  ['assetInfo', 'r_organization_utilization_asset_info'],
  ['debugData', 'r_organization_debug_data'],
];

describe('Bottom report components through their shared renderers', () => {
  let call: ReturnType<typeof vi.fn>;
  let setReportHandle: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    call = vi.fn(() => of({ status: 'PASS', message: [] }));
    setReportHandle = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReportSettingsService,
          useValue: {
            load: async () => ({
              ...settings,
              defaultRange: '30',
              defaultOption: 'DP',
              defaultFeatureGroup: 'All Feature',
            }),
          },
        },
        {
          provide: UserPreferencesService,
          useValue: { load: async () => ({}), save: async () => {} },
        },
        { provide: FeatureGroupsService, useValue: { load: async () => [], revision: signal(0) } },
        { provide: ApiService, useValue: { call, getSetting: () => '' } },
        { provide: LoginService, useValue: { user: signal({ userId: 'user' }) } },
        {
          provide: BrowserStorage,
          useValue: {
            get: (key: string) =>
              key === StorageKey.workingHourStart
                ? '10:00'
                : key === StorageKey.workingHourEnd
                  ? '17:00'
                  : null,
          },
        },
        { provide: TAB_ID, useValue: 9 },
        { provide: TabService, useValue: { setReportHandle } },
      ],
    });
    TestBed.overrideComponent(LicenseDetail, {
      remove: { imports: [DataGrid] },
      add: { imports: [GridStub] },
    });
    TestBed.overrideComponent(DataGrid, { set: { template: '' } });
    TestBed.overrideComponent(ReportChart, {
      remove: { imports: [HighchartsChartComponent] },
      add: { imports: [ChartStub] },
    });
  });

  it.each(reports)(
    'opens %s, loads %s once, and refreshes through the workspace',
    async (action, procedure) => {
      const view = await loadLicenseDrilldown(action, {
        scope: 'organization',
        tile: { title: 'CAD', row, percent: 72, stats: [] },
        rows: [row],
        settings,
        range: {
          startDate: new Date(2026, 10, 1),
          endDate: new Date(2026, 10, 15),
          workingDaysOnly: true,
        },
      });
      const fixture = TestBed.createComponent(view!.component);
      for (const [name, value] of Object.entries(view!.inputs))
        fixture.componentRef.setInput(name, value);
      await fixture.whenStable();
      const expected = ['history', 'qos', 'utilizationHours'].includes(action) ? 2 : 1;
      const matching = call.mock.calls.filter(([sql]) =>
        String(sql).includes(`r_organization_${procedure.replace('r_organization_', '')}(`),
      );
      expect(matching).toHaveLength(1);
      expect(call.mock.calls[0][0]).toContain(`call esms_m.${procedure}(`);
      expect(call.mock.calls[0][0]).toContain("'srv'");
      const handle = setReportHandle.mock.calls[0][1];
      expect(handle.loading()).toBe(false);
      handle.refresh();
      await fixture.whenStable();
      expect(
        call.mock.calls.filter(([sql]) => String(sql).includes(`call esms_m.${procedure}(`)),
      ).toHaveLength(2);
      expect(call.mock.calls.length).toBeGreaterThanOrEqual(expected * 2);
      fixture.destroy();
      expect(setReportHandle).toHaveBeenLastCalledWith(9, null);
    },
  );

  it('reloads scoped reports only when SQL changes and never sends an invalid calendar date', async () => {
    TestBed.overrideComponent(GroupDetails, {
      remove: { imports: [DataGrid] },
      add: { imports: [GridStub] },
    });
    const fixture = TestBed.createComponent(GroupDetails);
    fixture.componentRef.setInput('row', { ...row, divn: 'Engineering' });
    fixture.componentRef.setInput('scope', 'division');
    fixture.componentRef.setInput('view', 'longDuration');
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('range', {
      startDate: new Date(2026, 10, 1),
      endDate: new Date(2026, 10, 15),
      workingDaysOnly: true,
    });
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('settings', {
      ...settings,
      heatmapColors: { ...settings.heatmapColors, at100: '#000000' },
    });
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('settings', { ...settings, workingHoursPerDay: 9 });
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][0]).toContain("'9'");
    fixture.componentInstance.startDate.set('2026-02-30');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportData.error()).toBe('Choose a valid date range.');
    expect(call).toHaveBeenCalledTimes(2);
    fixture.componentInstance.startDate.set('2026-11-02');
    await fixture.whenStable();
    expect(call).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.reportData.error()).toBe('');
  });

  it.each(literal(['division', 'department', 'reservation']))(
    'preserves the parent calendar period when opening %s',
    async (action) => {
      const view = await loadLicenseDrilldown(action, {
        scope: 'organization',
        tile: { title: 'CAD', row, percent: 72, stats: [] },
        rows: [row],
        settings,
        range: {
          startDate: new Date(2025, 0, 1),
          endDate: new Date(2025, 11, 31),
          workingDaysOnly: false,
        },
        reportRange: { kind: 'year', year: 2025 },
      });
      const fixture = TestBed.createComponent(view!.component);
      for (const [name, value] of Object.entries(view!.inputs))
        fixture.componentRef.setInput(name, value);
      await fixture.whenStable();
      const scope = action === 'reservation' ? 'group' : action;
      expect(
        call.mock.calls.some(
          ([sql]) => sql === `call esms_m.r_organization_groups_${scope}_year('srv','CAD','2025');`,
        ),
      ).toBe(true);
      expect(fixture.nativeElement.querySelector('app-feature-group-filter')).toBeNull();
    },
  );
});
