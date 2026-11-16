import { isRecord } from '../../../core/utils/data';
import { FeatureRow, featureKey } from './feature-groups.data';

export function savedFeatureKeys(rows: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(rows)) return keys;
  for (const row of rows) {
    if (!isRecord(row) || typeof row['SERVER'] !== 'string' || typeof row['FEATURE'] !== 'string')
      continue;
    if (row['FEATURE_SELECT'] !== undefined && row['FEATURE_SELECT'] !== 'Y') continue;
    keys.add(featureKey({ SERVER: row['SERVER'], FEATURE: row['FEATURE'] }));
  }
  return keys;
}

export function selectedFeatures(
  rows: readonly FeatureRow[],
  selected: ReadonlySet<string>,
): FeatureRow[] {
  return rows.map((row) => {
    const flag = selected.has(featureKey(row)) ? 'Y' : 'N';
    return row.FEATURE_SELECT === flag ? row : { ...row, FEATURE_SELECT: flag };
  });
}
