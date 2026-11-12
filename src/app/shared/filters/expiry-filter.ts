import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { parseDate } from '../dates';
import { CheckFilter } from './check-filter';

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
  imports: [CheckFilter],
  template: `
    <app-check-filter
      label="Not Expired"
      [checked]="notExpired()"
      (toggled)="notExpired.set(!notExpired())"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryFilter {
  readonly notExpired = model.required<boolean>();
}
