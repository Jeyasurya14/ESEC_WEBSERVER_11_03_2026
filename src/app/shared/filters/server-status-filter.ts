import { ChangeDetectionStrategy, Component, model } from '@angular/core';

export interface ServerStatus {
  active: boolean;
  inactive: boolean;
}

export function matchesServerStatus(status: unknown, filter: ServerStatus): boolean {
  const installed = String(status ?? '').toLowerCase() === 'installed';
  return installed ? filter.active : filter.inactive;
}

@Component({
  selector: 'app-server-status-filter',
  template: `
    <span class="filter-label">License Server</span>
    <label class="filter check">
      <input type="checkbox" [checked]="status().active" (change)="toggle('active')" />
      Active
    </label>
    <label class="filter check">
      <input type="checkbox" [checked]="status().inactive" (change)="toggle('inactive')" />
      Inactive
    </label>
  `,
  host: { class: 'filter-group', role: 'group', 'aria-label': 'License server status' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerStatusFilter {
  readonly status = model.required<ServerStatus>();

  protected toggle(key: keyof ServerStatus): void {
    this.status.update((current) => ({ ...current, [key]: !current[key] }));
  }
}
