import { LicenseRecord } from '../report-helpers';
import { toNumber } from '../../../shared/grid/columns';

export interface DurationPoint {
  quantity: number;
  count: number;
  percentage: number;
}
/** Sorted cumulative counts use binary search, avoiding a scan for every possible license quantity. */
export function durationPoints(
  rows: readonly LicenseRecord[],
  field: string,
  linear = false,
): DurationPoint[] {
  const values = rows
    .map((row) => toNumber(row[field]))
    .filter((value): value is number => value !== null && value >= 0)
    .sort((firstValue, secondValue) => firstValue - secondValue);
  if (!values.length) return [];
  const maximum = values[values.length - 1];
  const levels = linear
    ? Array.from({ length: Math.min(5000, Math.ceil(maximum)) }, (_, index) =>
        Math.ceil(((index + 1) * maximum) / Math.min(5000, Math.ceil(maximum))),
      )
    : [...new Set(values)];
  return levels.map((quantity) => {
    let lower = 0;
    let upper = values.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (values[middle] < quantity) lower = middle + 1;
      else upper = middle;
    }
    const count =
      quantity === 0 ? values.filter((value) => value === 0).length : values.length - lower;
    return { quantity, count, percentage: Number(((count / values.length) * 100).toFixed(2)) };
  });
}

/** Normalized least squares with pivoting, shared by the QOS 2nd/3rd/4th-order comparison curves. */
export function polynomialCurve(
  points: readonly DurationPoint[],
  degree: number,
): [number, number][] {
  if (points.length <= degree || degree < 2 || degree > 4) return [];
  const scale = Math.max(1, ...points.map((point) => point.quantity));
  const size = degree + 1;
  const matrix = Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size + 1 }, (_, columnIndex) =>
      points.reduce(
        (sum, point) =>
          sum +
          (point.quantity / scale) ** (rowIndex + (columnIndex === size ? 0 : columnIndex)) *
            (columnIndex === size ? point.percentage : 1),
        0,
      ),
    ),
  );
  for (let columnIndex = 0; columnIndex < size; columnIndex++) {
    let pivotRow = columnIndex;
    for (let row = columnIndex + 1; row < size; row++)
      if (Math.abs(matrix[row][columnIndex]) > Math.abs(matrix[pivotRow][columnIndex]))
        pivotRow = row;
    [matrix[columnIndex], matrix[pivotRow]] = [matrix[pivotRow], matrix[columnIndex]];
    const divisor = matrix[columnIndex][columnIndex];
    if (Math.abs(divisor) < 1e-12) return [];
    for (let cellIndex = columnIndex; cellIndex <= size; cellIndex++)
      matrix[columnIndex][cellIndex] /= divisor;
    for (let row = 0; row < size; row++)
      if (row !== columnIndex) {
        const factor = matrix[row][columnIndex];
        for (let cellIndex = columnIndex; cellIndex <= size; cellIndex++)
          matrix[row][cellIndex] -= factor * matrix[columnIndex][cellIndex];
      }
  }
  return points.map((point) => [
    point.quantity,
    matrix.reduce((sum, row, power) => sum + row[size] * (point.quantity / scale) ** power, 0),
  ]);
}

export function groupUsage(rows: readonly LicenseRecord[], field: string): LicenseRecord[] {
  const groups = new Map<string, { row: LicenseRecord; users: Set<string> }>();
  for (const usageRow of rows) {
    const label = String(usageRow[field] ?? '') || 'Not Available';
    // Department/group identities include their parent scope; identical names must not merge.
    const parent =
      field === 'dept'
        ? String(usageRow['divn'] ?? '')
        : field === 'g_name'
          ? String(usageRow['g_type'] ?? '')
          : '';
    const groupKey = JSON.stringify([parent, label]);
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        row: {
          [field]: label,
          ...(field === 'dept' ? { divn: parent } : field === 'g_name' ? { g_type: parent } : {}),
        },
        users: new Set(),
      };
      groups.set(groupKey, group);
    }
    if (usageRow['user_id']) group.users.add(String(usageRow['user_id']));
    for (const metric of ['du', 'dw', 'du_q', 'dw_q', 'session'])
      group.row[metric] = Number(group.row[metric] ?? 0) + (toNumber(usageRow[metric]) ?? 0);
    group.row['users'] = group.users.size;
  }
  return [...groups.values()].map((group) => group.row);
}

export function usageMatrix(rows: readonly LicenseRecord[], field: string): LicenseRecord[] {
  const groups = new Map<string, LicenseRecord>();
  for (const usageRow of rows) {
    const identity = String(usageRow['user_id'] ?? usageRow['wksn'] ?? 'Unknown');
    const category = String(usageRow[field] ?? '') || 'Not Available';
    let row = groups.get(identity);
    if (!row) {
      row = { user_id: identity, user_name: usageRow['user_name'] ?? '', total_hours: 0 };
      groups.set(identity, row);
    }
    const hours = toNumber(usageRow['du_q'] ?? usageRow['du']) ?? 0;
    // Prefix backend labels so a group named user_id cannot overwrite the identity columns.
    row[`hours: ${category}`] = Number(row[`hours: ${category}`] ?? 0) + hours;
    row['total_hours'] = Number(row['total_hours']) + hours;
  }
  return [...groups.values()];
}
