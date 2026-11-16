import { GridFixture } from '../../../testing/grid-fixture';
import { instance } from '../../../testing/instances';
import { describe, expect, it, vi } from 'vitest';
import {
  formatCompact,
  formatNumber,
  linkColumn,
  numberColumn,
  percentCell,
  toNumber,
} from './columns';

describe('grid formatting', () => {
  it('adds thousands separators and leaves empty values empty', () => {
    expect(formatNumber(1234567.25)).toBe('1,234,567.25');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber('n/a')).toBe('n/a');
  });

  it('never stringifies a non-text value to "[object Object]"', () => {
    expect(formatNumber({})).toBe('');
    expect(formatCompact({})).toBe('');
  });

  it('shortens large values, with exact limits (1,000,000 is 1 M, not 1000 K)', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(12500)).toBe('12.500 K');
    expect(formatCompact(1_000_000)).toBe('1.000 M');
    expect(formatCompact(2.123456)).toBe('2.1235');
  });

  it('gives number columns right alignment, a number filter and formatting', () => {
    const column = numberColumn<{ qty: number }>('qty', 'Quantity', { hide: true });
    expect(column).toMatchObject({
      field: 'qty',
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      hide: true,
    });
  });

  it('draws a band-coloured dot next to a percentage, as text not markup', () => {
    const cell = instance(percentCell(85, { lowBelow: 50, highFrom: 80 }), HTMLElement);
    expect(cell.textContent).toBe('85');
    expect(instance(cell.firstChild, HTMLElement).style.background).toBe('rgb(239, 68, 68)');
    expect(percentCell('', { lowBelow: 50, highFrom: 80 })).toBe('');
  });

  it('styles a link column as clickable and calls back with the clicked row', () => {
    const onClick = vi.fn();
    const column = linkColumn<{ name: string }>('name', 'Feature', onClick);
    expect(column.cellClass).toBe('link-cell');

    const row = { name: 'MATLAB_Report_Gen' };
    using grid = new GridFixture(row);
    column.onCellClicked?.(grid.click(row));
    expect(onClick).toHaveBeenCalledWith(row);

    onClick.mockClear();
    column.onCellClicked?.(grid.click(undefined));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reads numbers sent as text as numbers, so they sort and filter numerically', () => {
    const column = numberColumn<{ p_dp: string }>('p_dp', '%');
    using grid = new GridFixture({ p_dp: '' });
    const getter = column.valueGetter;
    if (typeof getter !== 'function') throw new Error('Missing number getter');
    const readValue = (text: string) => getter(grid.valueParams({ p_dp: text }));

    expect(readValue('100')).toBe(100);
    expect(readValue('9.5')).toBe(9.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
  });
});
