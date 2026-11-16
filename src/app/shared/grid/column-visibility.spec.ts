import { describe, expect, it } from 'vitest';
import { datePath, numberColumn, textColumn } from './columns';
import { rowCountText } from './data-grid';
import { applyColumnVisibility, readColumnVisibility } from './column-visibility';

describe('My Columns', () => {
  it("uses the company app's defaults for a user who never changed them", () => {
    const hidden = readColumnVisibility(undefined);
    expect(hidden['qty_dp']).toBe(false);
    expect(hidden['qty_da']).toBe(true);
    expect(hidden['qty_wam']).toBe(false);
  });

  it("applies the user's saved choices over the defaults, ignoring malformed entries", () => {
    const hidden = readColumnVisibility([
      { colId: 'qty_dp', hide: true },
      { colId: 'qty_da', hide: 'no' },
      null,
    ]);
    expect(hidden['qty_dp']).toBe(true);
    expect(hidden['qty_da']).toBe(true);
  });

  it('shows or hides the columns it knows, inside groups too, and leaves the others alone', () => {
    type Row = { qty_wa: number; lic: string };
    const columns = [
      { headerName: 'Work Avg', children: [numberColumn<Row>('qty_wa', 'Qty', { hide: true })] },
      textColumn<Row>('lic', 'License', { hide: true }),
    ];

    const shown = applyColumnVisibility(columns, { qty_wa: false });

    const [group, leaf] = shown;
    if (!('children' in group) || 'children' in leaf) throw new Error('Unexpected column shape');
    const child = group.children[0];
    if ('children' in child) throw new Error('Expected leaf column');
    expect(child.hide).toBe(false);
    expect(leaf.hide).toBe(true);
  });
});

describe('grid details', () => {
  it("counts rows in the company app's format", () => {
    expect(rowCountText(1234, 1234, false)).toBe('1,234');
    expect(rowCountText(56, 1234, true)).toBe('56 of 1,234');
    expect(rowCountText(0, 0, false)).toBe('');
  });

  it('files dates under year, month and day in the date filter', () => {
    expect(datePath('2026-03-05')).toEqual(['2026', 'Mar', '05']);
    expect(datePath('1-jan-0')).toEqual(['(Blanks)']);
  });
});
