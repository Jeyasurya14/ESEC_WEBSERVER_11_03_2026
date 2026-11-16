import { literal } from '../../../core/utils/data';
import { organizationRow } from '../../../../testing/report-fixtures';
import { describe, expect, it } from 'vitest';

import { debugSessionQuery, detailQuery, DetailParameters, DetailView } from './detail-queries';
import { organizationBreakdownCall } from '../drilldown/breakdown-queries';

const row = organizationRow({ server: 'srv', lic: 'CAD' });
const reportOptions: DetailParameters = {
  start: '2026-11-01',
  end: '2026-11-15',
  startTime: '10:00',
  endTime: '17:00',
  workingDays: false,
  workingHours: 7,
  businessHours: false,
  granularity: 'date',
  usageView: 'summary',
  checkoutView: 'date',
  category: 'date',
  reduction: 1,
  newCalculation: false,
};
const base: [DetailView, string][] = [
  [
    'utilization',
    "organization_utilization_date('srv','CAD','2026-11-01','2026-11-15','10:00','17:00')",
  ],
  ['history', "organization_history('srv','CAD','2026-11-01','2026-11-15','Y','1')"],
  [
    'qos',
    "organization_qos('srv','CAD','date','24','Y','1','2026-11-01','2026-11-15','00:00','24:00')",
  ],
  ['heatmap', "organization_utilization_hour('srv','CAD','2026-11-01','2026-11-15')"],
  ['month', "organization_month('srv','CAD','2026-11-01','2026-11-15','7','Y')"],
  ['date', "organization_date('srv','CAD','2026-11-01','2026-11-15')"],
  ['hours', "organization_usage_date('srv','CAD','2026-11-01','2026-11-15','7')"],
  ['usage', "organization_usage('srv','All','2026-11-01','2026-11-15','Y')"],
  [
    'utilizationHours',
    "organization_usage_utilization_date_2('srv','CAD','2026-11-01','2026-11-15','Y')",
  ],
  ['checkoutUser', "organization_users_checkout_list_date('srv','CAD','2026-11-01','2026-11-15')"],
  [
    'checkoutCount',
    "organization_users_checkout_date('srv','CAD','2026-11-01','2026-11-15','10:00','17:00')",
  ],
  [
    'longDuration',
    "organization_users_checkout_list_duration('srv','CAD','2026-11-01','2026-11-15','7')",
  ],
  ['denial', "organization_users_denial_users('srv','CAD','2026-11-01','2026-11-15')"],
  ['borrow', "organization_users_borrow('srv','CAD','2026-11-01','2026-11-15')"],
  ['assetInfo', "organization_utilization_asset_info('srv','2026-11-01','2026-11-15','','Y')"],
  ['debugData', "organization_debug_data('srv','CAD','2026-11-01','2026-11-15')"],
];
describe('Company Organization detail procedure contracts', () => {
  it.each(base)('matches %s argument order and default flags', (view, expected) => {
    expect(detailQuery(view, row, reportOptions)).toBe(`call esms_m.r_${expected};`);
  });
  it.each(literal(['week', 'month', 'qtr', 'year', 'scatter']))(
    'supports Utilization %s',
    (granularity) => {
      const query = detailQuery('utilization', row, { ...reportOptions, granularity });
      expect(query).toContain(`r_organization_utilization_${granularity}(`);
      expect(query).toContain(granularity === 'scatter' ? "'y');" : "'10:00','17:00');");
    },
  );
  it('matches each procedure family’s distinct working-day and working-hour conventions', () => {
    const work = {
      ...reportOptions,
      workingDays: true,
      businessHours: true,
      granularity: literal('month'),
    };
    expect(detailQuery('month', row, work)).toContain("'7','N');");
    expect(detailQuery('hours', row, work)).toContain("'7','N');");
    expect(detailQuery('assetInfo', row, work)).toContain("'W','N');");
    expect(detailQuery('history', row, work)).toContain("'','1');");
    expect(detailQuery('qos', row, { ...work, category: 'points' })).toContain(
      "'CAD','','','','1'",
    );
  });
  it('loads the separate History counts and QOS usage distributions', () => {
    expect(detailQuery('history', row, reportOptions, true)).toBe(
      "call esms_m.r_organization_history_1('srv','CAD','2026-11-01','2026-11-15','Y');",
    );
    expect(detailQuery('qos', row, reportOptions, true)).toBe(
      "call esms_m.r_organization_qos_1('srv','CAD','24','Y','1','2026-11-01','2026-11-15');",
    );
  });
  it('supports all Usage tabs and Date/Time checkout', () => {
    expect(detailQuery('usage', row, { ...reportOptions, usageView: 'daywise' })).toContain(
      "r_organization_usage_1('srv','All','2026-11-01','2026-11-15')",
    );
    expect(detailQuery('usage', row, { ...reportOptions, usageView: 'session' })).toContain(
      'r_organization_usage_2(',
    );
    expect(detailQuery('usage', row, { ...reportOptions, usageView: 'matrix' })).toBe(
      detailQuery('usage', row, reportOptions),
    );
    expect(detailQuery('checkoutUser', row, { ...reportOptions, checkoutView: 'time' })).toContain(
      "r_organization_users_checkout_list_date_time('srv','CAD','2026-11-01','2026-11-15','10:00','17:00')",
    );
  });
  it('keeps utilization-hours grid and chart procedures distinct, including the new monthly calculation', () => {
    expect(detailQuery('utilizationHours', row, reportOptions)).toContain('date_2(');
    expect(detailQuery('utilizationHours', row, reportOptions, true)).toContain('date_1(');
    expect(
      detailQuery('utilizationHours', row, { ...reportOptions, granularity: 'month' }, true),
    ).toContain('month_1(');
    expect(
      detailQuery(
        'utilizationHours',
        row,
        { ...reportOptions, granularity: 'month', newCalculation: true },
        true,
      ),
    ).toContain('month_2(');
  });
  it('rejects impossible dates, reversed ranges, invalid times and invalid numeric parameters', () => {
    for (const change of [
      { start: '2026-02-30' },
      { start: '2027-01-01' },
      { startTime: '25:00' },
      { endTime: '09:00' },
      { workingHours: 0 },
      { reduction: NaN },
    ])
      expect(detailQuery('date', row, { ...reportOptions, ...change })).toBeNull();
  });
  it('opens debug session details using the clicked row identity', () => {
    expect(debugSessionQuery({ server: 'audit', lic: "O'Brien" }, reportOptions)).toBe(
      "call esms_m.r_license_debug_data_1('audit','O''Brien','2026-11-01','2026-11-15');",
    );
    expect(debugSessionQuery({}, reportOptions)).toBeNull();
  });
  it('uses the correct calendar suffixes for Divn/Dept/Reservation breakdowns', () => {
    expect(organizationBreakdownCall('division', row, { kind: 'days', days: 'YTD' })).toBe(
      "call esms_m.r_organization_groups_division_grid('srv','CAD','YTD');",
    );
    expect(
      organizationBreakdownCall('department', row, { kind: 'month', month: 11, year: 2026 }),
    ).toBe("call esms_m.r_organization_groups_department_month_year('srv','CAD','11','2026');");
    expect(
      organizationBreakdownCall('group', row, { kind: 'quarter', quarter: 4, year: 2026 }),
    ).toContain("group_qtr_year('srv','CAD','4','2026')");
    expect(organizationBreakdownCall('group', row, { kind: 'year', year: 2025 })).toContain(
      "group_year('srv','CAD','2025')",
    );
  });
});
