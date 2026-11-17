import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  isDevMode,
  output,
  signal,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  ColDef,
  CsvExportModule,
  GetContextMenuItems,
  GridApi,
  ModelUpdatedEvent,
  ModuleRegistry,
  NumberFilterModule,
  PinnedRowModule,
  QuickFilterModule,
  RenderApiModule,
  RowApiModule,
  RowDoubleClickedEvent,
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
  LicenseManager,
  SetFilterModule,
  SideBarModule,
} from 'ag-grid-enterprise';
import { ApiService } from '../../core/api/api.service';
import { applyColumnVisibility } from './column-visibility';
import { Column, ROW_NUMBER_COLUMN, formatNumber } from './columns';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  TextFilterModule,
  NumberFilterModule,
  PinnedRowModule,
  SetFilterModule,
  QuickFilterModule,
  RowApiModule,
  RenderApiModule,
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
  ...(isDevMode() ? [ValidationModule] : []),
]);

const THEME = themeBalham.withParams({
  fontFamily: 'inherit',
  headerBackgroundColor: '#1e293b',
  headerTextColor: '#ffffff',
  headerColumnBorder: { color: 'rgba(255, 255, 255, 0.35)' },
  headerColumnBorderHeight: '100%',
  oddRowBackgroundColor: '#f5f9fd',
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

@Component({
  selector: 'app-data-grid',
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="grid"
      [class.pinned-scroll]="scrollWidths() !== null"
      [style.--grid-pinned-left.px]="scrollWidths()?.left"
      [style.--grid-pinned-right.px]="scrollWidths()?.right"
      [style.--grid-scroll-content.px]="scrollWidths()?.center"
      [theme]="theme"
      [icons]="icons"
      [rowData]="rows()"
      [pinnedTopRowData]="pinnedTopRows()"
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
      (gridReady)="updateScrollWidths($event.api)"
      (displayedColumnsChanged)="updateScrollWidths($event.api)"
      (columnResized)="updateScrollWidths($event.api)"
      (filterChanged)="renumberRows($event.api)"
      (sortChanged)="renumberRows($event.api)"
      (rowDoubleClicked)="onRowDoubleClicked($event)"
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
  readonly pinnedTopRows = input<T[]>([]);
  readonly columns = input.required<Column<T>[]>();

  readonly hiddenColumns = input<Record<string, boolean>>({});

  readonly search = input('');
  readonly loading = input(false);

  readonly emptyText = input('');

  readonly rowCount = output<string>();

  readonly filtersCleared = output<void>();

  readonly rowSelected = output<T>();

  protected readonly theme = THEME;
  protected readonly icons = ICONS;
  protected readonly defaultColumn = DEFAULT_COLUMN;
  protected readonly sideBar = SIDE_BAR;
  protected readonly loadingTemplate = LOADING_TEMPLATE;

  protected readonly columnHeaderHeight = 32;
  protected readonly groupHeaderHeight = 32;
  protected readonly scrollWidths = signal<{ left: number; center: number; right: number } | null>(
    null,
  );
  protected readonly shownColumns = computed(() =>
    applyColumnVisibility(this.columns(), this.hiddenColumns()),
  );
  protected readonly noRowsTemplate = computed(
    () => `<span>${escapeHtml(this.emptyText()) || ' '}</span>`,
  );

  constructor() {
    const licenseKey = inject(ApiService).getSetting('AG_GRID_LICENSE_KEY');
    if (licenseKey && !licenseApplied) {
      LicenseManager.setLicenseKey(licenseKey);
      licenseApplied = true;
    }
  }

  protected readonly contextMenu: GetContextMenuItems<T> = (menuParams) => {
    const clearFilter = {
      name: 'Clear Filter',
      action: () => {
        menuParams.api.setFilterModel(null);
        this.filtersCleared.emit();
      },
    };
    return menuParams.node ? [clearFilter, 'export'] : [clearFilter];
  };

  protected renumberRows(api: GridApi<T>): void {
    api.refreshCells({ columns: [ROW_NUMBER_COLUMN] });
  }

  protected updateScrollWidths(api: GridApi<T>): void {
    const width = (columns: ReturnType<GridApi<T>['getAllDisplayedColumns']>) =>
      columns.reduce((total, column) => total + column.getActualWidth(), 0);
    const next = {
      left: width(api.getDisplayedLeftColumns()),
      center: width(api.getDisplayedCenterColumns()),
      right: width(api.getDisplayedRightColumns()),
    };
    const current = this.scrollWidths();
    if (
      current?.left !== next.left ||
      current.center !== next.center ||
      current.right !== next.right
    )
      this.scrollWidths.set(next);
  }

  protected countRows({ api }: ModelUpdatedEvent<T>): void {
    this.rowCount.emit(
      rowCountText(api.getDisplayedRowCount(), this.rows().length, api.isAnyFilterPresent()),
    );
  }

  protected onRowDoubleClicked({ data }: RowDoubleClickedEvent<T>): void {
    if (data) {
      this.rowSelected.emit(data);
    }
  }
}

function escapeHtml(htmlText: string): string {
  return htmlText.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0)};`);
}
