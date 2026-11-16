import { isRecord } from '../../../core/utils/data';
import type { DropdownOption } from '../../../shared/dropdown/dropdown';
import { ReportFeature, featureId } from './custom-report.data';

const SELECTED_FLAGS = new Set(['FT', 'SV', 'Y']);

export function featureOptions(
  features: readonly ReportFeature[],
  field: 'sw' | 'server',
  software = '',
): DropdownOption[] {
  const values = new Set<string>();
  for (const feature of features) {
    if (field === 'server' && software && feature.sw !== software) continue;
    values.add(feature[field]);
  }
  return [
    { value: '', label: field === 'sw' ? 'All software' : 'All servers' },
    ...[...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })),
  ];
}

export function visibleFeatures(
  features: readonly ReportFeature[],
  software: string,
  server: string,
  searchText: string,
): ReportFeature[] {
  const search = searchText.trim().toLowerCase();
  return features.filter((row) => {
    if (software && row.sw !== software) return false;
    if (server && row.server !== server) return false;
    return (
      !search || `${row.sw} ${row.server} ${row.lic_name} ${row.lic}`.toLowerCase().includes(search)
    );
  });
}

export function updateFeatureSelection(
  selected: ReadonlySet<string>,
  features: readonly ReportFeature[],
  select: boolean,
): Set<string> {
  const updated = new Set(selected);
  for (const feature of features) {
    const key = featureId(feature);
    if (select) updated.add(key);
    else updated.delete(key);
  }
  return updated;
}

export function sessionFeatureKeys(json: string, available: readonly ReportFeature[]): Set<string> {
  const session: unknown = JSON.parse(json);
  if (!Array.isArray(session)) throw new Error('The saved session is invalid.');
  const allowed = new Set(available.map(featureId));
  const selected = new Set<string>();
  for (const row of session) {
    if (
      !isRecord(row) ||
      typeof row['server'] !== 'string' ||
      typeof row['lic'] !== 'string' ||
      typeof row['select'] !== 'string' ||
      !SELECTED_FLAGS.has(row['select'])
    )
      continue;
    const key = featureId({ server: row['server'], lic: row['lic'] });
    if (allowed.has(key)) selected.add(key);
  }
  return selected;
}
