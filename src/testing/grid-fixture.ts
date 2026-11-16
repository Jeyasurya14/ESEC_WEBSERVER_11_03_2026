import {
  AllCommunityModule,
  CellClickedEvent,
  ColDef,
  GridApi,
  ValueGetterParams,
  createGrid,
} from 'ag-grid-community';

/** Real grid objects keep callback tests aligned with the vendor's full event contract. */
export class GridFixture<T> implements Disposable {
  private readonly api: GridApi<T>;
  private readonly colDef: ColDef<T> = { colId: 'test' };

  constructor(data: T) {
    this.api = createGrid<T>(
      document.createElement('div'),
      {
        columnDefs: [this.colDef],
        rowData: [data],
        theme: 'legacy',
      },
      { modules: [AllCommunityModule] },
    );
  }

  valueParams(data: T | undefined): ValueGetterParams<T> {
    const column = this.api.getColumn('test');
    if (!column) throw new Error('Missing test column');
    return {
      api: this.api,
      context: undefined,
      column,
      colDef: this.colDef,
      data,
      node: this.api.getDisplayedRowAtIndex(0) ?? null,
      getValue: () => undefined,
    };
  }

  click(data: T | undefined): CellClickedEvent<T> {
    const column = this.api.getColumn('test');
    const node = this.api.getDisplayedRowAtIndex(0);
    if (!column || !node) throw new Error('Missing test cell');
    return {
      type: 'cellClicked',
      api: this.api,
      context: undefined,
      column,
      node,
      colDef: this.colDef,
      data,
      value: undefined,
      rowIndex: 0,
      rowPinned: null,
      isEventHandlingSuppressed: false,
    };
  }

  [Symbol.dispose](): void {
    this.api.destroy();
  }
}
