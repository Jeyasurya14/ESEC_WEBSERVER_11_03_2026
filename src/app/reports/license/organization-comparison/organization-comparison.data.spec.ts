import { reportSettings } from '../../../../testing/report-fixtures';
import { describe, expect, it } from 'vitest';

import {
  ComparisonRequest,
  comparisonCall,
  comparisonColumns,
  comparisonMonths,
  comparisonPeriods,
  pivotComparison,
} from './organization-comparison.data';

const request: ComparisonRequest = {
  mode: 'month',
  years: [2025, 2026],
  startMonth: '2025-12',
  endMonth: '2026-02',
  compareYear: 2025,
  primary: true,
};

describe('Organization By Year Month data', () => {
  it('calls the month procedure with inclusive months and the primary feature flag', () => {
    expect(comparisonCall(request)).toBe(
      'call esms_m.r_organization_year_month_2_server(\'[{"year":2025,"month":12},{"year":2026,"month":1},{"year":2026,"month":2}]\',\'Y\');',
    );
  });
  it('keeps period headings chronological across year boundaries', () => {
    expect(comparisonPeriods(request)).toEqual(['DEC-2025', 'JAN-2026', 'FEB-2026']);
    expect(comparisonPeriods({ ...request, mode: 'year', years: [2026, 2024] })).toEqual([
      '2024',
      '2026',
    ]);
  });
  it('rejects reversed, malformed, invalid and excessively long month ranges', () => {
    for (const [start, end] of [
      ['', '2026-01'],
      ['2026-13', '2027-01'],
      ['2026-02', '2026-01'],
      ['2020-01', '2026-01'],
    ]) {
      expect(comparisonMonths(start, end)).toEqual([]);
    }
  });
  it('uses separate year and year-versus-month procedure contracts', () => {
    expect(comparisonCall({ ...request, mode: 'year' })).toContain('_1_server');
    expect(comparisonCall({ ...request, mode: 'compare', primary: false })).toBe(
      "call esms_m.r_organization_year_month_3_server('2025','2025','12','');",
    );
  });
  it('pivots the selected metric by license and period, without dividing by zero', () => {
    const rows = pivotComparison(
      [
        { server: 's', lic: 'A', month_year: 'Jan-2026', qty_i: 10, qty_wp: 4, di: 3 },
        { server: 's', lic: 'A', month_year: 'FEB-2026', qty_i: 10, qty_wp: 5 },
        { server: 's', lic: 'B', month_year: 'JAN-2026', qty_i: 0, qty_wp: 0 },
      ],
      'WP',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]['JAN-2026:percent']).toBe(40);
    expect(rows[0]['FEB-2026:value']).toBe(5);
    expect(rows[1]['JAN-2026:percent']).toBe(0);
  });
  it('builds a column group for each selected period', () => {
    const columns = comparisonColumns(
      comparisonPeriods(request),
      'WP',
      reportSettings({
        lowBelow: 60,
        highFrom: 80,
      }),
    );
    expect(columns.filter((column) => 'children' in column)).toHaveLength(3);
  });
});
