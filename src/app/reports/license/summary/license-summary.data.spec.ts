import { organizationRow, reportSettings } from '../../../../testing/report-fixtures';
import { describe, expect, it } from 'vitest';

import { LicenseScope } from '../grouped-reports';
import {
  SUMMARY_PERIODS,
  summaryCall,
  summaryIndicatorColumns,
  summaryIndicators,
} from './license-summary.data';

const row = organizationRow({
  server: 'srv',
  lic: 'CAD',
  divn: 'Engineering',
  dept: 'Design',
  g_type: 'Team',
  g_name: 'Alpha',
});
const scopes: [LicenseScope, string][] = [
  ['organization', "'srv','CAD'"],
  ['division', "'srv','CAD','Engineering'"],
  ['department', "'srv','CAD','Engineering','Design'"],
  ['group', "'srv','CAD','Team','Alpha'"],
];

describe('Company Summary query contracts', () => {
  it.each(scopes)(
    'uses all five %s procedures with the complete selected scope identity',
    (scope, args) => {
      for (const period of SUMMARY_PERIODS) {
        expect(summaryCall(scope, row, period.id)).toBe(
          `call esms_m.r_${scope}_chart_${period.suffix}(${args});`,
        );
      }
      expect(summaryCall(scope, row, 'indicators')).toBe(
        `call esms_m.r_${scope}_indicator(${args});`,
      );
    },
  );

  it('escapes company names without changing the identity argument order', () => {
    expect(summaryCall('department', { ...row, divn: "O'Brien", dept: "R'D" }, 'day')).toBe(
      "call esms_m.r_department_chart_30('srv','CAD','O''Brien','R''D');",
    );
  });
});

describe('Company Summary indicators', () => {
  it('pivots all seven returned periods into metric rows and scales hours once without mutating results', () => {
    const records = [
      {
        type: 'YTD',
        max_qty_i: 12,
        max_qty_r: 3,
        qty_db: 1,
        qty_dp: 10,
        tlh_24: 48,
        tot_du_q: 7,
        avg_du: 2.5,
      },
      { type: '7', max_qty_i: '9', tlh_24: 24, tot_du_q: 3.5 },
      ...['30', '60', '90', '180', '360'].map((type) => ({ type, max_qty_i: 8 })),
    ];
    const original = structuredClone(records);
    const result = summaryIndicators(records, 'organization', 7);
    const metric = (label: string) => result.find((item) => item.description === label)!;
    expect(result).toHaveLength(17);
    expect(metric('Issued')).toMatchObject({
      ytd: 12,
      '07': 9,
      '30': 8,
      '60': 8,
      '90': 8,
      '180': 8,
      '360': 8,
    });
    expect(metric('Reserved').ytd).toBe(3);
    expect(metric('License Hours Available').ytd).toBe(14);
    expect(metric('License Hours % - 7 Hrs')).toMatchObject({
      percentage: true,
      ytd: 50,
      '07': 50,
    });
    expect(metric('License Hours Used').ytd).toBe(2.5);
    expect(records).toEqual(original);
    expect(summaryIndicators(records, 'organization', 7)).toEqual(result);
  });

  it.each<LicenseScope>(['division', 'department'])(
    'matches %s metrics without Organization capacity-only rows',
    (scope) => {
      const result = summaryIndicators([{ type: '30', max_qty_i: 5 }], scope, 7);
      expect(result).toHaveLength(14);
      expect(
        result.some(
          (item) =>
            item.description === 'Reserved' ||
            item.description.startsWith('License Hours Available') ||
            item.percentage,
        ),
      ).toBe(false);
    },
  );

  it('includes reservation and capacity metrics for Group', () => {
    expect(
      summaryIndicators([{ type: '30', max_qty_r: 4 }], 'group', 7).find(
        (item) => item.description === 'Reserved',
      )?.['30'],
    ).toBe(4);
  });

  it('handles zero capacity, missing periods and non-finite values safely', () => {
    const result = summaryIndicators(
      [{ type: '30', tlh_24: 0, tot_du_q: 3, max_qty_i: 'bad' }],
      'organization',
      7,
    );
    expect(result.find((item) => item.percentage)?.['30']).toBe(0);
    expect(result.find((item) => item.description === 'Issued')).toMatchObject({
      '30': null,
      ytd: null,
    });
    expect(summaryIndicators([], 'organization', 7)).toEqual([]);
    expect(summaryIndicators([{ type: 'invalid' }], 'organization', 7)).toEqual([]);
  });

  it('uses seven columns in company order and freezes the Description column', () => {
    const columns = summaryIndicatorColumns(reportSettings({ lowBelow: 60, highFrom: 80 }));
    expect(columns.map((column) => ('field' in column ? column.field : ''))).toEqual([
      'description',
      'ytd',
      '07',
      '30',
      '60',
      '90',
      '180',
      '360',
    ]);
    expect(columns[0]).toMatchObject({ pinned: 'left', headerName: 'Description' });
  });
});
