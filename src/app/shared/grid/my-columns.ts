import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Column } from './columns';

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

export function myColumnsFrom(saved: unknown): Record<string, boolean> {
  const hidden = { ...DEFAULT_HIDDEN };
  if (Array.isArray(saved)) {
    for (const column of saved as Array<{ colId?: unknown; hide?: unknown }>) {
      if (typeof column?.colId === 'string' && typeof column.hide === 'boolean') {
        hidden[column.colId] = column.hide;
      }
    }
  }
  return hidden;
}

/** Applies "My Columns" to a report's column list; columns it doesn't mention keep their own setting. */
export function applyMyColumns<T>(
  columns: Column<T>[],
  hidden: Record<string, boolean>,
): Column<T>[] {
  return columns.map((column) => {
    if ('children' in column) {
      return { ...column, children: applyMyColumns(column.children, hidden) } as ColGroupDef<T>;
    }
    const { colId, field } = column as ColDef<T>;
    const id = colId ?? field;
    return id !== undefined && id in hidden ? { ...column, hide: hidden[id] } : column;
  });
}
