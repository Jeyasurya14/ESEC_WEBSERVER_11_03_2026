import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReportFilters } from './report-filters';

/**
 * A summary strip of every filter that is away from its default, each removable on its own, plus
 * one "Clear all". Drop it into any report that provides `ReportFilters` - it reads the filters
 * straight from that service, so the report itself doesn't need to wire anything up.
 */
@Component({
  selector: 'app-active-filters',
  template: `
    @if (filters.activeFilters().length) {
      <div class="active-filters" role="group" aria-label="Active filters">
        @for (filter of filters.activeFilters(); track filter.key) {
          <button type="button" class="active-filter-chip" (click)="filter.clear()">
            {{ filter.label }}
            <span class="active-filter-remove" aria-hidden="true">✕</span>
          </button>
        }
        <button type="button" class="clear-all-filters" (click)="filters.clearAll()">
          Clear all
        </button>
      </div>
    }
  `,
  styleUrl: './active-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveFiltersBar {
  protected readonly filters = inject(ReportFilters);
}
