import { sqlString } from '../../../core/api/api.service';
import {
  Column,
  columnGroup,
  dateColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface UserRow {
  server: string;
  lic: string;
  lic_name: string;
  user_id: string;
  user_name: string;
  access: string;
  access_date: string;
  access_time: string;
  denial: string;
  denial_date: string;
  denial_time: string;
}

export function userCall(userId: string): string {
  return `call esms_m.r_license_user(${sqlString(userId)});`;
}

export function userColumns(): Column<UserRow>[] {
  return [
    rowNumberColumn(),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('lic', 'License', { width: 150, pinned: 'left' }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    columnGroup('User', [
      textColumn('user_id', 'User Id', { width: 120 }),
      textColumn('user_name', 'User Name', { width: 150 }),
    ]),
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
