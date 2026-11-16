import { GridFixture } from '../../../../testing/grid-fixture';
import { detailParameters } from '../../../../testing/report-fixtures';
import type { ColDef } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';
import { Column } from '../../../shared/grid/columns';
import { LicenseRecord } from '../report-helpers';
import { DEFAULT_DETAIL_SETTINGS } from './license-detail';
import { DetailView } from './detail-queries';
import { detailColumns, detailLinks } from './detail-columns';

function leafColumns(columns: Column<LicenseRecord>[]): ColDef<LicenseRecord>[] {
  return columns.flatMap((column) =>
    'children' in column ? leafColumns(column.children) : [column],
  );
}
const parameters = detailParameters({ granularity: 'date', usageView: 'summary' });

describe('Shared detail columns', () => {
  it.each([
    'date',
    'month',
    'hours',
    'usage',
    'utilizationHours',
    'checkoutUser',
    'longDuration',
    'borrow',
    'denial',
    'assetInfo',
  ] satisfies DetailView[])(
    'preserves backend extension fields without duplicating named columns for %s',
    (view) => {
      const columns = leafColumns(
        detailColumns(
          view,
          [{ user_id: 'u1', company_extra: 'extra' }],
          DEFAULT_DETAIL_SETTINGS,
          parameters,
        ),
      );
      const fields = columns.map((column) => column.field).filter(Boolean);
      expect(fields).toContain('company_extra');
      expect(new Set(fields).size).toBe(fields.length);
    },
  );

  it('calculates checkout license hours from duration and quantity, including string API values', () => {
    const columns = leafColumns(
      detailColumns('checkoutUser', [], DEFAULT_DETAIL_SETTINGS, parameters),
    );
    const getter = columns.find((column) => column.colId === 'lic_hrs')!.valueGetter;
    expect(typeof getter).toBe('function');
    if (typeof getter !== 'function') throw new Error('Missing license-hours calculation');
    const row: LicenseRecord = { du: '1.5', qty_u: '4' };
    using grid = new GridFixture(row);
    expect(getter(grid.valueParams(row))).toBe(6);
  });

  it('preserves the selected row identity through nested column links and ignores group headers', () => {
    const select = vi.fn();
    const columns = detailLinks(
      [{ headerName: 'Users', children: [{ field: 'user_id' }] }],
      ['user_id'],
      select,
    );
    const column = leafColumns(columns)[0];
    const row: LicenseRecord = { user_id: 'u1', server: 'srv' };
    using grid = new GridFixture(row);
    column.onCellClicked!(grid.click(row));
    expect(select).toHaveBeenCalledExactlyOnceWith(row);
    column.onCellClicked!(grid.click(undefined));
    expect(select).toHaveBeenCalledOnce();
  });
});
