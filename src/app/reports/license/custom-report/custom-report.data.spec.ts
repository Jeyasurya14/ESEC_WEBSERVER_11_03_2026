import { describe, expect, it } from 'vitest';
import { customPercentiles } from './custom-report.data';

describe('Indexed percentile quantities', () => {
  it('joins each server independently and preserves the first matching quantity', () => {
    const rows = customPercentiles(
      [
        { lic_name: 'CAD', server: 'A', qty_dp: 4 },
        { lic_name: 'CAD', server: 'B', qty_dp: 8 },
      ],
      95,
      true,
      [
        { lic_name: 'CAD', server: 'A', l_qty_i: 10 },
        { lic_name: 'CAD', server: 'A', l_qty_i: 99 },
        { lic_name: 'CAD', server: 'B', l_qty_i: 20 },
      ],
    );
    expect(rows.map((row) => row['l_qty_i'])).toEqual([10, 20]);
  });

  it('does not match a missing feature name to a null name', () => {
    const [row] = customPercentiles([{ qty_dp: 4 }], 95, false, [{ lic_name: null, l_qty_i: 99 }]);
    expect(row).not.toHaveProperty('l_qty_i');
  });
});
