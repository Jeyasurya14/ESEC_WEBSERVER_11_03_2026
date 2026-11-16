import { Column, linkColumn, rowNumberColumn, textColumn } from '../../../shared/grid/columns';

export interface DebugDataRow {
  sw_name: string;
  server: string;
  location: string;
  lic: string;
}

/** Takes no arguments - the company app shows a default date range in its title, but never sends it. */
export function debugDataCall(): string {
  return 'call esms_m.r_license_debug_data();';
}

export function debugDataColumns(select?: (row: DebugDataRow) => void): Column<DebugDataRow>[] {
  return [
    rowNumberColumn(),
    textColumn('sw_name', 'Software', { width: 150 }),
    textColumn('server', 'Server', { width: 180 }),
    textColumn('location', 'Location', { width: 120, hide: true }),
    select
      ? linkColumn('lic', 'License', select, { width: 200 })
      : textColumn('lic', 'License', { width: 200 }),
  ];
}
