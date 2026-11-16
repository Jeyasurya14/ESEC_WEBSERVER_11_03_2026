import { organizationRow } from '../../../testing/report-fixtures';
import { describe, expect, it } from 'vitest';
import { REPORT_LOADERS } from '../report-registry';

import {
  ComparisonRequest,
  comparisonCall,
  comparisonMonths,
  pivotComparison,
} from './organization-comparison/organization-comparison.data';
import { customReportCall, sessionSaveCall } from './custom-report/custom-report.data';
import { groupedCall } from './grouped-reports';
import { GroupReportRequest, groupReportCall } from './group-details/group-queries';
import { licenseUsageCall, prepareUsage, usageMatrix } from './usage/usage.data';

describe('License migration contracts', () => {
  const screens = [
    'Organization',
    'Organization By Week',
    'Organization By Year Month',
    'Division',
    'Department',
    'Group',
    'My Feature',
    'Report Type 1',
    'Denial',
    'Borrow',
    'Usage',
    'User',
    'Computer',
    'Group Member',
    'License and Agent Combined',
    'Debug Data',
  ];
  it.each(screens)('registers the source License / %s screen', (screen) => {
    expect(REPORT_LOADERS.has(`LICENSE/${screen}`)).toBe(true);
  });

  it('keeps the grouped query identity, range and feature group', () => {
    expect(
      groupedCall(
        'department',
        "o'connor",
        { kind: 'month', year: 2026, month: 11 },
        'Primary Feature',
      ),
    ).toBe("call esms_m.r_department_grid_month_year('o''connor','11','2026','Pri');");
  });

  const comparison: ComparisonRequest = {
    mode: 'compare',
    years: [2025, 2026],
    startMonth: '2026-11',
    endMonth: '2026-12',
    compareYear: 2025,
    primary: false,
  };
  it('uses each year/month mode with its original argument shape', () => {
    expect(comparisonCall(comparison)).toBe(
      "call esms_m.r_organization_year_month_3_server('2025','2026','11','');",
    );
    expect(comparisonCall({ ...comparison, mode: 'year', primary: true })).toContain(
      '_1_server(\'[{"year":"2025"},{"year":"2026"}]\',\'Y\')',
    );
    expect(comparisonMonths('2025-12', '2026-02')).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(comparisonMonths('2026-12', '2026-01')).toEqual([]);
  });
  it('pivots the selected usage metric without merging distinct server/license pairs', () => {
    const rows = pivotComparison(
      [
        { server: 's', lic: 'l', value: '2026', qty_i: 10, qty_wp: 7 },
        { server: 's', lic: 'other', value: '2026', qty_i: 0, qty_wp: 0 },
      ],
      'WP',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]['2026:percent']).toBe(70);
    expect(rows[1]['2026:percent']).toBe(0);
  });
  it('calculates user usage against working hours for the selected days', () => {
    expect(prepareUsage([{ count_days: 2, du: 7, dw: 3.5 }], 7)[0]).toMatchObject({
      p_du: 50,
      p_dw: 25,
    });
    expect(licenseUsageCall(['CATIA'], '2026-11-01', '2026-11-15', 'All Feature', true)).toBe(
      "call esms_m.r_license_usage_sw('[{\"sw\":\"CATIA\"}]','2026-11-01','2026-11-15','All','');",
    );
  });
  it('calculates matrix shares separately for each feature and distinct users', () => {
    const rows = usageMatrix(
      [
        { sw: 'x', server: 's', lic: 'a', divn: 'D1', du: 2, user_id: 'alice' },
        { sw: 'x', server: 's', lic: 'a', divn: 'D2', du: 6, user_id: 'bob' },
        { sw: 'x', server: 's', lic: 'b', divn: 'D1', du: 10, user_id: 'alice' },
      ],
      'Matrix Sw Svr Ftr',
      'division',
    );
    expect(rows.map((row) => row['p_du'])).toEqual([25, 75, 100]);
    expect(rows[0]['users']).toBe(1);
  });
  const scoped: GroupReportRequest = {
    scope: 'department',
    view: 'borrow',
    row: organizationRow({ server: 'srv', lic: 'lic', divn: 'D1', dept: 'Design' }),
    start: '2026-11-01',
    end: '2026-11-15',
    startTime: '10:00',
    endTime: '17:00',
    workingHours: 7,
    workingDays: true,
    granularity: 'date',
  };
  it('retains division and department in drilldown queries', () => {
    expect(groupReportCall(scoped)).toBe(
      "call esms_m.r_department_users_borrow('srv','lic','D1','Design','2026-11-01','2026-11-15');",
    );
    expect(groupReportCall({ ...scoped, view: 'utilization' })).toContain(
      "'D1','Design','2026-11-01','2026-11-15','10:00','17:00'",
    );
  });
  it('uses compact svr/ftr selections in custom reports and preserves named sessions', () => {
    const features = [{ sw: 'CAD', server: 'srv', lic: 'lic', lic_name: 'Feature' }];
    const sql = customReportCall({
      view: 'Utilization',
      start: '2026-11-01',
      end: '2026-11-15',
      features,
      workingDays: true,
      details: true,
      workingHours: 7,
      usageMode: 'svr_ftr',
    });
    expect(sql).toBe(
      'call esms_m.r_report_view_1_utilization_c(\'2026-11-01\',\'2026-11-15\',\'\',\'[{"svr":"srv","ftr":"lic"}]\');',
    );
    expect(sessionSaveCall('john', "John's CAD", features)).toContain("'John''s CAD'");
    expect(sessionSaveCall('john', 'CAD', features)).toContain('"select":"FT"');
  });
});
