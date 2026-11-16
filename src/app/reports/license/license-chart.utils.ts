import type { Options } from 'highcharts';
import type { DropdownOption } from '../../shared/dropdown/dropdown';
import { toNumber } from '../../shared/grid/columns';
import type { LicenseRecord } from './report-helpers';

const EXCLUDED_FIELDS = new Set(['sno', 'c_hour']);
const PREFERRED_FIELDS = new Set(['qty_dp', 'p_qty_p', 'du', 'du_q']);

export function chartRows(rows: LicenseRecord[], searchText: string): LicenseRecord[] {
  const search = searchText.trim().toLowerCase();
  return search
    ? rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(search))
    : rows;
}

export function chartMetrics(rows: readonly LicenseRecord[]): DropdownOption[] {
  const fields = new Set<string>();
  const numericFields = new Set<string>();
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (EXCLUDED_FIELDS.has(field)) continue;
      fields.add(field);
      if (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)))
        numericFields.add(field);
    }
  }
  return [...fields]
    .filter((field) => numericFields.has(field))
    .map((value) => ({ value, label: value.replaceAll('_', ' ').toUpperCase() }));
}

export function chartMetric(metrics: readonly DropdownOption[], selected: string): string {
  let preferred = '';
  for (const { value } of metrics) {
    if (value === selected) return selected;
    if (!preferred && PREFERRED_FIELDS.has(value)) preferred = value;
  }
  return preferred || metrics[0]?.value || '';
}

export function licenseLineChart(rows: readonly LicenseRecord[], field: string): Options {
  const categories = new Set<string>();
  const valuesBySeries = new Map<string, Map<string, number | null>>();
  for (const [index, row] of rows.entries()) {
    const category = String(
      row['c_date'] ?? row['date'] ?? row['lic_name'] ?? row['server'] ?? index + 1,
    );
    const series =
      row['c_date'] || row['date']
        ? [row['server'], row['lic_name']].filter(Boolean).join(' / ') || field
        : String(row['server'] || field);
    categories.add(category);
    const values = valuesBySeries.get(series) ?? new Map<string, number | null>();
    if (!values.has(category)) values.set(category, toNumber(row[field]));
    valuesBySeries.set(series, values);
  }
  const labels = [...categories];
  return {
    chart: { type: 'line' },
    title: { text: undefined },
    xAxis: { categories: labels },
    yAxis: { title: { text: field.replaceAll('_', ' ').toUpperCase() }, min: 0 },
    series: [...valuesBySeries].map(([name, values]) => ({
      type: 'line',
      name,
      data: labels.map((category) => values.get(category) ?? null),
    })),
  } satisfies Options;
}
