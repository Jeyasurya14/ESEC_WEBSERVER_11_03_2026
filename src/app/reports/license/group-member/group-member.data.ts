import {
  Column,
  columnGroup,
  dateColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface GroupMemberRow {
  sw: string;
  server: string;
  location: string;
  lic: string;
  lic_name: string;
  g_type: string;
  g_name: string;
  g_member: string;
  start_date: string;
  s_time: string;
  u_flag: string;
  user_id: string;
  wksn: string;
  last_date: string;
  u_time: string;
}

export function groupMemberCall(): string {
  return 'call esms_m.r_license_group_member();';
}

export function groupMemberColumns(): Column<GroupMemberRow>[] {
  return [
    rowNumberColumn(),
    textColumn('sw', 'Software', { width: 100, pinned: 'left' }),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('location', 'Location', { width: 100, pinned: 'left', hide: true }),
    textColumn('lic', 'License', { width: 150, pinned: 'left', hide: true }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    columnGroup('Group', [
      textColumn('g_type', 'Type', { width: 100 }),
      textColumn('g_name', 'Name', { width: 120 }),
      textColumn('g_member', 'Member', { width: 120 }),
    ]),
    columnGroup('Start', [
      dateColumn('start_date', 'Date', { width: 110 }),
      textColumn('s_time', 'Time', { width: 80 }),
    ]),
    textColumn('u_flag', 'Flag', { width: 70 }),
    textColumn('user_id', 'User Id', { width: 100 }),
    textColumn('wksn', 'Computer', { width: 130 }),
    columnGroup('Last Updated', [
      dateColumn('last_date', 'Date', { width: 110 }),
      textColumn('u_time', 'Time', { width: 80 }),
    ]),
  ];
}
