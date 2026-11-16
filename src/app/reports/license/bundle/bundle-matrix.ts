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

type BundleStatus = 'all' | 'common' | 'uncommon';

interface BundleEntry {
  bundle: string;
  module: string;
  row: OrganizationRow;
}

/**
 * Splits each feature name "BUNDLE_module" into its bundle and module, keeping only the bundles
 * listed in `input` (comma-separated), or every bundle when it is empty.
 */
function bundleEntries(licenseRows: readonly OrganizationRow[], input: string): BundleEntry[] {
  const prefixes = new Set(
    input
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
  return licenseRows.flatMap((row) => {
    const name = String(row.lic_name ?? '');
    const split = name.indexOf('_');
    const bundle = name.slice(0, split);
    const module = name.slice(split + 1);
    if (split < 0 || !module) return [];
    if (prefixes.size && !prefixes.has(bundle.toUpperCase())) return [];
    return [{ bundle, module, row }];
  });
}

/** How many different bundles each module appears in. */
function bundleCounts(entries: readonly BundleEntry[]): Map<string, number> {
  const bundlesByModule = new Map<string, Set<string>>();
  for (const { module, bundle } of entries) {
    const bundles = bundlesByModule.get(module) ?? new Set<string>();
    bundles.add(bundle);
    bundlesByModule.set(module, bundles);
  }
  return new Map([...bundlesByModule].map(([module, bundles]) => literal([module, bundles.size])));
}

/** Whether a module shared by every bundle (`common`) passes the chosen status filter. */
function matchesStatus(common: boolean, status: BundleStatus): boolean {
  if (status === 'common') return common;
  if (status === 'uncommon') return !common;
  return true;
}

function addTo(record: LicenseRecord, key: string, value: number): void {
  record[key] = Number(record[key] ?? 0) + value;
}

export function bundleMatrix(
  licenseRows: readonly OrganizationRow[],
  input: string,
  status: BundleStatus,
) {
  const entries = bundleEntries(licenseRows, input);
  const bundles = [...new Set(entries.map((entry) => entry.bundle))].sort((a, b) =>
    a.localeCompare(b),
  );
  const bundleIndexes = new Map(bundles.map((bundle, index) => literal([bundle, index])));
  const counts = bundleCounts(entries);
  const rows = new Map<string, LicenseRecord>();
  const servers = bundles.map(() => new Set<string>());
  const allServers = new Set<string>();
  for (const { bundle, module, row } of entries) {
    const index = bundleIndexes.get(bundle);
    if (index === undefined) continue;
    if (!matchesStatus(counts.get(module) === bundles.length, status)) continue;

    const record = rows.get(module) ?? { submodule: module, sum_issued: 0, sum_peak: 0 };
    rows.set(module, record);
    const issued = toNumber(row.l_qty_i) ?? 0;
    const peak = toNumber(row.qty_dp) ?? 0;
    addTo(record, `b${index}_issued`, issued);
    addTo(record, `b${index}_peak`, peak);
    addTo(record, 'sum_issued', issued);
    addTo(record, 'sum_peak', peak);
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
