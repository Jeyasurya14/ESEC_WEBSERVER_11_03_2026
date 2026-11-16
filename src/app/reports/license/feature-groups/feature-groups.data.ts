import { sqlString } from '../../../core/api/api.service';
import { Column, rowNumberColumn, textColumn } from '../../../shared/grid/columns';

/** One feature the user can add to a "My Feature" group, as the license list procedures return it. */
export interface FeatureRow {
  FEATURE_SELECT: 'Y' | 'N';
  SOFT_NAME: string;
  SERVER: string;
  FEATURE: string;
}

/** Identifies a feature across the list and a group's saved selection. */
export function featureKey(row: Pick<FeatureRow, 'SERVER' | 'FEATURE'>): string {
  return `${row.SERVER}|${row.FEATURE}`;
}

/** Every feature the user may pick from, none selected. */
export function allFeaturesCall(userId: string): string {
  return `call esms.R_A_CLTX_ESEC_MF_LICENSE_ALL(${sqlString(userId)});`;
}

/** The feature list for one group, each row flagged FEATURE_SELECT 'Y' when it is in that group. */
export function groupFeaturesCall(userId: string, groupName: string): string {
  return `call R_A_CLTX_ESEC_MF_LICENSE_LIST(${sqlString(userId)},${sqlString(groupName.trim())});`;
}

export function createGroupCall(userId: string, groupName: string): string {
  return `call R_A_CLTX_ESEC_MF_CREATE(${sqlString(userId)},${sqlString(groupName.trim())});`;
}

export function addFeatureCall(userId: string, groupName: string, row: FeatureRow): string {
  return `call R_A_CLTX_ESEC_MF_ADD(${[userId, groupName, row.SERVER, row.FEATURE].map(sqlString).join(',')});`;
}

export function removeFeatureCall(userId: string, groupName: string, row: FeatureRow): string {
  return `call R_A_CLTX_ESEC_MF_remove(${[userId, groupName, row.SERVER, row.FEATURE].map(sqlString).join(',')});`;
}

/** What saving a group needs: rows to add, and rows to remove, versus what the group held on load. */
export function selectionChanges(
  rows: readonly FeatureRow[],
  savedKeys: ReadonlySet<string>,
  selectedKeys: ReadonlySet<string>,
): { added: FeatureRow[]; removed: FeatureRow[] } {
  return {
    added: rows.filter(
      (row) => selectedKeys.has(featureKey(row)) && !savedKeys.has(featureKey(row)),
    ),
    removed: rows.filter(
      (row) => savedKeys.has(featureKey(row)) && !selectedKeys.has(featureKey(row)),
    ),
  };
}

export function myFeatureColumns(onToggle: (row: FeatureRow) => void): Column<FeatureRow>[] {
  return [
    rowNumberColumn(),
    {
      colId: 'FEATURE_SELECT',
      headerName: 'Select',
      width: 70,
      pinned: 'left',
      filter: false,
      sortable: false,
      menuTabs: [],
      cellRenderer: (cell: { data?: FeatureRow }) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = cell.data?.FEATURE_SELECT === 'Y';
        checkbox.style.pointerEvents = 'none';
        checkbox.setAttribute('aria-label', 'Select feature');
        return checkbox;
      },
      onCellClicked: (cell) => {
        if (cell.data) {
          onToggle(cell.data);
        }
      },
    },
    textColumn('SOFT_NAME', 'Software', { width: 150 }),
    textColumn('SERVER', 'Server', { width: 200 }),
    textColumn('FEATURE', 'Feature', { width: 250 }),
  ];
}
