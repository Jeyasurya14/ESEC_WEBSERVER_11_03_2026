import { ColGroupDef } from 'ag-grid-community';
import { Column } from './columns';
import { isRecord } from '../../core/utils/data';

const DEFAULT_HIDDEN: Readonly<Record<string, boolean>> = {
  user_name: true,
  region: true,
  country: true,
  divn: true,
  dept: true,
  clus: false,
  section: true,
  rpt_id: true,
  city: true,
  state: true,
  bldg: true,
  eid: true,
  qty_dp: false,
  p_dp: false,
  qty_da: true,
  p_da: true,
  qty_dpm: true,
  p_dpm: true,
  qty_dam: true,
  p_dam: true,
  qty_wp: false,
  p_wp: false,
  qty_wa: false,
  p_wa: false,
  qty_wpm: false,
  p_wpm: false,
  qty_wam: false,
  p_wam: false,
  tot_du_q: false,
  tlh_24: false,
  per_tot_du_q: false,
  di: false,
  ndivn: false,
  ndept: false,
  td: false,
  w_days: false,
  days: false,
  expiry: false,
};

export function readColumnVisibility(savedColumns: unknown): Record<string, boolean> {
  const hiddenColumns = { ...DEFAULT_HIDDEN };
  if (Array.isArray(savedColumns)) {
    for (const column of savedColumns) {
      if (
        isRecord(column) &&
        typeof column['colId'] === 'string' &&
        typeof column['hide'] === 'boolean'
      ) {
        hiddenColumns[column['colId']] = column['hide'];
      }
    }
  }
  return hiddenColumns;
}

/** Applies "My Columns" to a report's column list; columns it doesn't mention keep their own setting. */
export function applyColumnVisibility<T>(
  columns: Column<T>[],
  hiddenColumns: Record<string, boolean>,
): Column<T>[] {
  return columns.map((column) => {
    if ('children' in column) {
      return {
        ...column,
        children: applyColumnVisibility(column.children, hiddenColumns),
      } satisfies ColGroupDef<T>;
    }
    const { colId, field } = column;
    const columnId = colId ?? field;
    return columnId !== undefined && columnId in hiddenColumns
      ? { ...column, hide: hiddenColumns[columnId] }
      : column;
  });
}
