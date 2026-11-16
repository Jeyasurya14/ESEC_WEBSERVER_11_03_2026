import { Column } from '../../../shared/grid/columns';
import { ReportSettings } from '../../../shared/report-settings.service';
import { LicenseRecord, recordColumns } from '../report-helpers';
import { assetInfoColumns } from './columns/asset-columns';
import { borrowColumns, checkoutUserColumns, denialColumns } from './columns/session-columns';
import { dateColumns, hoursColumns, monthColumns, usageColumns } from './columns/usage-columns';
import { DetailParameters, DetailView } from './detail-queries';

export function detailColumns(
  view: DetailView,
  rows: LicenseRecord[],
  settings: ReportSettings,
  reportOptions: DetailParameters,
): Column<LicenseRecord>[] {
  let known: Column<LicenseRecord>[] = [];
  switch (view) {
    case 'month':
      known = monthColumns(settings);
      break;
    case 'date':
      known = dateColumns(settings);
      break;
    case 'hours':
      known = hoursColumns(reportOptions.granularity === 'month' ? 'month' : 'date');
      break;
    case 'checkoutUser':
    case 'longDuration':
      known = checkoutUserColumns();
      break;
    case 'denial':
      known = denialColumns();
      break;
    case 'borrow':
      known = borrowColumns();
      break;
    case 'assetInfo':
      known = assetInfoColumns(settings);
      break;
    case 'usage':
      if (reportOptions.usageView === 'summary') known = usageColumns();
      break;
    case 'utilizationHours':
      known = usageColumns();
      break;
  }
  if (!known.length) return recordColumns(rows);
  const fields = new Set<string>();
  function collect(columns: Column<LicenseRecord>[]): void {
    for (const column of columns) {
      if ('children' in column) collect(column.children);
      else {
        if (column.field) fields.add(column.field);
        if (column.colId) fields.add(column.colId);
      }
    }
  }
  collect(known);
  const extras = recordColumns(rows).filter(
    (column) =>
      !('children' in column) &&
      (column.colId === 'sno' ? !fields.has('sno') : !!column.field && !fields.has(column.field)),
  );
  return [...known, ...extras];
}

export function detailLinks(
  columns: Column<LicenseRecord>[],
  fields: string[],
  select: (row: LicenseRecord) => void,
): Column<LicenseRecord>[] {
  const linkedFields = new Set(fields);
  return columns.map((column) =>
    'children' in column
      ? { ...column, children: detailLinks(column.children, fields, select) }
      : column.field && linkedFields.has(column.field)
        ? {
            ...column,
            cellClass: 'link-cell',
            onCellClicked: (event) => {
              if (event.data) select(event.data);
            },
          }
        : column,
  );
}
