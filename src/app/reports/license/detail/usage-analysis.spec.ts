import { organizationRow } from '../../../../testing/report-fixtures';
import { describe, expect, it } from 'vitest';
import { durationPoints, groupUsage, polynomialCurve, usageMatrix } from './usage-analysis';
import { bundleMatrix } from '../bundle/bundle-matrix';

describe('Report analysis and grouping', () => {
  it('matches cumulative History/QOS levels, including the source zero-level convention', () => {
    expect(durationPoints([{ used: 0 }, { used: 2 }, { used: 2 }, { used: 4 }], 'used')).toEqual([
      { quantity: 0, count: 1, percentage: 25 },
      { quantity: 2, count: 3, percentage: 75 },
      { quantity: 4, count: 1, percentage: 25 },
    ]);
    expect(durationPoints([{ used: 1000000000 }], 'used', true)).toHaveLength(5000);
  });
  it('fits normalized polynomial comparisons and handles singular/insufficient data', () => {
    const points = Array.from({ length: 10 }, (_, quantity) => ({
      quantity: quantity,
      count: 0,
      percentage: 100 - quantity * quantity,
    }));
    polynomialCurve(points, 2).forEach(([quantity, percentage]) =>
      expect(percentage).toBeCloseTo(100 - quantity * quantity, 6),
    );
    expect(polynomialCurve(points.slice(0, 2), 4)).toEqual([]);
    expect(durationPoints([], 'used')).toEqual([]);
  });
  it('keeps departments with identical names in different divisions separate and counts distinct users', () => {
    const rows = [
      { divn: 'A', dept: 'Design', user_id: 'u1', du: 2 },
      { divn: 'B', dept: 'Design', user_id: 'u1', du: 3 },
      { divn: 'A', dept: 'Design', user_id: 'u1', du: 4 },
    ];
    const result = groupUsage(rows, 'dept');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ divn: 'A', dept: 'Design', du: 6, users: 1 });
    expect(rows[0].du).toBe(2);
  });
  it('builds usage matrices without allowing group labels to overwrite user identity', () => {
    expect(usageMatrix([{ user_id: 'u1', divn: 'user_id', du_q: 3 }], 'divn')).toEqual([
      { user_id: 'u1', user_name: '', 'hours: user_id': 3, total_hours: 3 },
    ]);
  });
});

describe('Company Bundle comparison', () => {
  const rows = [
    { server: 'a', lic_name: 'B1_Common', l_qty_i: 10, qty_dp: 3 },
    { server: 'a', lic_name: 'B1_Only', l_qty_i: 2, qty_dp: 1 },
    { server: 'b', lic_name: 'B2_Common', l_qty_i: 5, qty_dp: 2 },
  ].map((row) => organizationRow(row));
  it('compares common and uncommon submodules with issued/peak sums and distinct server counts', () => {
    const common = bundleMatrix(rows, 'b1,b2', 'common');
    expect(common.rows).toEqual([
      {
        submodule: 'Common',
        sum_issued: 15,
        sum_peak: 5,
        b0_issued: 10,
        b0_peak: 3,
        b1_issued: 5,
        b1_peak: 2,
      },
    ]);
    expect(common.serverCounts[0]).toMatchObject({ sum_issued: 2, b0_issued: 1, b1_issued: 1 });
    expect(bundleMatrix(rows, 'B1,B2', 'uncommon').rows.map((row) => row['submodule'])).toEqual([
      'Only',
    ]);
    expect(bundleMatrix(rows, 'absent', 'all').rows).toEqual([]);
    expect(rows[0].l_qty_i).toBe(10);
  });
});
