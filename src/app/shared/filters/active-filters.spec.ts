import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ActiveFiltersBar } from './active-filters';
import { ActiveFilter, ReportFilters } from './report-filters';

@Component({
  selector: 'app-active-filters-host',
  imports: [ActiveFiltersBar],
  template: `<app-active-filters />`,
})
class HostComponent {}

describe('ActiveFiltersBar', () => {
  function setUp(filters: ActiveFilter[]) {
    const activeFilters = signal(filters);
    const clearAll = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ReportFilters, useValue: { activeFilters, clearAll } }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, clearAll };
  }

  it('shows nothing when no filter is away from its default', () => {
    const { element } = setUp([]);
    expect(element.querySelector('.active-filters')).toBeNull();
  });

  it('shows a chip per active filter, and clears just that one on click', () => {
    const clear = vi.fn();
    const { element } = setUp([{ key: 'search', label: 'Search: "catia"', clear }]);

    const chip = element.querySelector('.active-filter-chip') as HTMLButtonElement;
    expect(chip.textContent).toContain('Search: "catia"');

    chip.click();
    expect(clear).toHaveBeenCalledOnce();
  });

  it('clears everything through "Clear all"', () => {
    const { element, clearAll } = setUp([
      { key: 'search', label: 'Search: "catia"', clear: vi.fn() },
    ]);

    (element.querySelector('.clear-all-filters') as HTMLButtonElement).click();
    expect(clearAll).toHaveBeenCalledOnce();
  });
});
