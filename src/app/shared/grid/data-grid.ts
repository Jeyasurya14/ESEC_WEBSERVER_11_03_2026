import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  isDevMode,
  output,
} from '@angular/core';
import { AgChartsCommunityModule } from 'ag-charts-community';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColDef,
  CsvExportModule,
  GetContextMenuItems,
  GridApi,
  ModelUpdatedEvent,
  ModuleRegistry,
  NumberFilterModule,
  QuickFilterModule,
  RenderApiModule,
  RowApiModule,
  SideBarDef,
  TextFilterModule,
  ValidationModule,
  themeBalham,
} from 'ag-grid-community';
import {
  CellSelectionModule,
  ClipboardModule,
  ColumnMenuModule,
  ColumnsToolPanelModule,
  ContextMenuModule,
  ExcelExportModule,
  FiltersToolPanelModule,
  IntegratedChartsModule,
  LicenseManager,
  SetFilterModule,
  SideBarModule,
} from 'ag-grid-enterprise';
import { ApiService } from '../../core/api/api.service';
import { Column, ROW_NUMBER_COLUMN, formatNumber } from './columns';
import { applyMyColumns } from './my-columns';

// The grid features the company app's reports use. ValidationModule explains misconfigured
// columns in the console during development only.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  SetFilterModule,
  QuickFilterModule,
  RowApiModule, // the row count
  RenderApiModule, // renumbering rows
  CellStyleModule,
  ColumnMenuModule,
  ContextMenuModule,
  SideBarModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  CellSelectionModule,
  ClipboardModule,
  CsvExportModule,
  ExcelExportModule,
  IntegratedChartsModule.with(AgChartsCommunityModule),
  ...(isDevMode() ? [ValidationModule] : []),
]);

const THEME = themeBalham.withParams({
  fontFamily: 'inherit',
  headerBackgroundColor: '#586980',
  headerTextColor: '#ffffff',
  headerColumnBorder: { color: 'rgba(255, 255, 255, 0.35)' },
  headerColumnBorderHeight: '100%',
  oddRowBackgroundColor: '#f3f3f3',
  columnBorder: { color: 'rgba(189, 195, 199, 0.5)' },
});

const icon = (file: string) => `<img src="assets/grid/${file}" alt="" />`;
const ICONS = {
  menu: icon('menu_white.png'),
  legacyMenu: icon('menu_white.png'),
  sortAscending: icon('up_sort.png'),
  sortDescending: icon('arrow-down_sort.png'),
  columnGroupOpened: icon('leftArrow_white.png'),
  columnGroupClosed: icon('down_white.png'),
};

const LOADING_TEMPLATE =
  '<img alt="Loading" src="assets/grid/spinner.svg" style="width: 100px; height: 100px" />';

const DEFAULT_COLUMN: ColDef = {
  filter: 'agSetColumnFilter',
  filterParams: { refreshValuesOnOpen: true },
  menuTabs: ['filterMenuTab'],
  minWidth: 20,
  lockPosition: 'left',
};

const SIDE_BAR: SideBarDef = {
  position: 'right',
  toolPanels: [
    {
      id: 'columns',
      labelDefault: 'Columns',
      labelKey: 'columns',
      iconKey: 'columns',
      toolPanel: 'agColumnsToolPanel',
      toolPanelParams: { suppressRowGroups: true, suppressValues: true, suppressPivotMode: true },
      minWidth: 225,
      width: 225,
      maxWidth: 225,
    },
    {
      id: 'filters',
      labelDefault: 'Filters',
      labelKey: 'filters',
      iconKey: 'filter',
      toolPanel: 'agFiltersToolPanel',
      minWidth: 180,
      maxWidth: 400,
      width: 250,
    },
  ],
};

export function rowCountText(shown: number, total: number, filtered: boolean): string {
  if (total === 0) return '';
  return filtered ? `${formatNumber(shown)} of ${formatNumber(total)}` : formatNumber(total);
}

let licenseApplied = false;

/**
 * The grid every report uses (AG Grid Enterprise), set up like the company app's. A report gives
 * it rows and columns; filters, the side panels, the right-click menu, cell selection, export,
 * charts, the loading spinner and the row count work the same everywhere.
 *
 * The licence key comes from the AG_GRID_LICENSE_KEY setting. Without it AG Grid shows its trial
 * watermark, as the company app does today.
 */
@Component({
  selector: 'app-data-grid',
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="grid"
      [theme]="theme"
      [icons]="icons"
      [rowData]="rows()"
      [columnDefs]="shownColumns()"
      [defaultColDef]="defaultColumn"
      [columnMenu]="'legacy'"
      [headerHeight]="columnHeaderHeight"
      [groupHeaderHeight]="groupHeaderHeight"
      [sideBar]="sideBar"
      [cellSelection]="true"
      [accentedSort]="true"
      [suppressColumnMoveAnimation]="true"
      [suppressDragLeaveHidesColumns]="true"
      [getContextMenuItems]="contextMenu"
      [quickFilterText]="search()"
      [loading]="loading()"
      [overlayLoadingTemplate]="loadingTemplate"
      [overlayNoRowsTemplate]="noRowsTemplate()"
      (modelUpdated)="countRows($event)"
      (filterChanged)="renumberRows($event.api)"
      (sortChanged)="renumberRows($event.api)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }
    .grid {
      flex: 1;
      min-height: 200px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGrid<T> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<Column<T>[]>();

  readonly hiddenColumns = input<Record<string, boolean>>({});

  readonly search = input('');
  readonly loading = input(false);

  readonly emptyText = input('');

  readonly rowCount = output<string>();

  readonly filtersCleared = output<void>();

  protected readonly theme = THEME;
  protected readonly icons = ICONS;
  protected readonly defaultColumn = DEFAULT_COLUMN;
  protected readonly sideBar = SIDE_BAR;
  protected readonly loadingTemplate = LOADING_TEMPLATE;

  protected readonly columnHeaderHeight = 26;
  protected readonly groupHeaderHeight = 26;
  protected readonly shownColumns = computed(() =>
    applyMyColumns(this.columns(), this.hiddenColumns()),
  );
  protected readonly noRowsTemplate = computed(
    () => `<span>${escapeHtml(this.emptyText()) || ' '}</span>`,
  );

  constructor() {
    const key = inject(ApiService).getSetting('AG_GRID_LICENSE_KEY');
    if (key && !licenseApplied) {
      LicenseManager.setLicenseKey(key);
      licenseApplied = true;
    }
  }

  protected readonly contextMenu: GetContextMenuItems<T> = (params) => {
    const clearFilter = {
      name: 'Clear Filter',
      action: () => {
        params.api.setFilterModel(null);
        this.filtersCleared.emit();
      },
    };
    return params.node ? [clearFilter, 'export', 'chartRange'] : [clearFilter];
  };

  /** S.No counts the rows as shown, so it is redrawn after every filter or sort, as in the company app. */
  protected renumberRows(api: GridApi<T>): void {
    api.refreshCells({ columns: [ROW_NUMBER_COLUMN] });
  }

  protected countRows({ api }: ModelUpdatedEvent<T>): void {
    this.rowCount.emit(
      rowCountText(api.getDisplayedRowCount(), this.rows().length, api.isAnyFilterPresent()),
    );
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
