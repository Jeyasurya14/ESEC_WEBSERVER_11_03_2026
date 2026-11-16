import { featureGroupParam } from '../../../shared/filters/feature-group-filter';
import { ReportRange, rangeCall } from '../../../shared/filters/range-filter';
import {
  Column,
  columnGroup,
  numberColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface BorrowRow {
  sw: string;
  server: string;
  location: string;
  lic: string;
  lic_name: string;
  user_id: string;
  user_name: string;
  count: number;
  status: string;
}

export function borrowCall(userId: string, range: ReportRange, featureGroup: string): string {
  debugger;
  return rangeCall('esms_m.r_borrow_grid', range, [userId], [featureGroupParam(featureGroup)]);
}

/** The company app's user demographics columns (region, country, ...) are left out, as elsewhere. */
export function borrowColumns(): Column<BorrowRow>[] {
  return [
    rowNumberColumn(),
    textColumn('sw', 'Software', { width: 100, pinned: 'left' }),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('location', 'Location', { width: 100, pinned: 'left', hide: true }),
    textColumn('lic', 'License', { width: 150, pinned: 'left', hide: true }),
    textColumn('lic_name', 'Feature', { width: 200, pinned: 'left' }),
    columnGroup('User', [
      textColumn('user_id', 'User Id', { width: 100 }),
      textColumn('user_name', 'User Name', { width: 130, hide: true }),
    ]),
    numberColumn('count', 'Count', { width: 80 }),
    textColumn('status', 'Status', { width: 85 }),
  ];
}
