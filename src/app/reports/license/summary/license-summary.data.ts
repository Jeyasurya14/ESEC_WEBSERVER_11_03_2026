import { literal } from '../../../core/utils/data';
import { sqlString } from '../../../core/api/api.service';
import { UsageOption } from '../../../shared/filters/option-filter';
import {
  Column,
  numberColumn,
  percentCell,
  textColumn,
  toNumber,
} from '../../../shared/grid/columns';
import { ReportSettings } from '../../../shared/report-settings.service';
import { OrganizationRow } from '../organization/organization.data';
import { LicenseScope } from '../grouped-reports';

export const SUMMARY_PERIODS = literal([
  { id: 'day', suffix: '30', title: '30 Days Utilization' },
  { id: 'week', suffix: 'week', title: '52 Weeks Utilization' },
  { id: 'month', suffix: 'month', title: '12 Months Utilization' },
  { id: 'year', suffix: 'year', title: '10 Years Utilization' },
]);
export type SummaryPeriod = (typeof SUMMARY_PERIODS)[number]['id'];
export type SummaryMode = 'value' | 'percentage';
export type SummarySeriesId = UsageOption | 'ISSUED';
export type SummaryRecord = Record<string, unknown>;

/** Colors and field names from the company's ag-summary-template and gblfunction. */
export const SUMMARY_SERIES: readonly {
  id: SummarySeriesId;
  label: string;
  color: string;
  mean?: boolean;
}[] = [
  { id: 'DP', label: 'Day Peak', color: '#1414E1' },
  { id: 'DA', label: 'Day Avg', color: '#5C8001' },
  { id: 'DPM', label: 'Day Peak Mean', color: '#FF006E', mean: true },
  { id: 'DAM', label: 'Day Avg Mean', color: '#649df8', mean: true },
  { id: 'WP', label: 'Work Peak', color: '#ff4500' },
  { id: 'WA', label: 'Work Avg', color: '#FBB02D' },
  { id: 'WPM', label: 'Work Peak Mean', color: '#7A4419', mean: true },
  { id: 'WAM', label: 'Work Avg Mean', color: '#7CB518', mean: true },
  { id: 'ISSUED', label: 'Issued', color: '#8E44AD' },
];
export const DEFAULT_SUMMARY_SERIES: readonly SummarySeriesId[] = ['DP', 'WP', 'ISSUED'];

export function summaryCall(
  scope: LicenseScope,
  row: OrganizationRow,
  section: SummaryPeriod | 'indicators',
): string {
  const identity = [row.server, row.lic];
  if (scope === 'division' || scope === 'department') identity.push(row.divn ?? '');
  if (scope === 'department') identity.push(row.dept ?? '');
  if (scope === 'group') identity.push(row.g_type ?? '', row.g_name ?? '');
  const suffix =
    section === 'indicators'
      ? 'indicator'
      : `chart_${SUMMARY_PERIODS.find((period) => period.id === section)!.suffix}`;
  return `call esms_m.r_${scope}_${suffix}(${identity.map(sqlString).join(',')});`;
}

export const INDICATOR_PERIODS = literal(['ytd', '07', '30', '60', '90', '180', '360']);
type IndicatorPeriod = (typeof INDICATOR_PERIODS)[number];
export type SummaryIndicator = { description: string; percentage: boolean } & Record<
  IndicatorPeriod,
  number | null
>;

/** Pivot period records into metric rows without mutating the API response. */
export function summaryIndicators(
  records: readonly SummaryRecord[],
  scope: LicenseScope,
  workingHours: number,
): SummaryIndicator[] {
  const periods = new Map(
    records.map((record) => {
      const key = String(record['type'] ?? '')
        .toLowerCase()
        .trim();
      return literal([key === '7' ? '07' : key, record]);
    }),
  );
  if (!INDICATOR_PERIODS.some((period) => periods.has(period))) return [];
  const includeCapacity = scope === 'organization' || scope === 'group';
  const metrics = [
    { field: 'max_qty_i', label: 'Issued' },
    ...(includeCapacity ? [{ field: 'max_qty_r', label: 'Reserved' }] : []),
    { field: 'qty_db', label: 'Borrow' },
    ...SUMMARY_SERIES.filter((series) => series.id !== 'ISSUED').map((series) => ({
      field: `qty_${series.id.toLowerCase()}`,
      label: series.label,
    })),
    { field: 'di', label: 'Users' },
    { field: 'ad', label: 'Denial Users' },
    { field: 'td', label: 'True Denial' },
    { field: 'avg_du', label: 'License Hours Used' },
    ...(includeCapacity
      ? [
          { field: 'tlh_24', label: 'License Hours Available' },
          { field: 'tot_du_q', label: `License Hours % - ${workingHours} Hrs` },
        ]
      : []),
  ];
  const hours = Number.isFinite(workingHours) && workingHours > 0 ? workingHours : 24;
  return metrics.map(({ field, label }) => {
    const values: Record<IndicatorPeriod, number | null> = {
      ytd: null,
      '07': null,
      '30': null,
      '60': null,
      '90': null,
      '180': null,
      '360': null,
    };
    for (const period of INDICATOR_PERIODS) {
      const record = periods.get(period);
      let value = toNumber(record?.[field]);
      const available = toNumber(record?.['tlh_24']);
      const capacity = available === null ? null : (available * hours) / 24;
      if (field === 'tlh_24') value = capacity === null ? null : Number(capacity.toFixed(4));
      if (field === 'tot_du_q')
        value =
          capacity === null || value === null
            ? null
            : capacity > 0
              ? Number(((value / capacity) * 100).toFixed(1))
              : 0;
      values[period] = value;
    }
    return { description: label, percentage: field === 'tot_du_q', ...values };
  });
}

export function summaryIndicatorColumns(settings: ReportSettings): Column<SummaryIndicator>[] {
  return [
    textColumn('description', 'Description', { pinned: 'left', width: 205, filter: false }),
    ...INDICATOR_PERIODS.map((period) =>
      numberColumn<SummaryIndicator>(period, period === 'ytd' ? 'YTD' : `${Number(period)} Days`, {
        width: 100,
        cellRenderer: (cell: {
          data?: SummaryIndicator;
          value: unknown;
          valueFormatted?: string | null;
        }) =>
          cell.data?.percentage ? percentCell(cell.value, settings) : (cell.valueFormatted ?? ''),
      }),
    ),
  ];
}
