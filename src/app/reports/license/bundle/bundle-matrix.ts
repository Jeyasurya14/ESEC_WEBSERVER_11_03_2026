import { literal } from '../../../core/utils/data';
import {
  Column,
  columnGroup,
  numberColumn,
  textColumn,
  toNumber,
} from '../../../shared/grid/columns';
import { LicenseRecord } from '../report-helpers';
import { OrganizationRow } from '../organization/organization.data';

export function bundleMatrix(
  licenseRows: readonly OrganizationRow[],
  input: string,
  status: 'all' | 'common' | 'uncommon',
) {
  const prefixes = new Set(
    input
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
  const entries = licenseRows.flatMap((row) => {
    const name = String(row.lic_name ?? '');
    const split = name.indexOf('_');
    if (split < 0) return [];
    const bundle = name.slice(0, split);
    const module = name.slice(split + 1);
    return module && (!prefixes.size || prefixes.has(bundle.toUpperCase()))
      ? [{ bundle, module, row }]
      : [];
  });
  const bundles = [...new Set(entries.map((entry) => entry.bundle))].sort();
  const bundleIndexes = new Map(bundles.map((bundle, index) => literal([bundle, index])));
  const membership = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!membership.has(entry.module)) membership.set(entry.module, new Set());
    membership.get(entry.module)!.add(entry.bundle);
  }
  const rows = new Map<string, LicenseRecord>();
  const servers = bundles.map(() => new Set<string>());
  const allServers = new Set<string>();
  for (const { bundle, module, row } of entries) {
    const common = membership.get(module)!.size === bundles.length;
    if ((status === 'common' && !common) || (status === 'uncommon' && common)) continue;
    let record = rows.get(module);
    if (!record) {
      record = { submodule: module, sum_issued: 0, sum_peak: 0 };
      rows.set(module, record);
    }
    const index = bundleIndexes.get(bundle);
    if (index === undefined) continue;
    const issued = toNumber(row.l_qty_i) ?? 0;
    const peak = toNumber(row.qty_dp) ?? 0;
    for (const [key, value] of literal([
      [`b${index}_issued`, issued],
      [`b${index}_peak`, peak],
      ['sum_issued', issued],
      ['sum_peak', peak],
    ]))
      record[key] = Number(record[key] ?? 0) + value;
    if (issued > 0) {
      servers[index].add(row.server);
      allServers.add(row.server);
    }
  }
  const serverCount: LicenseRecord = { submodule: 'Server Count', sum_issued: allServers.size };
  servers.forEach((values, index) => (serverCount[`b${index}_issued`] = values.size));
  return { bundles, rows: [...rows.values()], serverCounts: rows.size ? [serverCount] : [] };
}
export function bundleMatrixColumns(
  bundles: string[],
  issued: boolean,
  peak: boolean,
): Column<LicenseRecord>[] {
  const metrics = (prefix: string) => [
    numberColumn<LicenseRecord>(`${prefix}_issued`, 'I', { hide: !issued, width: 90 }),
    numberColumn<LicenseRecord>(`${prefix}_peak`, 'DP', { hide: !peak, width: 90 }),
  ];
  return [
    textColumn('submodule', 'Bundle - Sub Module', { pinned: 'left', width: 260 }),
    columnGroup('Sum', metrics('sum')),
    ...bundles.map((bundle, index) => columnGroup(bundle, metrics(`b${index}`))),
  ];
}
