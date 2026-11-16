import { sqlString } from '../../../core/api/api.service';
import {
  Column,
  columnGroup,
  dateColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface ComputerRow {
  server: string;
  lic: string;
  lic_name: string;
  wksn: string;
  access: string;
  access_date: string;
  access_time: string;
  denial: string;
  denial_date: string;
  denial_time: string;
}

export function computerCall(userId: string): string {
  return `call esms_m.r_license_wksn(${sqlString(userId)});`;
}

export function computerColumns(): Column<ComputerRow>[] {
  return [
    rowNumberColumn(),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('lic', 'License', { width: 150, pinned: 'left' }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    textColumn('wksn', 'Computer', { width: 150 }),
    textColumn('access', 'Access', { width: 80 }),
    columnGroup('Access', [
      dateColumn('access_date', 'Date', { width: 110 }),
      textColumn('access_time', 'Time', { width: 90 }),
    ]),
    textColumn('denial', 'Denial', { width: 80 }),
    columnGroup('Denial', [
      dateColumn('denial_date', 'Date', { width: 110 }),
      textColumn('denial_time', 'Time', { width: 90 }),
    ]),
  ];
}
