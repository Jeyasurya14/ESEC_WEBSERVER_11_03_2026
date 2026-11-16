import { inputValue } from '../../../shared/input-value';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { OrganizationRow } from '../organization/organization.data';
import { bundleMatrix, bundleMatrixColumns } from './bundle-matrix';

@Component({
  selector: 'app-license-bundle',
  imports: [CheckFilter, SearchFilter, DataGrid],
  template: `
    <div class="report-toolbar" role="toolbar" aria-label="Bundle filters">
      <app-search-filter [(text)]="search" />
      <input
        type="text"
        aria-label="Bundle prefixes"
        placeholder="Bundle prefixes, comma-separated"
        [value]="prefixes()"
        (input)="prefixes.set(inputValue($event))"
      />
      <select
        aria-label="Bundle module status"
        [value]="status()"
        (change)="selectStatus(inputValue($event))"
      >
        <option value="all">All</option>
        <option value="common">Common</option>
        <option value="uncommon">Uncommon</option>
      </select>
      <app-check-filter label="Issued" [checked]="issued()" (toggled)="issued.set(!issued())" />
      <app-check-filter label="Day Peak" [checked]="peak()" (toggled)="peak.set(!peak())" />
      <span class="toolbar-trailing row-count">Modules: {{ matrix().rows.length }}</span>
    </div>
    <app-data-grid
      [rows]="matrix().rows"
      [pinnedTopRows]="matrix().serverCounts"
      [columns]="columns()"
      [search]="search()"
      emptyText="No matching bundle modules."
      (filtersCleared)="search.set('')"
    />
  `,
  host: { class: 'report-page report-fill' },
  styleUrl: '../license-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseBundle {
  protected readonly inputValue = inputValue;

  readonly rows = input.required<OrganizationRow[]>();
  protected readonly search = signal('');
  protected readonly prefixes = signal('');
  protected readonly status = signal<'all' | 'common' | 'uncommon'>('all');
  protected readonly issued = signal(true);
  protected readonly peak = signal(true);
  protected readonly matrix = computed(() =>
    bundleMatrix(this.rows(), this.prefixes(), this.status()),
  );
  protected readonly columns = computed(() =>
    bundleMatrixColumns(this.matrix().bundles, this.issued(), this.peak()),
  );
  protected selectStatus(value: string): void {
    if (value === 'all' || value === 'common' || value === 'uncommon') this.status.set(value);
  }
}
