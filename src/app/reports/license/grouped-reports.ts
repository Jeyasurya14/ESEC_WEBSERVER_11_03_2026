import { featureGroupParam } from '../../shared/filters/feature-group-filter';
import { UsageOption } from '../../shared/filters/option-filter';
import { ReportRange, rangeCall } from '../../shared/filters/range-filter';
import { Column, textColumn } from '../../shared/grid/columns';
import { ReportSettings } from '../../shared/report-settings.service';
import {
  OrganizationRow,
  organizationColumns,
  organizationTiles,
} from './organization/organization.data';

export type LicenseScope = 'organization' | 'division' | 'department' | 'group';
export interface GroupedRow extends OrganizationRow {
  divn?: string;
  dept?: string;
  g_type?: string;
  g_name?: string;
  max_qty_r?: number;
}

export function reportScope(screenName: string): LicenseScope {
  const scope = screenName.toLowerCase();
  return scope === 'division' || scope === 'department' || scope === 'group'
    ? scope
    : 'organization';
}

export function groupedCall(
  scope: LicenseScope,
  userId: string,
  range: ReportRange,
  featureGroup: string,
): string {
  return rangeCall(`esms_m.r_${scope}_grid`, range, [userId], [featureGroupParam(featureGroup)]);
}

export function groupedColumns(
  scope: LicenseScope,
  settings: ReportSettings,
  selectRow: (row: OrganizationRow) => void,
): Column<OrganizationRow>[] {
  const columns = organizationColumns(settings, selectRow);
  const groupColumns: Column<OrganizationRow>[] = [];
  if (scope === 'division' || scope === 'department') {
    groupColumns.push(textColumn('divn', settings.divisionLabel, { pinned: 'left', width: 110 }));
  }
  if (scope === 'department') {
    groupColumns.push(textColumn('dept', settings.departmentLabel, { pinned: 'left', width: 120 }));
  }
  if (scope === 'group') {
    groupColumns.push(
      textColumn('g_type', 'Group Type', { pinned: 'left', width: 110 }),
      textColumn('g_name', 'Group Name', { pinned: 'left', width: 130 }),
    );
  }
  columns.splice(6, 0, ...groupColumns);
  return columns;
}

export function groupedTiles(rows: OrganizationRow[], option: UsageOption, scope: LicenseScope) {
  return organizationTiles(rows, option).map((tile) => {
    const labels = scopeLabels(tile.row, scope);
    return { ...tile, title: [tile.title, ...labels].filter(Boolean).join(', ') };
  });
}

function scopeLabels(row: OrganizationRow, scope: LicenseScope): (string | undefined)[] {
  switch (scope) {
    case 'department':
      return [row.divn, row.dept];
    case 'division':
      return [row.divn];
    case 'group':
      return [row.g_type, row.g_name];
    default:
      return [];
  }
}
