const IDENTITY_FIELDS = new Set(['user_id', 'lic', 'server', 'sw']);
import {
  Column,
  dateColumn,
  numberColumn,
  rowNumberColumn,
  textColumn,
} from '../../shared/grid/columns';
import { formatSqlDate, parseDate } from '../../shared/dates';

export type LicenseRecord = Record<string, unknown>;

export { registerReportRefresh as registerLicenseRefresh } from '../../shared/report-refresh';

const LABELS: Record<string, string> = {
  sw: 'Software',
  server: 'Server',
  lic: 'License',
  lic_name: 'Feature',
  user_id: 'User Id',
  user_name: 'User Name',
  wksn: 'Computer',
  divn: 'Division',
  dept: 'Department',
  du: 'Usage Hours',
  dw: 'Work Hours',
  p_du: 'Usage %',
  p_dw: 'Work %',
  du_q: 'License Hours',
  dw_q: 'Work License Hours',
  count_days: 'Days',
  g_type: 'Group Type',
  g_name: 'Group Name',
  session: 'Sessions',
  c_date: 'Date',
  qty_i: 'Issued',
  tlh_24: 'Available Hours',
  total: 'Data Points',
  p100: '100% Utilization Points',
  pp100: '100% Utilization %',
};

/** Schema-driven reports keep every returned field, including installation-specific columns. */
export function recordColumns(rows: LicenseRecord[]): Column<LicenseRecord>[] {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => key !== 'sno');
  return [
    rowNumberColumn(),
    ...keys.map((key) => {
      const label =
        LABELS[key] ?? key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const values = rows
        .map((row) => row[key])
        .filter((value) => value !== null && value !== undefined && value !== '');
      if (/(^|_)date$/.test(key)) return dateColumn<LicenseRecord>(key, label, { width: 125 });
      if (
        values.length &&
        values.every(
          (value) =>
            typeof value === 'number' ||
            (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)),
        ) &&
        !IDENTITY_FIELDS.has(key)
      ) {
        return numberColumn<LicenseRecord>(key, label, { width: 110 });
      }
      return textColumn<LicenseRecord>(key, label, { width: 150 });
    }),
  ];
}

export { formatSqlDate as isoDate } from '../../shared/dates';

export function validPeriod(start: string, end: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(end) &&
    start <= end &&
    parseDate(start) !== null &&
    parseDate(end) !== null
  );
}

export function serverDate(iso: string): string {
  const date = parseDate(iso);
  if (!date) throw new Error('Choose a valid report date.');
  return formatSqlDate(date);
}
