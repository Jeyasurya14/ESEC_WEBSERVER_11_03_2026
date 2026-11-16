import { reportSettings } from '../../../testing/report-fixtures';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../core/api/api.service';
import { LoginService } from '../../core/auth/login.service';
import { ReportFilters } from '../../shared/filters/report-filters';
import { ReportSettings, ReportSettingsService } from '../../shared/report-settings.service';
import { DataGrid } from '../../shared/grid/data-grid';
import { LicenseAgent } from './license-agent/license-agent';
import { CustomReport } from './custom-report/custom-report';
import { featureId } from './custom-report/custom-report.data';

const settings = reportSettings({
  workingHoursPerDay: 7,
  divisionLabel: 'Division',
  departmentLabel: 'Department',
  lowBelow: 60,
  highFrom: 80,
});

// Real grid rendering is covered for every screen by reports.spec.ts. These tests isolate
// parameter/query behavior so AG Grid's expensive jsdom layout does not affect their timing.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-data-grid',
  template: '',
})
class LicenseGridStub {
  readonly rows = input<unknown[]>([]);
  readonly columns = input<unknown[]>([]);
  readonly search = input('');
  readonly loading = input(false);
  readonly emptyText = input('');
  readonly rowCount = output<string>();
  readonly filtersCleared = output<void>();
}

describe('License report API integration', () => {
  it('offers software returned under sw_name and queries the selected software', async () => {
    const call = vi.fn((sql: string) =>
      of({ status: 'PASS', message: sql.includes('_sw_list') ? [{ sw_name: 'CATIA' }] : [] }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { call, getSetting: () => '' } },
        { provide: ReportSettingsService, useValue: { load: async () => settings } },
      ],
    });
    TestBed.overrideComponent(LicenseAgent, {
      remove: { imports: [DataGrid] },
      add: { imports: [LicenseGridStub] },
    });
    const fixture = TestBed.createComponent(LicenseAgent);
    fixture.componentRef.setInput('menu', {
      mainMenuName: 'LICENSE',
      subMenuName: 'License and Agent Combined',
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.softwareOptions()).toContainEqual({
      value: 'CATIA',
      label: 'CATIA',
    });
    fixture.componentInstance.chooseSoftware('CATIA');
    await fixture.whenStable();
    expect(
      call.mock.calls.some(([sql]) => sql.startsWith("call esms_m.r_license_agent_sw('CATIA'")),
    ).toBe(true);
    fixture.componentInstance.chooseSoftware('');
    await fixture.whenStable();
    expect(fixture.componentInstance.reportData.loading()).toBe(false);
  });

  it('opens a feature group in the report builder and sends only the selected features', async () => {
    const features = [
      { sw: 'CAD', server: 'srv', lic: 'first', lic_name: 'First' },
      { sw: 'CAD', server: 'srv', lic: 'second', lic_name: 'Second' },
    ];
    const call = vi.fn((sql: string) =>
      of({
        status: 'PASS',
        message: sql.includes('select_parameters')
          ? features
          : sql.includes('_load(')
            ? []
            : [{ server: 'srv', lic_name: 'First', qty_dp: 4 }],
      }),
    );
    const filters = {
      settings: signal<ReportSettings | null>(null),
      error: signal(''),
      start: async () => {
        filters.settings.set(settings);
        return true;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { call, getSetting: () => '' } },
        { provide: LoginService, useValue: { user: signal({ userId: 'john' }) } },
      ],
    });
    TestBed.overrideComponent(CustomReport, {
      remove: { imports: [DataGrid], providers: [ReportFilters] },
      add: {
        imports: [LicenseGridStub],
        providers: [{ provide: ReportFilters, useValue: filters }],
      },
    });
    const fixture = TestBed.createComponent(CustomReport);
    fixture.componentRef.setInput('menu', {
      mainMenuName: 'LICENSE',
      subMenuName: 'Report Type 1',
    });
    fixture.componentRef.setInput('initialFeatures', [features[0]]);
    await fixture.whenStable();
    expect(fixture.componentInstance.selectedFeatureIds()).toEqual(
      new Set([featureId(features[0])]),
    );
    const reportQueries = call.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.includes('_utilization_p('));
    expect(reportQueries.length).toBeGreaterThan(0);
    expect(reportQueries.at(-1)).toContain('[{"svr":"srv","ftr":"first"}]');
    expect(reportQueries.at(-1)).not.toContain('second');
    fixture.componentInstance.selectedFeatureIds.set(new Set());
    await fixture.whenStable();
    expect(fixture.componentInstance.reportData.rows()).toEqual([]);
    expect(fixture.componentInstance.reportData.loading()).toBe(false);
  });
});
