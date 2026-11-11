import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { parseDate } from '../dates';

export function isNotExpired(expiry: unknown, today: Date): boolean {
  const date = parseDate(expiry);
  if (!date) {
    return true;
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date >= startOfToday;
}

@Component({
  selector: 'app-expiry-filter',
  template: `
    <label class="filter check">
      <input type="checkbox" [checked]="notExpired()" (change)="notExpired.set(!notExpired())" />
      Not Expired
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryFilter {
  readonly notExpired = model.required<boolean>();
}
