import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { CheckFilter } from './check-filter';

export interface ServerStatus {
  active: boolean;
  inactive: boolean;
}

export function matchesServerStatus(status: unknown, filter: ServerStatus): boolean {
  const installed = typeof status === 'string' && status.toLowerCase() === 'installed';
  return installed ? filter.active : filter.inactive;
}

@Component({
  selector: 'app-server-status-filter',
  imports: [CheckFilter],
  template: `
    <span class="filter-label">License Server</span>
    <app-check-filter label="Active" [checked]="status().active" (toggled)="toggle('active')" />
    <app-check-filter label="Inactive" [checked]="status().inactive" (toggled)="toggle('inactive')" />
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
