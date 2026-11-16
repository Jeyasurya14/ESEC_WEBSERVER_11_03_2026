import { featureGroupParam } from '../../../shared/filters/feature-group-filter';
import { ReportRange, rangeCall } from '../../../shared/filters/range-filter';
import {
  Column,
  dateColumn,
  numberColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface DenialRow {
  sw: string;
  server: string;
  location: string;
  lic: string;
  lic_name: string;
  l_qty_i: number;
  di: number;
  ad: number;
  td: number;
  dd: number;
  expiry: string;
  start_date: string;
  last_date: string;
  status: string;
  bundle: string;
}

export function denialCall(userId: string, range: ReportRange, featureGroup: string): string {
  return rangeCall('esms_m.r_denial_grid', range, [userId], [featureGroupParam(featureGroup)]);
}

export function denialColumns(): Column<DenialRow>[] {
  return [
    rowNumberColumn(),
    textColumn('sw', 'Software', { width: 100, pinned: 'left' }),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('location', 'Location', { width: 100, pinned: 'left', hide: true }),
    textColumn('lic', 'License', { width: 150, pinned: 'left', hide: true }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    numberColumn('l_qty_i', 'Last Issued', { width: 100 }),
    numberColumn('di', 'User', { width: 70 }),
    numberColumn('ad', 'Denial Users', { width: 90, hide: true }),
    numberColumn('td', 'True Denial', { width: 90 }),
    numberColumn('dd', 'Denial Days', { width: 90 }),
    dateColumn('expiry', 'Expiry', { width: 100 }),
    dateColumn('start_date', 'Enrolled Date', { width: 140, hide: true }),
    dateColumn('last_date', 'Collected Date', { width: 140 }),
    textColumn('status', 'Status', { width: 85 }),
    textColumn('bundle', 'Primary', {
      width: 100,
      hide: true,
      suppressColumnsToolPanel: true,
      suppressFiltersToolPanel: true,
    }),
  ];
}
