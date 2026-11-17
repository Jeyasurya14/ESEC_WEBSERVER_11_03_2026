import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AgGridAngular } from 'ag-grid-angular';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../core/api/api.service';
import { DataGrid } from './data-grid';

describe('Grid scrollbar alignment', () => {
  it('tracks actual pinned and scrolling widths through resize, visibility and pin changes', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { getSetting: () => '' } }],
    });
    const fixture = TestBed.createComponent(DataGrid);
    fixture.componentRef.setInput('rows', [{ name: 'CAD', count: 5, total: 10 }]);
    fixture.componentRef.setInput('columns', [
      { field: 'name', width: 150, pinned: 'left' },
      { field: 'count', width: 200 },
      { field: 'total', width: 100, pinned: 'right' },
    ]);
    await fixture.whenStable();
    const grid = fixture.debugElement.query(By.directive(AgGridAngular));
    const api = grid.injector.get(AgGridAngular).api;
    const element: HTMLElement = grid.nativeElement;
    const widths = () => [
      element.style.getPropertyValue('--grid-pinned-left'),
      element.style.getPropertyValue('--grid-scroll-content'),
      element.style.getPropertyValue('--grid-pinned-right'),
    ];
    const expectWidths = async (expected: string[]) =>
      vi.waitFor(() => {
        TestBed.tick();
        expect(element.classList.contains('pinned-scroll')).toBe(true);
        expect(widths()).toEqual(expected);
      });
    await expectWidths(['150px', '200px', '100px']);
    api.setColumnWidths([{ key: 'name', newWidth: 230 }]);
    await expectWidths(['230px', '200px', '100px']);
    api.setColumnsVisible(['name'], false);
    await expectWidths(['0px', '200px', '100px']);
    api.setColumnsVisible(['name'], true);
    api.setColumnsPinned(['name', 'total'], null);
    await expectWidths(['0px', '530px', '0px']);
    fixture.componentRef.setInput('columns', [{ field: 'count', width: 310, pinned: 'left' }]);
    await expectWidths(['310px', '0px', '0px']);
    fixture.destroy();
  });
});
