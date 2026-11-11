import { ColDef, ColGroupDef } from 'ag-grid-community';
import { MONTHS, formatDate, parseDate } from '../dates';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';

type Field<T> = ColDef<T>['field'];
export type Column<T> = ColDef<T> | ColGroupDef<T>;

function isBlank(value: unknown): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

export function formatNumber(value: unknown): string {
  if (isBlank(value)) return '';
  const number = Number(value);
  return Number.isNaN(number)
    ? String(value)
    : number.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function formatCompact(value: unknown): string {
  if (isBlank(value)) return '';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);

  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  const unit = units.find(([size]) => Math.abs(number) >= size);
  if (unit) return `${(number / unit[0]).toFixed(3)} ${unit[1]}`;

  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

export const ROW_NUMBER_COLUMN = 'sno';

export function rowNumberColumn<T>(): ColDef<T> {
  return {
    colId: ROW_NUMBER_COLUMN,
    headerName: 'S.No',
    width: 60,
    pinned: 'left',
    sortable: false,
    filter: false,
    menuTabs: [],
    valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
  };
}

export function textColumn<T>(
  field: Field<T>,
  headerName: string,
  extra: Partial<ColDef<T>> = {},
): ColDef<T> {
  return { field, headerName, cellDataType: 'text', ...extra };
}

export function numberColumn<T>(
  field: Field<T>,
  headerName: string,
  extra: Partial<ColDef<T>> = {},
): ColDef<T> {
  return {
    field,
    headerName,
    type: 'rightAligned',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    valueGetter: (params) =>
      toNumber(params.data ? (params.data as Record<string, unknown>)[String(field)] : null),
    valueFormatter: (params) => formatNumber(params.value),
    ...extra,
  };
}

export function toNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export function compactColumn<T>(
  field: Field<T>,
  headerName: string,
  extra: Partial<ColDef<T>> = {},
): ColDef<T> {
  return numberColumn(field, headerName, {
    valueFormatter: (params) => formatCompact(params.value),
    ...extra,
  });
}

export function percentColumn<T>(
  field: Field<T>,
  headerName: string,
  limits: BandLimits,
  extra: Partial<ColDef<T>> = {},
): ColDef<T> {
  return numberColumn(field, headerName, {
    width: 70,
    cellRenderer: (params: { value: unknown }) => percentCell(params.value, limits),
    ...extra,
  });
}

export function dateColumn<T>(
  field: Field<T>,
  headerName: string,
  extra: Partial<ColDef<T>> = {},
): ColDef<T> {
  return {
    field,
    headerName,
    cellDataType: false,
    valueFormatter: (params) => formatDate(params.value),
    comparator: (a, b) => (parseDate(a)?.getTime() ?? 0) - (parseDate(b)?.getTime() ?? 0),
    filter: 'agSetColumnFilter',
    filterParams: { treeList: true, treeListPathGetter: datePath },
    ...extra,
  };
}

export function datePath(value: unknown): string[] {
  const date = parseDate(value);
  if (!date) return ['(Blanks)'];
  return [
    String(date.getFullYear()),
    MONTHS[date.getMonth()],
    String(date.getDate()).padStart(2, '0'),
  ];
}

export function columnGroup<T>(headerName: string, children: ColDef<T>[]): ColGroupDef<T> {
  return { headerName, children };
}

export function percentCell(value: unknown, limits: BandLimits): HTMLElement | string {
  const percent = toNumber(value);
  if (percent === null) {
    return '';
  }

  const cell = document.createElement('span');
  cell.className = 'percent-cell';
  const dot = document.createElement('span');
  dot.className = 'percent-dot';
  dot.style.background = bandColor(bandOf(percent, limits), limits);
  cell.append(dot, String(value));
  return cell;
}
